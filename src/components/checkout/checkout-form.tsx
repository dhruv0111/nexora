'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LockKeyhole, ShieldCheck, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
type RazorResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorResponse) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => {
      open(): void;
      on(event: string, callback: () => void): void;
    };
  }
}
async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const old = document.querySelector<HTMLScriptElement>('#razorpay-checkout');
    if (old) {
      old.addEventListener('load', () => resolve(), { once: true });
      old.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Provider checkout could not load.'));
    };
    document.head.appendChild(script);
  });
  if (!window.Razorpay) throw new Error('Provider checkout is unavailable.');
}
export type FeeReview = {
  applicationId: string;
  title: string;
  amountMinor: number | null;
  currency: string;
  priceVersion: number;
  termsVersion: string | null;
  terms: string | null;
  refund: string | null;
  accepted: boolean;
  approved: boolean;
  assessmentPassed: boolean;
  enabled: boolean;
  existingPaymentId: string | null;
  existingEnrollmentId: string | null;
  enrollmentStatus: string | null;
  cohorts: { id: string; name: string; start: string; available: number }[];
  cohortId: string | null;
};
function format(amount: number | null, currency: string) {
  return amount === null
    ? 'Awaiting approval'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(
        amount / 100,
      );
}
export function CheckoutForm({ review }: { review: FeeReview }) {
  const router = useRouter();
  const [cohort, setCohort] = useState(
      review.cohortId ?? review.cohorts[0]?.id ?? '',
    ),
    [agree, setAgree] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [paymentId, setPaymentId] = useState(review.existingPaymentId);
  const ready =
    !['REVIEW_REQUIRED', 'CANCELLED'].includes(review.enrollmentStatus ?? '') &&
    review.accepted &&
    review.assessmentPassed &&
    review.approved &&
    review.enabled &&
    !!cohort &&
    agree;
  async function reconcile() {
    if (!paymentId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/payments/${paymentId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error);
        return;
      }
      router.push(`/enrollments/${result.enrollmentId}`);
    } catch {
      setMessage(
        'Unable to refresh payment status. No new order was created. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!ready || !review.termsVersion) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: review.applicationId,
          cohortId: cohort,
          priceVersion: review.priceVersion,
          termsVersion: review.termsVersion,
          agree,
        }),
      });
      const order = await response.json();
      if (!response.ok) {
        setMessage(order.error);
        setBusy(false);
        return;
      }
      setPaymentId(order.paymentId);
      if (order.status === 'ACTIVE') {
        router.push(`/enrollments/${order.enrollmentId}`);
        return;
      }
      await loadRazorpay();
      const checkout = new window.Razorpay!({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Nexora · Sandbox',
        description: review.title,
        theme: { color: '#A855F7' },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage(
              'Checkout closed. Enrollment remains pending until a payment is verified. Use refresh status if a payment may have completed.',
            );
          },
        },
        handler: async (result) => {
          try {
            const verify = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...result, paymentId: order.paymentId }),
            });
            const status = await verify.json();
            if (!verify.ok) {
              setMessage(status.error);
              setBusy(false);
              return;
            }
            router.push(`/enrollments/${status.enrollmentId}`);
          } catch {
            setMessage(
              'Your payment result needs server reconciliation. Refresh status before attempting anything else.',
            );
            setBusy(false);
          }
        },
      });
      checkout.on('payment.failed', () => {
        setBusy(false);
        setMessage(
          'The provider reported a failed attempt. Your enrollment is not activated. Retry uses the same order; refresh status first.',
        );
      });
      checkout.open();
    } catch {
      setMessage(
        'The checkout could not be opened. No access was granted. Refresh the existing order status before retrying.',
      );
      setBusy(false);
    }
  }
  return (
    <div className="checkout-layout">
      <div className="checkout-main">
        <div className="checkout-section-title">
          <span>01</span>
          <div>
            <h2>Admissions & cohort</h2>
            <p>Your eligibility is checked on the server.</p>
          </div>
        </div>
        <div className="checkout-eligibility">
          <span
            className={
              review.accepted ? 'eligibility-ok' : 'eligibility-pending'
            }
          >
            <Check size={16} />
            {review.accepted
              ? 'Admissions accepted'
              : 'Admissions approval required'}
          </span>
          {!review.assessmentPassed && (
            <p>The prerequisite assessment must be reviewed and passed.</p>
          )}
        </div>
        <label htmlFor="checkout-cohort">Choose an approved cohort</label>
        <select
          className="input"
          id="checkout-cohort"
          value={cohort}
          disabled={!!review.cohortId}
          onChange={(e) => setCohort(e.target.value)}
        >
          {!review.cohorts.length && (
            <option value="">No approved cohort is currently available</option>
          )}
          {review.cohorts.map((c) => (
            <option
              value={c.id}
              key={c.id}
              disabled={c.available <= 0 && c.id !== review.cohortId}
            >
              {c.name} ·{' '}
              {new Date(c.start).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
              })}{' '}
              · {c.available > 0 ? 'Available' : 'No unreserved seats'}
            </option>
          ))}
        </select>
        <p className="checkout-help">
          Dates, remaining capacity, and admissions eligibility are validated
          again before any order is created.
        </p>
        <div className="checkout-section-title">
          <span>02</span>
          <div>
            <h2>Read the commitments</h2>
            <p>Know the terms before you agree.</p>
          </div>
        </div>
        {review.terms && review.refund ? (
          <div className="checkout-terms">
            <details open>
              <summary>Enrollment terms · {review.termsVersion}</summary>
              <p>{review.terms}</p>
            </details>
            <details>
              <summary>Refund disclosure</summary>
              <p>{review.refund}</p>
            </details>
          </div>
        ) : (
          <div className="workflow-notice">
            Approved enrollment terms and refund disclosure have not been
            supplied. Payments remain disabled.
          </div>
        )}
        <label className="application-consent">
          <input
            type="checkbox"
            checked={agree}
            disabled={!review.approved}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>
            I have reviewed the approved fee and the enrollment/refund terms
            displayed above and agree to version{' '}
            {review.termsVersion ?? 'pending approval'}. I understand this
            checkout is sandbox-only.
          </span>
        </label>
        <div className="checkout-section-title">
          <span>03</span>
          <div>
            <h2>Secure provider checkout</h2>
            <p>Payment details stay with Razorpay.</p>
          </div>
        </div>
        <p className="checkout-help">
          Card numbers, CVV, and bank details are never collected or stored by
          Nexora. Production payments, financing, installment plans, and refund
          operations are disabled in this phase.
        </p>
      </div>
      <aside className="order-summary">
        <p className="eyebrow">A CLEAR NEXT STEP</p>
        <h2>Enrollment summary</h2>
        <div className="summary-course">
          <span>
            <ShieldCheck size={25} />
          </span>
          <div>
            <h3>{review.title}</h3>
            <p>Full program · reviewed admission</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Approved course fee</dt>
            <dd>{format(review.amountMinor, review.currency)}</dd>
          </div>
          <div>
            <dt>Additional platform charges</dt>
            <dd>
              {review.amountMinor !== null ? format(0, review.currency) : '—'}
            </dd>
          </div>
          <div className="summary-total">
            <dt>Total approved amount</dt>
            <dd>{format(review.amountMinor, review.currency)}</dd>
          </div>
        </dl>
        <p className="checkout-help">
          No discounts, installments, or additional charges are invented. Tax
          treatment must be stated in the approved enrollment terms.
        </p>
        {['REVIEW_REQUIRED', 'CANCELLED'].includes(
          review.enrollmentStatus ?? '',
        ) && (
          <div className="workflow-notice">
            This enrollment requires operator review or has been cancelled. Do
            not make another payment.
          </div>
        )}
        {!review.enabled && (
          <div className="workflow-notice">
            Sandbox payments are not configured. No payment can be taken.
          </div>
        )}
        {!review.accepted && (
          <div className="workflow-notice">
            Your application must be accepted before enrollment checkout can
            proceed.
          </div>
        )}
        {message && (
          <div className="workflow-error" role="alert">
            {message}
          </div>
        )}
        <Button
          disabled={!ready || busy}
          onClick={() => void pay()}
          className="checkout-pay"
        >
          <LockKeyhole size={17} />
          {busy ? 'Checking with the provider…' : 'Continue to Sandbox Payment'}
        </Button>
        {paymentId && (
          <Button
            variant="secondary"
            disabled={busy || !review.enabled}
            onClick={() => void reconcile()}
          >
            <RefreshCw size={15} />
            Refresh payment status
          </Button>
        )}
        <p className="payment-critical-note">
          A browser callback never activates enrollment. Nexora verifies the
          provider’s captured payment and order on the server.
        </p>
        <Link href={`/applications/${review.applicationId}`}>
          Back to application
        </Link>
      </aside>
    </div>
  );
}
