import React, { useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, PackageCheck, Search, ShieldAlert, Truck, XCircle } from 'lucide-react';
import {
  formatInr,
  Language,
  OrderRecord,
  OrderTrackingInfo,
  VALIDATION_PATTERNS,
} from '../types/store';
import { TRANSLATIONS } from '../i18n/translations';
import { submitReviewHybrid, toTrackingInfo, trackOrderHybrid } from '../lib/orderService';

interface OrderLookupViewProps {
  initialOrder?: OrderRecord | null;
  initialToken?: string;
  justSubmitted?: boolean;
  language: Language;
  onRetryPayment: (order: OrderRecord, token: string) => void;
}

export const OrderLookupView: React.FC<OrderLookupViewProps> = ({
  initialOrder = null,
  initialToken = '',
  justSubmitted = false,
  language,
  onRetryPayment,
}) => {
  const t = TRANSLATIONS[language];
  const [orderIdInput, setOrderIdInput] = useState(initialOrder?.orderId || '');
  const [trackingInfo, setTrackingInfo] = useState<OrderTrackingInfo | null>(
    initialOrder ? toTrackingInfo(initialOrder) : null
  );
  const [sessionOrder, setSessionOrder] = useState<OrderRecord | null>(initialOrder);
  const [lookupToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Verified review submission state (requires entering checkout mobile number separately)
  const [reviewPhone, setReviewPhone] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setReviewMsg('');

    const cleanOrderId = orderIdInput.trim().toUpperCase();
    if (!VALIDATION_PATTERNS.ID.test(cleanOrderId) || cleanOrderId.length < 6) {
      setErrorMsg('Please enter a valid unique Order ID (e.g. SSI-20261124-001).');
      return;
    }

    setLoading(true);
    try {
      const tracked = await trackOrderHybrid(cleanOrderId);
      if (!tracked) {
        setTrackingInfo(null);
        setSessionOrder(null);
        setErrorMsg('No order found with that Order ID.');
      } else {
        setTrackingInfo(tracked);
        if (sessionOrder && sessionOrder.orderId !== tracked.orderId) {
          setSessionOrder(null);
        }
      }
    } catch {
      setErrorMsg('Unable to track order right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingInfo || submittingReview) return;
    if (!VALIDATION_PATTERNS.INDIAN_PHONE.test(reviewPhone.trim())) {
      setReviewMsg('Enter the 10-digit mobile number used at checkout to verify purchase.');
      return;
    }
    setSubmittingReview(true);
    setReviewMsg('');
    try {
      const message = await submitReviewHybrid({
        orderId: trackingInfo.orderId,
        phone: reviewPhone.trim(),
        rating,
        comment: reviewComment.trim(),
      });
      setReviewMsg(message);
      setReviewComment('');
    } catch (err) {
      setReviewMsg(
        err instanceof Error && err.message ? err.message : 'Could not submit review.'
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStatusIcon = (status: OrderRecord['status']) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-700" />;
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-700" />;
      case 'SHIPPED':
        return <Truck className="w-5 h-5 text-blue-700" />;
      case 'DELIVERED':
        return <PackageCheck className="w-5 h-5 text-emerald-700" />;
      default:
        return <Clock className="w-5 h-5 text-amber-700" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {justSubmitted && trackingInfo && (
        <div className="border-2 border-yellow-400 bg-yellow-50 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 font-bold text-neutral-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Payment Proof Submitted — Your Unique Order Tracking Code</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-neutral-200">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Unique Order Code
              </p>
              <p className="font-mono-tabular text-2xl font-extrabold text-neutral-950">
                {trackingInfo.orderId}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(trackingInfo.orderId);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                } catch {
                  // Ignore clipboard errors
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-yellow-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied!' : 'Copy Order Code'}</span>
            </button>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed">
            Save your unique Order Code <strong className="font-mono-tabular">{trackingInfo.orderId}</strong>{' '}
            to track verification, approval, and shipping status anytime on the <strong>Track Order</strong> page.
            Our team verifies actual UPI/bank credit manually before dispatch.
          </p>
        </div>
      )}

      {/* Track Order Form */}
      <form
        onSubmit={handleLookup}
        className="border border-neutral-200 rounded-xl p-6 bg-white space-y-4"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-950">{t.trackOrderTitle}</h1>
          <p className="text-xs text-neutral-600 mt-1">{t.trackOrderDesc}</p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-red-300 bg-red-50 text-xs font-medium text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="lookup-order-id" className="block text-xs font-semibold text-neutral-800 mb-1.5">
              {t.orderIdLabel}
            </label>
            <input
              id="lookup-order-id"
              type="text"
              required
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="SSI-20261124-001"
              className="w-full px-3.5 py-3 text-sm font-mono-tabular border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div className="sm:self-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-neutral-950 text-sm font-extrabold rounded-xl transition-colors disabled:opacity-60 touch-manipulation"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'TRACKING...' : t.lookupBtn}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Non-PII Order Tracking Card */}
      {trackingInfo && (
        <div className="border border-neutral-200 rounded-xl p-6 bg-white space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200">
            <div>
              <p className="text-xs text-neutral-500">Order ID</p>
              <h2 className="font-mono-tabular text-xl font-bold text-neutral-950">
                {trackingInfo.orderId}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Order Date: {new Date(trackingInfo.createdAt).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-100 border border-neutral-200">
              {renderStatusIcon(trackingInfo.status)}
              <span className="text-sm font-bold text-neutral-950">
                {trackingInfo.orderStatus}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-xs text-neutral-500">Order ID</span>
                <span className="text-xs font-mono-tabular font-bold text-neutral-950">
                  {trackingInfo.orderId}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-neutral-500">Order Date</span>
                <span className="text-xs font-mono-tabular text-neutral-900">
                  {new Date(trackingInfo.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-neutral-500">Payment Status</span>
                <span className="text-xs font-semibold text-neutral-950">
                  {trackingInfo.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-neutral-500">Order Status</span>
                <span className="text-xs font-semibold text-neutral-950">
                  {trackingInfo.orderStatus}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-neutral-500">Shipping Status</span>
                <span className="text-xs font-semibold text-neutral-950">
                  {trackingInfo.shippingStatus}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-neutral-500">Tracking ID</span>
                <span className="text-xs font-mono-tabular font-semibold text-neutral-950">
                  {trackingInfo.trackingId
                    ? `${trackingInfo.courierName ? `${trackingInfo.courierName} · ` : ''}${trackingInfo.trackingId}`
                    : 'Not assigned yet'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <p className="text-xs font-semibold text-neutral-500">Order Summary</p>
              <p className="text-xs font-semibold text-neutral-950">
                {trackingInfo.productTitle} × {trackingInfo.quantity}
              </p>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Product Subtotal</span>
                <span className="font-mono-tabular">{formatInr(trackingInfo.subtotalInr)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Delivery Charge</span>
                <span className="font-mono-tabular">{formatInr(trackingInfo.deliveryChargeInr)}</span>
              </div>
              <div className="pt-2 border-t border-neutral-200 flex justify-between text-sm font-bold text-neutral-950">
                <span>Final Total</span>
                <span className="font-mono-tabular">{formatInr(trackingInfo.totalInr)}</span>
              </div>
            </div>
          </div>

          {trackingInfo.status === 'REJECTED' && (
            <div className="p-4 rounded-lg border border-red-300 bg-red-50 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                <ShieldAlert className="w-4 h-4" />
                <span>Payment Verification Rejected</span>
              </div>
              <p className="text-xs text-red-800">{trackingInfo.rejectionReason}</p>
              {sessionOrder && sessionOrder.orderId === trackingInfo.orderId && lookupToken && (
                <button
                  type="button"
                  onClick={() => onRetryPayment(sessionOrder, lookupToken)}
                  className="px-4 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-lg"
                >
                  Re-submit UPI Payment Proof
                </button>
              )}
            </div>
          )}

          {trackingInfo.status === 'AWAITING_PAYMENT' &&
            sessionOrder &&
            sessionOrder.orderId === trackingInfo.orderId &&
            lookupToken && (
              <div className="p-4 rounded-lg border border-yellow-300 bg-yellow-50 flex items-center justify-between gap-4">
                <p className="text-xs text-neutral-800">
                  Payment proof has not been submitted yet for this order.
                </p>
                <button
                  type="button"
                  onClick={() => onRetryPayment(sessionOrder, lookupToken)}
                  className="px-4 py-2 bg-yellow-400 text-neutral-950 text-xs font-bold rounded-lg shrink-0"
                >
                  Complete UPI Payment
                </button>
              </div>
            )}

          {trackingInfo.status === 'DELIVERED' && (
            <form
              onSubmit={handleReviewSubmit}
              className="pt-5 border-t border-neutral-200 space-y-3"
            >
              <h3 className="text-sm font-bold text-neutral-950">
                Leave a Verified Customer Review
              </h3>
              {reviewMsg && (
                <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  {reviewMsg}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="review-phone" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Checkout Mobile Number (for verification)
                  </label>
                  <input
                    id="review-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={reviewPhone}
                    onChange={(e) => setReviewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="review-rating" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Rating
                  </label>
                  <select
                    id="review-rating"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                rows={3}
                required
                minLength={5}
                maxLength={1000}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your honest feedback on build quality, delivery, and packaging..."
                className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-lg"
              >
                {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
