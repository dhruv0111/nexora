import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixture, testGateway } from './fixtures';
import {
  saveApplication,
  reviewApplication,
  ownApplications,
} from '@/lib/admissions/service';
import {
  startCheckout,
  verifyPayment,
  paidAccess,
  reconcilePayment,
  applyProviderState,
} from '@/lib/payments/enrollment';
import { handleWebhook } from '@/lib/payments/webhooks';
let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  f = await fixture();
});
afterEach(async () => {
  await f?.cleanup();
});
function quote(appId: string) {
  return {
    applicationId: appId,
    cohortId: f.cohort.id,
    priceVersion: 1,
    termsVersion: 'test-v1',
    agree: true,
  };
}
function signed(orderId: string, paymentId: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}
describe('real PostgreSQL admissions and payment-contract integration (not external sandbox payments)', () => {
  it('saves and resumes a partial draft, then submits exactly once', async () => {
    const draft = await saveApplication(f.student.id, f.course.slug, {
      action: 'save',
      version: 0,
      details: { fullName: 'Test' },
    });
    expect(draft.status).toBe('DRAFT');
    const submit = await saveApplication(f.student.id, f.course.slug, {
      action: 'submit',
      version: draft.version,
      details: f.details,
    });
    expect(submit.status).toBe('SUBMITTED');
    const duplicate = await saveApplication(f.student.id, f.course.slug, {
      action: 'submit',
      version: submit.version,
      details: f.details,
    });
    expect(duplicate.id).toBe(submit.id);
    expect(
      await f.db.application.count({
        where: { userId: f.student.id, courseId: f.course.id },
      }),
    ).toBe(1);
    expect(
      await f.db.auditLog.count({
        where: { entityId: submit.id, action: 'APPLICATION_SUBMITTED' },
      }),
    ).toBe(1);
    expect(await ownApplications(f.second.id)).toHaveLength(0);
  });
  it('rejects stale drafts and incomplete submissions', async () => {
    await saveApplication(f.student.id, f.course.slug, {
      action: 'save',
      version: 0,
      details: {},
    });
    await expect(
      saveApplication(f.student.id, f.course.slug, {
        action: 'save',
        version: 0,
        details: { fullName: 'New' },
      }),
    ).rejects.toMatchObject({ code: 'VERSION' });
    await expect(
      saveApplication(f.student.id, f.course.slug, {
        action: 'submit',
        version: 1,
        details: { fullName: 'Only name' },
      }),
    ).rejects.toBeTruthy();
  });
  it('enforces reviewed AI assessment and records admissions history', async () => {
    await f.db.course.update({
      where: { id: f.course.id },
      data: { assessmentRequired: true },
    });
    const app = await saveApplication(f.student.id, f.course.slug, {
      action: 'submit',
      version: 0,
      details: f.details,
    });
    await reviewApplication(f.admin.id, app.id, {
      version: 1,
      status: 'ASSESSMENT',
      assessmentStatus: 'PENDING',
      note: 'Reviewing the technical readiness answers.',
    });
    await expect(
      reviewApplication(f.admin.id, app.id, {
        version: 2,
        status: 'ACCEPTED',
        assessmentStatus: 'PENDING',
        note: 'Attempt without a passed assessment.',
      }),
    ).rejects.toMatchObject({ code: 'ASSESSMENT' });
    const accepted = await reviewApplication(f.admin.id, app.id, {
      version: 2,
      status: 'ACCEPTED',
      assessmentStatus: 'PASSED',
      note: 'The isolated assessment is reviewed and passed.',
    });
    expect(accepted.status).toBe('ACCEPTED');
    expect(
      await f.db.auditLog.count({
        where: { entityId: app.id, action: 'APPLICATION_REVIEWED' },
      }),
    ).toBe(2);
  });
  it('blocks unaccepted, cross-user and manipulated-price checkout', async () => {
    const g = testGateway();
    const app = await f.accepted();
    await expect(
      startCheckout(f.second.id, quote(app.id), g.api),
    ).rejects.toMatchObject({ status: 404 });
    await f.db.application.update({
      where: { id: app.id },
      data: { status: 'SUBMITTED' },
    });
    await expect(
      startCheckout(f.student.id, quote(app.id), g.api),
    ).rejects.toMatchObject({ code: 'NOT_ACCEPTED' });
    await f.db.application.update({
      where: { id: app.id },
      data: { status: 'ACCEPTED' },
    });
    await expect(
      startCheckout(f.student.id, { ...quote(app.id), amount: 1 }, g.api),
    ).rejects.toBeTruthy();
    await expect(
      startCheckout(
        f.student.id,
        { ...quote(app.id), priceVersion: 99 },
        g.api,
      ),
    ).rejects.toMatchObject({ code: 'QUOTE_CHANGED' });
    expect(g.calls).toBe(0);
  });
  it('requires approved terms and fees before an order is created', async () => {
    const app = await f.accepted(),
      g = testGateway();
    await f.db.course.update({
      where: { id: f.course.id },
      data: { termsApprovedAt: null },
    });
    await expect(
      startCheckout(f.student.id, quote(app.id), g.api),
    ).rejects.toMatchObject({ code: 'APPROVALS_MISSING' });
    expect(g.calls).toBe(0);
  });
  it('uses server fees, reuses the order, and denies unpaid course access', async () => {
    const app = await f.accepted(),
      g = testGateway();
    const first = await startCheckout(f.student.id, quote(app.id), g.api);
    const retry = await startCheckout(f.student.id, quote(app.id), g.api);
    expect(first.orderId).toBe(retry.orderId);
    expect(first.amount).toBe(123400);
    expect(g.calls).toBe(1);
    expect(
      await f.db.payment.count({ where: { enrollmentId: first.enrollmentId } }),
    ).toBe(1);
    await expect(
      paidAccess(f.student.id, first.enrollmentId),
    ).rejects.toMatchObject({ code: 'UNPAID' });
    await expect(
      paidAccess(f.second.id, first.enrollmentId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects invalid signatures and activates only captured, fully paid orders', async () => {
    const app = await f.accepted(),
      g = testGateway(),
      o = await startCheckout(f.student.id, quote(app.id), g.api),
      p = g.capture(o.orderId, 'authorized');
    const base = {
      paymentId: o.paymentId,
      razorpay_order_id: o.orderId,
      razorpay_payment_id: p.id,
    };
    await expect(
      verifyPayment(
        f.student.id,
        { ...base, razorpay_signature: '0'.repeat(64) },
        g.api,
      ),
    ).rejects.toMatchObject({ code: 'SIGNATURE' });
    const signature = signed(o.orderId, p.id, g.api.signingSecret());
    const pending = await verifyPayment(
      f.student.id,
      { ...base, razorpay_signature: signature },
      g.api,
    );
    expect(pending.status).toBe('PENDING');
    p.status = 'captured';
    g.orders.get(o.orderId)!.status = 'paid';
    g.orders.get(o.orderId)!.amount_paid = o.amount;
    expect(
      (
        await verifyPayment(
          f.student.id,
          { ...base, razorpay_signature: signature },
          g.api,
        )
      ).status,
    ).toBe('ACTIVE');
    expect(await paidAccess(f.student.id, o.enrollmentId)).toMatchObject({
      allowed: true,
    });
  });
  it('requires admissions review when approved content changes during payment', async () => {
    const app = await f.accepted(),
      g = testGateway(),
      o = await startCheckout(f.student.id, quote(app.id), g.api),
      p = g.capture(o.orderId);
    await f.db.course.update({
      where: { id: f.course.id },
      data: { contentVersion: { increment: 1 } },
    });
    const result = await applyProviderState(
      g.orders.get(o.orderId)!,
      p,
      null,
      g.api,
    );
    expect(result).toMatchObject({
      status: 'REVIEW_REQUIRED',
      paymentStatus: 'SUCCEEDED',
    });
    await expect(
      paidAccess(f.student.id, o.enrollmentId),
    ).rejects.toMatchObject({ code: 'UNPAID' });
  });
  it('validates exact webhook bytes and makes duplicate events harmless', async () => {
    const app = await f.accepted(),
      g = testGateway(),
      o = await startCheckout(f.student.id, quote(app.id), g.api),
      p = g.capture(o.orderId);
    const raw = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: p.id, order_id: o.orderId } } },
      }),
    );
    const signature = createHmac('sha256', g.api.webhookSecret())
        .update(raw)
        .digest('hex'),
      eventId = `evt_${randomUUID()}`;
    await expect(
      handleWebhook(
        Buffer.concat([raw, Buffer.from(' ')]),
        signature,
        eventId,
        g.api,
      ),
    ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE' });
    await handleWebhook(raw, signature, eventId, g.api);
    expect(await handleWebhook(raw, signature, eventId, g.api)).toMatchObject({
      duplicate: true,
    });
    expect(
      await f.db.paymentEvent.count({ where: { providerEventId: eventId } }),
    ).toBe(1);
    expect(
      await f.db.auditLog.count({
        where: { entityId: o.paymentId, action: 'PAYMENT_CAPTURE_VERIFIED' },
      }),
    ).toBe(1);
  });
  it('does not downgrade a captured payment when a failed attempt arrives late', async () => {
    const app = await f.accepted(),
      g = testGateway(),
      o = await startCheckout(f.student.id, quote(app.id), g.api),
      failed = g.capture(o.orderId, 'failed'),
      captured = g.capture(o.orderId);
    await applyProviderState(g.orders.get(o.orderId)!, captured, null, g.api);
    await applyProviderState(g.orders.get(o.orderId)!, failed, null, g.api);
    expect(
      (await f.db.payment.findUniqueOrThrow({ where: { id: o.paymentId } }))
        .status,
    ).toBe('SUCCEEDED');
  });
  it('serializes competing seat reservations without overselling', async () => {
    await f.db.cohort.update({
      where: { id: f.cohort.id },
      data: { capacity: 1 },
    });
    const a = await f.accepted(),
      b = await f.accepted(f.second.id),
      g = testGateway();
    const results = await Promise.allSettled([
      startCheckout(f.student.id, quote(a.id), g.api),
      startCheckout(f.second.id, quote(b.id), g.api),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(g.calls).toBe(1);
    expect(
      await f.db.enrollment.count({
        where: { cohortId: f.cohort.id, status: 'PENDING' },
      }),
    ).toBe(1);
  });
  it('places a late paid enrollment into review when capacity is exhausted', async () => {
    await f.db.cohort.update({
      where: { id: f.cohort.id },
      data: { capacity: 1 },
    });
    const a = await f.accepted(),
      b = await f.accepted(f.second.id),
      g = testGateway(),
      first = await startCheckout(f.student.id, quote(a.id), g.api);
    await f.db.enrollment.update({
      where: { id: first.enrollmentId },
      data: { reservedUntil: new Date(Date.now() - 1000) },
    });
    await startCheckout(f.second.id, quote(b.id), g.api);
    const captured = g.capture(first.orderId);
    const result = await applyProviderState(
      g.orders.get(first.orderId)!,
      captured,
      null,
      g.api,
    );
    expect(result.status).toBe('REVIEW_REQUIRED');
    await expect(
      paidAccess(f.student.id, first.enrollmentId),
    ).rejects.toMatchObject({ code: 'UNPAID' });
  });
  it('never repeats order creation after an ambiguous provider timeout', async () => {
    const a = await f.accepted(),
      g = testGateway();
    g.loseNextResponse();
    await expect(
      startCheckout(f.student.id, quote(a.id), g.api),
    ).rejects.toThrow('lost response');
    await expect(
      startCheckout(f.student.id, quote(a.id), g.api),
    ).rejects.toMatchObject({ code: 'ORDER_UNCERTAIN' });
    expect(g.calls).toBe(1);
    const payment = await f.db.payment.findFirstOrThrow({
      where: { enrollment: { applicationId: a.id } },
    });
    await reconcilePayment(payment.id, f.admin.id, g.api);
    expect(
      (await startCheckout(f.student.id, quote(a.id), g.api)).orderId,
    ).toBe([...g.orders.keys()][0]);
    expect(g.calls).toBe(1);
  });
  it('reconciles refunds without exposing a refund creation API', async () => {
    const a = await f.accepted(),
      g = testGateway(),
      o = await startCheckout(f.student.id, quote(a.id), g.api),
      p = g.capture(o.orderId);
    await applyProviderState(g.orders.get(o.orderId)!, p, null, g.api);
    p.amount_refunded = p.amount;
    p.status = 'refunded';
    expect(
      (await applyProviderState(g.orders.get(o.orderId)!, p, null, g.api))
        .status,
    ).toBe('CANCELLED');
    expect(
      (await f.db.payment.findUniqueOrThrow({ where: { id: o.paymentId } }))
        .status,
    ).toBe('REFUNDED');
  });
});
