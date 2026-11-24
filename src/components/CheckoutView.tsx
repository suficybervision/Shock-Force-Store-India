import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Minus, Plus, ShieldAlert } from 'lucide-react';
import {
  calculateDeliveryCharge,
  formatInr,
  INDIAN_STATES,
  Language,
  OrderRecord,
  ProductData,
  StorefrontSettings,
  VALIDATION_PATTERNS,
} from '../types/store';
import { TRANSLATIONS } from '../i18n/translations';
import { auth } from '../lib/firebase';

interface CheckoutViewProps {
  product: ProductData;
  settings: StorefrontSettings;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  language: Language;
  onBack: () => void;
  onOrderCreated: (order: OrderRecord, lookupToken: string) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  product,
  settings,
  quantity,
  onQuantityChange,
  language,
  onBack,
  onOrderCreated,
}) => {
  const t = TRANSLATIONS[language];
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [state, setState] = useState('Karnataka');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [validatedReady, setValidatedReady] = useState(false);

  const idempotencyKey = useMemo(
    () => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const maxOrderQty = Math.max(1, Math.min(product.stock, 20));
  const safeQty = Math.max(1, Math.min(quantity, maxOrderQty));
  const subtotal = safeQty * product.priceInr;
  const deliveryCharge = calculateDeliveryCharge(settings, pinCode);
  const totalPayable = subtotal + deliveryCharge;

  const validateForm = (): string | null => {
    if (customerName.trim().length < 2 || customerName.trim().length > 100) {
      return 'Please enter your full name (2–100 characters).';
    }
    if (!VALIDATION_PATTERNS.INDIAN_PHONE.test(phone.trim())) {
      return 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
    }
    if (!VALIDATION_PATTERNS.INDIAN_PIN.test(pinCode.trim())) {
      return 'Please enter a valid 6-digit Indian PIN code.';
    }
    if (!state.trim()) {
      return 'Please select your State or Union Territory.';
    }
    if (city.trim().length < 2) {
      return 'Please enter your city or district.';
    }
    if (address.trim().length < 8 || address.trim().length > 300) {
      return 'Please enter your full delivery address (minimum 8 characters).';
    }
    if (product.stock < safeQty) {
      return `Only ${product.stock} units remain in stock.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setValidatedReady(false);

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (!settings.safetyComplianceApproved) {
      setErrorMsg('');
      setValidatedReady(true);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          phone: phone.trim(),
          state: state.trim(),
          city: city.trim(),
          pinCode: pinCode.trim(),
          address: address.trim(),
          landmark: landmark.trim(),
          quantity: safeQty,
          idempotencyKey,
          customerUid: auth.currentUser?.uid || 'guest',
        }),
      });

      const data = (await response.json()) as {
        order?: OrderRecord;
        lookupToken?: string;
        error?: string;
      };

      if (!response.ok || !data.order || !data.lookupToken) {
        setErrorMsg(data.error || 'Could not place order. Please review your details.');
        setSubmitting(false);
        return;
      }

      onOrderCreated(data.order, data.lookupToken);
    } catch {
      setErrorMsg('Network error while submitting order. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-950 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Product</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-7 border border-neutral-200 rounded-xl p-5 sm:p-8 bg-white space-y-5"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-neutral-950">{t.checkoutTitle}</h1>
            <p className="text-xs text-neutral-500 mt-1">
              Enter your Indian delivery details below. All required fields and PIN/mobile numbers
              are validated.
            </p>
          </div>

          {!settings.safetyComplianceApproved && (
            <div className="p-4 rounded-xl border border-neutral-300 bg-yellow-50 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-950">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{t.launchNoticeTitle}</span>
              </div>
              <p className="text-xs text-neutral-700 leading-relaxed">
                {t.checkoutUnavailableNote}
              </p>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-red-300 bg-red-50 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          {validatedReady && !settings.safetyComplianceApproved && (
            <div className="p-3.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-medium text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Your delivery address and mobile details are valid. Payment collection remains
                disabled until independent safety and legal compliance approval is confirmed by the
                owner.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="checkout-name" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.fullName} *
              </label>
              <input
                id="checkout-name"
                type="text"
                required
                maxLength={100}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full px-3.5 py-3 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label htmlFor="checkout-phone" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.mobileNumber} *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm font-mono-tabular text-neutral-600 bg-neutral-100 border border-r-0 border-neutral-300 rounded-l-lg">
                  +91
                </span>
                <input
                  id="checkout-phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-3 text-sm font-mono-tabular border border-neutral-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="checkout-pin" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.pinCodeLabel} *
              </label>
              <input
                id="checkout-pin"
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="560001"
                className="w-full px-3.5 py-3 text-sm font-mono-tabular border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label htmlFor="checkout-state" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.stateLabel} *
              </label>
              <select
                id="checkout-state"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="checkout-city" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.cityLabel} *
              </label>
              <input
                id="checkout-city"
                type="text"
                required
                maxLength={60}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                className="w-full px-3.5 py-3 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkout-address" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.fullAddressLabel} *
              </label>
              <textarea
                id="checkout-address"
                required
                rows={3}
                maxLength={300}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Flat No., Building, Street, Locality"
                className="w-full px-3.5 py-3 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkout-landmark" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t.landmarkLabel}
              </label>
              <input
                id="checkout-landmark"
                type="text"
                maxLength={120}
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Near Metro Station / Temple / Main Gate"
                className="w-full px-3.5 py-3 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[54px] py-4 px-6 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-neutral-950 font-extrabold text-base tracking-wide rounded-xl shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
          >
            {settings.safetyComplianceApproved && <Lock className="w-4 h-4" />}
            <span>{submitting ? 'Creating Order...' : t.buyNow}</span>
          </button>
        </form>

        {/* Order Summary Column */}
        <aside className="lg:col-span-5 border border-neutral-200 rounded-xl p-6 bg-neutral-50 space-y-5">
          <h2 className="font-display text-lg font-bold text-neutral-950">Order Summary</h2>
          <div className="flex items-center gap-4 pb-4 border-b border-neutral-200">
            <img
              src={product.images[0]}
              alt={product.title}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-lg object-cover border border-neutral-200 bg-white"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-950 truncate">{product.title}</p>
              <p className="text-xs text-neutral-600 mt-0.5 font-mono-tabular">
                {formatInr(product.priceInr)} / unit
              </p>
            </div>
            <span className="text-sm font-mono-tabular font-bold text-neutral-950">
              {formatInr(subtotal)}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <span className="text-xs font-semibold text-neutral-700">{t.quantity}</span>
            <div className="inline-flex items-center border border-neutral-300 rounded-lg bg-white">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, safeQty - 1))}
                disabled={safeQty <= 1}
                aria-label="Decrease quantity"
                className="w-10 h-10 flex items-center justify-center text-neutral-800 hover:bg-neutral-100 rounded-l-lg disabled:opacity-40"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center text-sm font-mono-tabular font-bold">
                {safeQty}
              </span>
              <button
                type="button"
                onClick={() => onQuantityChange(Math.min(maxOrderQty, safeQty + 1))}
                disabled={safeQty >= maxOrderQty}
                aria-label="Increase quantity"
                className="w-10 h-10 flex items-center justify-center text-neutral-800 hover:bg-neutral-100 rounded-r-lg disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>
                Product Price ({safeQty} × {formatInr(product.priceInr)})
              </span>
              <span className="font-mono-tabular font-medium text-neutral-950">
                {formatInr(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>
                {t.deliveryCharge}
                {settings.deliveryMode === 'pincode' && VALIDATION_PATTERNS.INDIAN_PIN.test(pinCode)
                  ? ` (${pinCode})`
                  : ''}
              </span>
              <span className="font-mono-tabular font-medium text-neutral-950">
                {formatInr(deliveryCharge)}
              </span>
            </div>
            <div className="pt-3 border-t border-neutral-200 flex justify-between text-base font-bold text-neutral-950">
              <span>{t.totalPayable}</span>
              <span className="font-mono-tabular">{formatInr(totalPayable)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-200 text-xs text-neutral-600 leading-relaxed space-y-1.5">
            <p className="font-semibold text-neutral-900">UPI Payment &amp; Verification</p>
            <p>
              {settings.safetyComplianceApproved
                ? `Next step opens the UPI QR Scanner and direct UPI App payment option (${settings.merchantUpiId}) for ${formatInr(totalPayable)}. After payment, upload your UTR and screenshot to receive your unique Order Tracking Code.`
                : 'Payment collection is currently turned off in Admin Settings.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
