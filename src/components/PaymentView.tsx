import React, { useState } from 'react';
import { Check, Copy, ExternalLink, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import {
  buildUpiPaymentUri,
  formatInr,
  Language,
  OrderRecord,
  StorefrontSettings,
  VALIDATION_PATTERNS,
} from '../types/store';
import { TRANSLATIONS } from '../i18n/translations';
import { UpiQrCode } from './UpiQrCode';

interface PaymentViewProps {
  order: OrderRecord;
  lookupToken: string;
  settings: StorefrontSettings;
  language: Language;
  onProofSubmitted: (updatedOrder: OrderRecord) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export const PaymentView: React.FC<PaymentViewProps> = ({
  order,
  lookupToken,
  settings,
  language,
  onProofSubmitted,
}) => {
  const t = TRANSLATIONS[language];
  const [utrNumber, setUtrNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!settings.safetyComplianceApproved) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="border border-neutral-300 rounded-xl p-8 bg-yellow-50 space-y-3">
          <div className="flex items-center gap-2 font-bold text-neutral-950">
            <ShieldAlert className="w-5 h-5" />
            <span>{t.launchNoticeTitle}</span>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">{t.checkoutUnavailableNote}</p>
        </div>
      </div>
    );
  }

  const upiUri = VALIDATION_PATTERNS.UPI_ID.test(settings.merchantUpiId.trim())
    ? buildUpiPaymentUri({
        upiId: settings.merchantUpiId,
        merchantName: settings.merchantDisplayName || settings.brandName,
        amount: order.totalInr,
        orderId: order.orderId,
      })
    : '';

  const handleCopyUpi = async () => {
    if (!settings.merchantUpiId) return;
    try {
      await navigator.clipboard.writeText(settings.merchantUpiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setErrorMsg('');
    if (!selected) {
      setFile(null);
      setPreviewUrl('');
      return;
    }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setErrorMsg('Only JPG, PNG, or WebP screenshots are accepted.');
      setFile(null);
      setPreviewUrl('');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setErrorMsg('Screenshot size must be 5 MB or less.');
      setFile(null);
      setPreviewUrl('');
      return;
    }
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanUtr = utrNumber.trim().toUpperCase();
    if (!VALIDATION_PATTERNS.UTR.test(cleanUtr)) {
      setErrorMsg('Please enter a valid 8–30 character alphanumeric UTR / UPI reference ID.');
      return;
    }
    if (!file) {
      setErrorMsg('Please attach your UPI payment screenshot (JPG, PNG, or WebP, max 5 MB).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('utrNumber', cleanUtr);
      formData.append('lookupToken', lookupToken);
      formData.append('phone', order.phone);
      formData.append('screenshot', file);

      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payment-proof`, {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as { order?: OrderRecord; error?: string };
      if (!res.ok || !data.order) {
        setErrorMsg(data.error || 'Could not upload payment proof. Please check your file and UTR.');
        setSubmitting(false);
        return;
      }

      onProofSubmitted(data.order);
    } catch {
      setErrorMsg('Network error while uploading screenshot. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Header Banner */}
      <div className="border border-neutral-200 rounded-xl p-5 sm:p-6 bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-neutral-500">Order Reference</p>
          <h1 className="font-mono-tabular text-xl font-bold text-neutral-950 mt-0.5">
            {order.orderId}
          </h1>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold text-neutral-500">Final Total Payable</p>
          <p className="font-mono-tabular text-2xl font-extrabold text-neutral-950 mt-0.5">
            {formatInr(order.totalInr)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Auto-Generated Dynamic UPI QR Card */}
        <div className="md:col-span-5 border border-neutral-200 rounded-xl p-5 sm:p-6 bg-white space-y-4">
          <h2 className="font-display text-lg font-bold text-neutral-950">{t.paymentTitle}</h2>
          <p className="text-xs text-neutral-600 leading-relaxed">{t.paymentSubtitle}</p>

          <UpiQrCode
            upiId={settings.merchantUpiId}
            merchantName={settings.merchantDisplayName || settings.brandName}
            amount={order.totalInr}
            orderId={order.orderId}
          />

          {upiUri && (
            <div className="space-y-2">
              <a
                href={upiUri}
                className="w-full min-h-[48px] py-3 px-4 bg-neutral-950 hover:bg-neutral-800 active:scale-[0.99] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all touch-manipulation"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Pay with Direct UPI App ({formatInr(order.totalInr)})</span>
              </a>
              <p className="text-[11px] text-center text-neutral-500">
                Works with Google Pay, PhonePe, Paytm, BHIM &amp; all Indian UPI apps
              </p>
            </div>
          )}

          {/* Separate Price, Delivery, and Total Breakdown */}
          <div className="space-y-2 pt-3 border-t border-neutral-200 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500">
                Product ({order.quantity} × {formatInr(order.unitPriceInr)})
              </span>
              <span className="font-mono-tabular font-semibold text-neutral-950">
                {formatInr(order.subtotalInr)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500">Delivery Charge</span>
              <span className="font-mono-tabular font-semibold text-neutral-950">
                {formatInr(order.deliveryChargeInr)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-200">
              <span className="font-bold text-neutral-950">Final Total</span>
              <span className="font-mono-tabular font-bold text-neutral-950 bg-yellow-200 px-2 py-0.5 rounded">
                {formatInr(order.totalInr)}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-200">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-neutral-500">Merchant Name</span>
              <span className="font-semibold text-neutral-950">
                {settings.merchantDisplayName || settings.brandName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-neutral-500">Merchant UPI ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono-tabular font-semibold text-neutral-950">
                  {settings.merchantUpiId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  aria-label="Copy Merchant UPI ID"
                  className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700"
                >
                  {copiedUpi ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-300 text-[11px] text-neutral-800 leading-relaxed">
            Verify that your UPI app shows <strong>{formatInr(order.totalInr)}</strong> and
            reference <strong>{order.orderId}</strong> before authorizing payment.
          </div>
        </div>

        {/* UTR & Screenshot Submission Form */}
        <form
          onSubmit={handleSubmit}
          className="md:col-span-7 border border-neutral-200 rounded-xl p-5 sm:p-6 bg-white space-y-5"
        >
          <div>
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Submit Payment Proof
            </h2>
            <p className="text-xs text-neutral-600 mt-1">
              Status after submission:{' '}
              <span className="font-semibold text-neutral-950">PENDING VERIFICATION</span>.
              Screenshots and UTRs are never auto-trusted — actual bank/UPI credit is verified
              manually before approval.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-red-300 bg-red-50 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <div>
            <label htmlFor="payment-utr" className="block text-xs font-semibold text-neutral-800 mb-1.5">
              {t.utrLabel} *
            </label>
            <input
              id="payment-utr"
              type="text"
              required
              maxLength={30}
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="e.g. 432819204512"
              className="w-full px-3.5 py-2.5 text-sm font-mono-tabular border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label
              htmlFor="payment-screenshot"
              className="block text-xs font-semibold text-neutral-800 mb-1.5"
            >
              {t.screenshotLabel} *
            </label>
            <label
              htmlFor="payment-screenshot"
              className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 hover:border-neutral-950 rounded-xl p-6 cursor-pointer transition-colors bg-neutral-50 text-center"
            >
              <Upload className="w-6 h-6 text-neutral-500 mb-2" />
              <span className="text-xs font-semibold text-neutral-800">
                {file ? file.name : 'Choose JPG, PNG, or WebP screenshot'}
              </span>
              <span className="text-[11px] text-neutral-500 mt-1">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Maximum file size: 5 MB'}
              </span>
              <input
                id="payment-screenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            {previewUrl && (
              <div className="mt-3 border border-neutral-200 rounded-lg p-2 bg-neutral-50">
                <img
                  src={previewUrl}
                  alt="Selected UPI payment screenshot preview"
                  className="max-h-48 mx-auto rounded object-contain"
                />
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
            <ShieldCheck className="w-4 h-4 text-neutral-800 shrink-0 mt-0.5" />
            <span>
              Your screenshot is stored in private, access-controlled storage accessible only to
              verified store administrators.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 bg-yellow-400 hover:bg-yellow-300 text-neutral-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Uploading Proof...' : t.submitProofBtn}
          </button>
        </form>
      </div>
    </div>
  );
};
