import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import drafts from '../../prisma/draft-courses.json';
import type {
  Gateway,
  ProviderOrder,
  ProviderPayment,
} from '@/lib/payments/gateway';
export async function fixture(capacity = 3, assessmentRequired = false) {
  const db = getDb(),
    prefix = `p3${randomUUID().replaceAll('-', '')}`;
  const student = await db.user.create({
    data: {
      id: `${prefix}s1`,
      name: 'Isolated test applicant',
      role: 'STUDENT',
    },
  });
  const second = await db.user.create({
    data: {
      id: `${prefix}s2`,
      name: 'Isolated second applicant',
      role: 'STUDENT',
    },
  });
  const admin = await db.user.create({
    data: { id: `${prefix}a`, role: 'ADMIN' },
  });
  const draft = drafts[assessmentRequired ? 2 : 0];
  const { modules, ...content } = draft;
  const course = await db.course.create({
    data: {
      ...content,
      track: assessmentRequired ? 'AI_ENGINEERING' : 'QA_SDET',
      id: `${prefix}course`,
      slug: `test-${prefix}`,
      title: 'Isolated contract test program',
      status: 'PUBLISHED',
      previewVisible: false,
      contentSource:
        'Isolated test fixture only, not approved business content',
      contentApprovedAt: new Date(),
      priceMinor: 123400,
      priceApprovedAt: new Date(),
      termsApprovedAt: new Date(),
      termsVersion: 'test-v1',
      enrollmentTerms:
        'Isolated test agreement. Not a real enrollment offer. '.repeat(4),
      refundPolicy:
        'Isolated test refund disclosure, not a real policy. '.repeat(3),
      assessmentRequired,
      modules: { create: modules },
    },
  });
  const cohort = await db.cohort.create({
    data: {
      id: `${prefix}cohort`,
      courseId: course.id,
      name: 'Isolated future test cohort',
      startsAt: new Date(Date.now() + 30 * 86400000),
      endsAt: new Date(Date.now() + 200 * 86400000),
      capacity,
      status: 'PUBLISHED',
      admissionsOpen: true,
    },
  });
  const details = {
    fullName: 'Test Learner',
    education: [
      { qualification: 'Test qualification', institution: '', year: '' },
    ],
    background: 'NON_TECHNICAL' as const,
    backgroundDetails:
      'An isolated learner background used only for automated verification.',
    careerGoals:
      'I want to practice software skills through a structured learning path and supervised work.',
    availability: '10_20' as const,
    timezone: 'Asia/Kolkata',
    assessmentAnswers: [
      'A dictionary maps each key to a count and can increment repeated values.',
      'A separate validation dataset can reveal overfitting and generalization problems.',
      'I would verify the response schema, status, expected data and failure cases.',
    ],
    consent: true,
  };
  async function accepted(userId = student.id) {
    return db.application.create({
      data: {
        userId,
        courseId: course.id,
        status: 'ACCEPTED',
        details,
        consentedAt: new Date(),
        consentVersion: 'application-v1',
        assessmentStatus: 'PASSED',
        admittedCourseVersion: course.contentVersion,
      },
    });
  }
  async function cleanup() {
    const apps = await db.application.findMany({
      where: { courseId: course.id },
      select: { id: true },
    });
    const enrolls = await db.enrollment.findMany({
      where: { cohortId: cohort.id },
      select: { id: true },
    });
    const pays = await db.payment.findMany({
      where: { enrollmentId: { in: enrolls.map((e) => e.id) } },
      select: { id: true },
    });
    await db.paymentEvent.deleteMany({
      where: { paymentId: { in: pays.map((p) => p.id) } },
    });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: [student.id, second.id, admin.id] } },
          {
            entityId: {
              in: [
                course.id,
                cohort.id,
                ...apps.map((a) => a.id),
                ...enrolls.map((e) => e.id),
                ...pays.map((p) => p.id),
              ],
            },
          },
        ],
      },
    });
    await db.payment.deleteMany({
      where: { id: { in: pays.map((p) => p.id) } },
    });
    await db.enrollment.deleteMany({ where: { cohortId: cohort.id } });
    await db.application.deleteMany({ where: { courseId: course.id } });
    await db.cohort.delete({ where: { id: cohort.id } });
    await db.courseRevision.deleteMany({ where: { courseId: course.id } });
    await db.course.delete({ where: { id: course.id } });
    await db.user.deleteMany({
      where: { id: { in: [student.id, second.id, admin.id] } },
    });
  }
  return {
    db,
    student,
    second,
    admin,
    course,
    cohort,
    details,
    accepted,
    cleanup,
  };
}
export function testGateway() {
  const orders = new Map<string, ProviderOrder>(),
    payments = new Map<string, ProviderPayment>();
  let calls = 0,
    failAfterCreate = false;
  const api: Gateway = {
    ready: () => true,
    publicKey: () => 'rzp_test_contract_only',
    signingSecret: () => 'isolated-contract-signing-secret',
    webhookSecret: () => 'isolated-contract-webhook-secret',
    createOrder: async (input) => {
      calls++;
      const order: ProviderOrder = {
        ...input,
        id: `order_${randomUUID().replaceAll('-', '')}`,
        status: 'created',
        amount_paid: 0,
      };
      orders.set(order.id, order);
      if (failAfterCreate)
        throw new Error('Simulated lost response in an isolated contract test');
      return order;
    },
    getOrder: async (id) => {
      const o = orders.get(id);
      if (!o) throw new Error('Missing test order');
      return o;
    },
    getPayment: async (id) => {
      const p = payments.get(id);
      if (!p) throw new Error('Missing test payment');
      return p;
    },
    findOrder: async (receipt) =>
      [...orders.values()].find((o) => o.receipt === receipt) ?? null,
    orderPayments: async (id) =>
      [...payments.values()].filter((p) => p.order_id === id),
  };
  function capture(
    orderId: string,
    status: ProviderPayment['status'] = 'captured',
  ) {
    const order = orders.get(orderId)!;
    const p: ProviderPayment = {
      id: `pay_${randomUUID().replaceAll('-', '')}`,
      order_id: orderId,
      amount: order.amount,
      currency: order.currency,
      status,
      amount_refunded: 0,
    };
    payments.set(p.id, p);
    order.status = status === 'captured' ? 'paid' : 'attempted';
    order.amount_paid = status === 'captured' ? order.amount : 0;
    return p;
  }
  return {
    api,
    orders,
    payments,
    capture,
    get calls() {
      return calls;
    },
    loseNextResponse() {
      failAfterCreate = true;
    },
  };
}
