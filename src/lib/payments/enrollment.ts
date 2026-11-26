import 'server-only';
import { z } from 'zod';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
import {
  gateway,
  type Gateway,
  type ProviderOrder,
  type ProviderPayment,
} from './gateway';
import { sha256, verifyCheckoutSignature } from './security';
export const checkoutSchema = z
  .object({
    applicationId: z.string().min(1).max(100),
    cohortId: z.string().min(1).max(100),
    priceVersion: z.number().int().positive(),
    termsVersion: z.string().min(1).max(80),
    agree: z.literal(true),
  })
  .strict();
export async function startCheckout(
  userId: string,
  input: unknown,
  api: Gateway = gateway,
) {
  const body = checkoutSchema.parse(input);
  ensure(
    api.ready(),
    503,
    'PAYMENTS_DISABLED',
    'Sandbox checkout is disabled until genuine test credentials and approved content are configured.',
  );
  const result = await serial(async (tx) => {
    await lock(tx, `enrollment:${body.applicationId}`);
    await tx.$queryRaw`SELECT id FROM "Cohort" WHERE id=${body.cohortId} FOR UPDATE`;
    const app = await tx.application.findFirst({
      where: { id: body.applicationId, userId },
      include: { course: true, enrollment: { include: { payments: true } } },
    });
    ensure(app?.course, 404, 'APPLICATION', 'Application not found.');
    const course = app.course;
    ensure(
      !course.assessmentRequired || app.assessmentStatus === 'PASSED',
      403,
      'ASSESSMENT',
      'The prerequisite assessment must be passed before checkout.',
    );
    ensure(
      app.status === 'ACCEPTED',
      403,
      'NOT_ACCEPTED',
      'Admissions approval is required before checkout.',
    );
    ensure(
      app.admittedCourseVersion === course.contentVersion,
      409,
      'CONTENT_CHANGED',
      'Course content changed. Admissions must review your acceptance again.',
    );
    ensure(
      course.status === 'PUBLISHED' &&
        course.contentApprovedAt &&
        course.priceApprovedAt &&
        course.priceMinor !== null &&
        course.priceMinor > 0 &&
        course.termsApprovedAt &&
        course.termsVersion &&
        course.enrollmentTerms &&
        course.refundPolicy,
      409,
      'APPROVALS_MISSING',
      'Approved course content, fees, enrollment terms and refund disclosure are required.',
    );
    const cohort = await tx.cohort.findFirst({
      where: { id: body.cohortId, courseId: course.id },
    });
    ensure(
      cohort?.status === 'PUBLISHED' &&
        cohort.admissionsOpen &&
        cohort.startsAt &&
        cohort.endsAt &&
        cohort.startsAt > new Date() &&
        cohort.capacity !== null,
      409,
      'COHORT',
      'A published, dated cohort with admissions open is required.',
    );
    const existing = app.enrollment;
    if (existing) {
      ensure(
        existing.cohortId === cohort.id,
        409,
        'COHORT_LOCKED',
        'An enrollment already exists for a different cohort. Contact admissions before changing it.',
      );
      ensure(
        existing.status !== 'CANCELLED',
        409,
        'CANCELLED',
        'This enrollment was cancelled. Contact admissions before reopening it.',
      );
      if (existing.status === 'ACTIVE')
        return {
          enrollment: existing,
          payment: existing.payments[0],
          create: false,
        };
    }
    if (existing)
      ensure(
        existing.status === 'PENDING',
        409,
        'ENROLLMENT_REVIEW',
        'This enrollment needs operator review. Do not make another payment.',
      );
    const oldPayment = existing?.payments[0];
    if (!oldPayment) {
      ensure(
        body.priceVersion === course.priceVersion &&
          body.termsVersion === course.termsVersion,
        409,
        'QUOTE_CHANGED',
        'Fees or terms changed. Refresh the fee review before agreeing.',
      );
    }
    const occupied = await tx.enrollment.count({
      where: {
        cohortId: cohort.id,
        ...(existing ? { id: { not: existing.id } } : {}),
        OR: [
          { status: 'ACTIVE' },
          { status: 'PENDING', reservedUntil: { gt: new Date() } },
        ],
      },
    });
    ensure(
      occupied < cohort.capacity,
      409,
      'CAPACITY',
      'This cohort has no available seats. No new payment order was created.',
    );
    const enrollment = existing
      ? await tx.enrollment.update({
          where: { id: existing.id },
          data: { reservedUntil: new Date(Date.now() + 15 * 60000) },
        })
      : await tx.enrollment.create({
          data: {
            userId,
            cohortId: cohort.id,
            applicationId: app.id,
            status: 'PENDING',
            reservedUntil: new Date(Date.now() + 15 * 60000),
            amountMinor: course.priceMinor,
            currency: course.currency,
            priceVersion: course.priceVersion,
            termsVersion: course.termsVersion,
            termsSnapshot: course.enrollmentTerms,
            refundSnapshot: course.refundPolicy,
            agreementHash: sha256(
              `${course.termsVersion}\n${course.enrollmentTerms}\n${course.refundPolicy}`,
            ),
            agreedAt: new Date(),
          },
        });
    if (oldPayment) return { enrollment, payment: oldPayment, create: false };
    const payment = await tx.payment.create({
      data: {
        enrollmentId: enrollment.id,
        amountMinor: enrollment.amountMinor!,
        currency: enrollment.currency!,
        provider: 'razorpay',
        idempotencyKey: `enrollment:${enrollment.id}`,
        orderState: 'CREATING',
        providerReceipt: `nx_${enrollment.id}`,
      },
    });
    await audit(tx, userId, 'CHECKOUT_AGREED', 'Enrollment', enrollment.id, {
      applicationId: app.id,
      priceVersion: course.priceVersion,
      termsVersion: course.termsVersion,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
    return { enrollment, payment, create: true };
  });
  ensure(
    result.payment,
    409,
    'PAYMENT_REVIEW',
    'Payment records require operator review.',
  );
  let payment = result.payment;
  if (result.create) {
    try {
      const order = await api.createOrder({
        amount: payment.amountMinor,
        currency: payment.currency,
        receipt: payment.providerReceipt!,
      });
      ensure(
        order.amount === payment.amountMinor &&
          order.currency === payment.currency &&
          order.receipt === payment.providerReceipt,
        409,
        'PROVIDER_MISMATCH',
        'The provider order did not match the approved fee.',
      );
      payment = await getDb().payment.update({
        where: { id: payment.id },
        data: { providerOrderId: order.id, orderState: 'OPEN' },
      });
    } catch (error) {
      await getDb().payment.updateMany({
        where: { id: payment.id, providerOrderId: null },
        data: { orderState: 'UNKNOWN', failureCode: 'ORDER_UNCERTAIN' },
      });
      throw error;
    }
  }
  ensure(
    payment.providerOrderId,
    409,
    'ORDER_UNCERTAIN',
    'The existing order needs reconciliation. A second order has not been created.',
  );
  return {
    enrollmentId: result.enrollment.id,
    paymentId: payment.id,
    orderId: payment.providerOrderId,
    amount: payment.amountMinor,
    currency: payment.currency,
    key: api.publicKey(),
    status: result.enrollment.status,
  };
}
export async function applyProviderState(
  order: ProviderOrder,
  providerPayment: ProviderPayment,
  actorId: string | null,
  api: Gateway = gateway,
) {
  ensure(
    api.ready(),
    503,
    'PAYMENTS_DISABLED',
    'Sandbox payments are not configured.',
  );
  const found = await getDb().payment.findFirst({
    where: {
      provider: 'razorpay',
      OR: [{ providerOrderId: order.id }, { providerReceipt: order.receipt }],
    },
    include: { enrollment: true },
  });
  ensure(
    found,
    404,
    'UNKNOWN_ORDER',
    'This provider order is not associated with a Nexora enrollment.',
  );
  return serial(async (tx) => {
    await lock(
      tx,
      `enrollment:${found.enrollment.applicationId ?? found.enrollment.id}`,
    );
    await tx.$queryRaw`SELECT id FROM "Cohort" WHERE id=${found.enrollment.cohortId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: found.id },
      include: {
        enrollment: {
          include: { application: { include: { course: true } }, cohort: true },
        },
      },
    });
    const enrollment = payment.enrollment;
    ensure(
      order.id === (payment.providerOrderId ?? order.id) &&
        order.receipt === payment.providerReceipt &&
        providerPayment.order_id === order.id &&
        providerPayment.amount === payment.amountMinor &&
        providerPayment.currency === payment.currency &&
        order.amount === payment.amountMinor &&
        order.currency === payment.currency,
      409,
      'AMOUNT_MISMATCH',
      'Provider amounts, currency, receipt or order identity did not match. No access was granted.',
    );
    if (
      ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(
        payment.status,
      ) &&
      ['failed', 'created', 'authorized'].includes(providerPayment.status)
    )
      return {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        paymentStatus: payment.status,
      };
    ensure(
      !payment.providerRef || payment.providerRef === providerPayment.id,
      409,
      'SECOND_CAPTURE',
      'A different captured payment already exists. Operator reconciliation is required.',
    );
    if (
      payment.status === 'REFUNDED' ||
      providerPayment.amount_refunded < payment.refundedMinor
    )
      return {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        paymentStatus: payment.status,
      };
    if (providerPayment.amount_refunded > 0) {
      ensure(
        providerPayment.amount_refunded <= payment.amountMinor,
        409,
        'REFUND_MISMATCH',
        'Refund data needs reconciliation.',
      );
      const full = providerPayment.amount_refunded === payment.amountMinor;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerOrderId: order.id,
          providerRef: providerPayment.id,
          status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundedMinor: providerPayment.amount_refunded,
          reconciledAt: new Date(),
          verifiedAt: new Date(),
        },
      });
      const status = full ? 'CANCELLED' : 'REVIEW_REQUIRED';
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status,
          reviewReason: full ? 'PROVIDER_REFUNDED' : 'PARTIAL_REFUND_REVIEW',
          reservedUntil: null,
        },
      });
      await audit(
        tx,
        actorId,
        'PAYMENT_REFUND_RECONCILED',
        'Payment',
        payment.id,
        { refundedMinor: providerPayment.amount_refunded, status },
      );
      return {
        enrollmentId: enrollment.id,
        status,
        paymentStatus: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      };
    }
    if (providerPayment.status !== 'captured' || order.status !== 'paid') {
      if (
        payment.status === 'SUCCEEDED' ||
        payment.status === 'PARTIALLY_REFUNDED'
      )
        return {
          enrollmentId: enrollment.id,
          status: enrollment.status,
          paymentStatus: payment.status,
        };
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerOrderId: order.id,
          status: providerPayment.status === 'failed' ? 'FAILED' : 'PENDING',
          orderState: 'OPEN',
          reconciledAt: new Date(),
          failureCode:
            providerPayment.status === 'failed'
              ? 'PROVIDER_PAYMENT_FAILED'
              : null,
        },
      });
      return {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        paymentStatus:
          providerPayment.status === 'failed' ? 'FAILED' : 'PENDING',
      };
    }
    ensure(
      order.amount_paid === payment.amountMinor,
      409,
      'ORDER_NOT_PAID',
      'The order is not fully paid.',
    );
    const app = enrollment.application;
    const cohort = enrollment.cohort;
    const occupied = await tx.enrollment.count({
      where: {
        cohortId: cohort.id,
        id: { not: enrollment.id },
        OR: [
          { status: 'ACTIVE' },
          { status: 'PENDING', reservedUntil: { gt: new Date() } },
        ],
      },
    });
    const eligible =
      app?.status === 'ACCEPTED' &&
      app.admittedCourseVersion === app.course?.contentVersion &&
      (!app.course?.assessmentRequired || app.assessmentStatus === 'PASSED') &&
      app.course?.status === 'PUBLISHED' &&
      app.course.contentApprovedAt &&
      enrollment.agreedAt &&
      enrollment.agreementHash &&
      cohort.status === 'PUBLISHED' &&
      cohort.capacity !== null &&
      occupied < cohort.capacity &&
      enrollment.status !== 'CANCELLED';
    const status =
      enrollment.status === 'ACTIVE'
        ? 'ACTIVE'
        : eligible
          ? 'ACTIVE'
          : 'REVIEW_REQUIRED';
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        providerOrderId: order.id,
        providerRef: providerPayment.id,
        status: 'SUCCEEDED',
        orderState: 'CLOSED',
        verifiedAt: new Date(),
        reconciledAt: new Date(),
        failureCode: null,
      },
    });
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status,
        activatedAt:
          status === 'ACTIVE' ? (enrollment.activatedAt ?? new Date()) : null,
        reservedUntil: null,
        reviewReason:
          status === 'REVIEW_REQUIRED'
            ? 'PAID_ELIGIBILITY_OR_CAPACITY_REVIEW'
            : null,
      },
    });
    if (payment.status !== 'SUCCEEDED' || enrollment.status !== status)
      await audit(
        tx,
        actorId,
        'PAYMENT_CAPTURE_VERIFIED',
        'Payment',
        payment.id,
        {
          enrollmentId: enrollment.id,
          status,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
        },
      );
    return { enrollmentId: enrollment.id, status, paymentStatus: 'SUCCEEDED' };
  });
}
export async function reconcilePayment(
  id: string,
  actorId: string | null,
  api: Gateway = gateway,
) {
  ensure(
    api.ready(),
    503,
    'PAYMENTS_DISABLED',
    'Sandbox reconciliation is not configured.',
  );
  const payment = await getDb().payment.findUnique({ where: { id } });
  ensure(payment, 404, 'PAYMENT', 'Payment not found.');
  ensure(
    payment.provider === 'razorpay' && payment.providerReceipt,
    409,
    'LEGACY_PAYMENT',
    'This legacy payment requires manual operator reconciliation.',
  );
  const order = payment.providerOrderId
    ? await api.getOrder(payment.providerOrderId)
    : await api.findOrder(payment.providerReceipt!);
  ensure(
    order,
    409,
    'ORDER_UNCERTAIN',
    'No provider order was found yet. Do not create another order until the uncertain request is resolved by an operator.',
  );
  ensure(
    order.receipt === payment.providerReceipt &&
      order.amount === payment.amountMinor &&
      order.currency === payment.currency,
    409,
    'ORDER_MISMATCH',
    'The provider order did not match the stored payment.',
  );
  await getDb().payment.update({
    where: { id },
    data: {
      providerOrderId: order.id,
      orderState: order.status === 'paid' ? 'CLOSED' : 'OPEN',
      reconciledAt: new Date(),
    },
  });
  const attempts = await api.orderPayments(order.id);
  const captured = attempts.find(
    (p) => p.status === 'captured' || p.status === 'refunded',
  );
  const candidate = captured ?? attempts.at(-1);
  if (!candidate)
    return {
      enrollmentId: payment.enrollmentId,
      status: 'PENDING',
      paymentStatus: 'PENDING',
    };
  return applyProviderState(order, candidate, actorId, api);
}
export const verificationSchema = z
  .object({
    paymentId: z.string().min(1).max(100),
    razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
    razorpay_order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
    razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();
export async function verifyPayment(
  userId: string,
  input: unknown,
  api: Gateway = gateway,
) {
  const b = verificationSchema.parse(input);
  ensure(
    api.ready(),
    503,
    'PAYMENTS_DISABLED',
    'Sandbox payments are not configured.',
  );
  const payment = await getDb().payment.findFirst({
    where: { id: b.paymentId, enrollment: { userId } },
  });
  ensure(payment?.providerOrderId, 404, 'PAYMENT', 'Payment not found.');
  ensure(
    payment.providerOrderId === b.razorpay_order_id &&
      verifyCheckoutSignature(
        payment.providerOrderId,
        b.razorpay_payment_id,
        b.razorpay_signature,
        api.signingSecret(),
      ),
    400,
    'SIGNATURE',
    'Payment signature was invalid. No access was granted.',
  );
  const [order, providerPayment] = await Promise.all([
    api.getOrder(payment.providerOrderId),
    api.getPayment(b.razorpay_payment_id),
  ]);
  return applyProviderState(order, providerPayment, userId, api);
}
export async function paidAccess(userId: string, enrollmentId: string) {
  const e = await getDb().enrollment.findFirst({
    where: { id: enrollmentId, userId },
    include: {
      payments: {
        where: {
          status: 'SUCCEEDED',
          verifiedAt: { not: null },
          providerRef: { not: null },
        },
        take: 1,
      },
    },
  });
  ensure(e, 404, 'ENROLLMENT', 'Enrollment not found.');
  ensure(
    e.status === 'ACTIVE' && e.payments.length > 0,
    403,
    'UNPAID',
    'A verified paid enrollment is required.',
  );
  return { allowed: true, enrollmentId: e.id };
}
