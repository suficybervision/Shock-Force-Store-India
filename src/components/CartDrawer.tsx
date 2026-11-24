import React, { useState } from 'react';
import { Minus, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  calculateDeliveryCharge,
  formatInr,
  Language,
  ProductData,
  StorefrontSettings,
  VALIDATION_PATTERNS,
} from '../types/store';
import { TRANSLATIONS } from '../i18n/translations';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  product: ProductData;
  settings: StorefrontSettings;
  quantity: number;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
  onProceedToCheckout: () => void;
  language: Language;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  product,
  settings,
  quantity,
  onUpdateQuantity,
  onRemove,
  onProceedToCheckout,
  language,
}) => {
  const [pinCheck, setPinCheck] = useState('');
  const t = TRANSLATIONS[language];

  if (!open) return null;

  const maxAllowed = Math.max(0, Math.min(product.stock, 20));
  const validQty = quantity > 0 && quantity <= maxAllowed ? quantity : 0;
  const subtotal = validQty * product.priceInr;
  const deliveryCharge = validQty > 0 ? calculateDeliveryCharge(settings, pinCheck) : 0;
  const totalPayable = subtotal + deliveryCharge;
  const pinValid = VALIDATION_PATTERNS.INDIAN_PIN.test(pinCheck.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-neutral-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={t.cartTitle}
    >
      <div className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl border-l border-neutral-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-neutral-950">
            {t.cartTitle} <span className="font-mono-tabular text-neutral-500">({validQty})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!settings.safetyComplianceApproved && (
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-950">
                <ShieldAlert className="w-4 h-4 shrink-0 text-neutral-700" />
                <span>{t.launchNoticeTitle}</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">{t.checkoutUnavailableNote}</p>
            </div>
          )}

          {validQty === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-neutral-500">{t.cartEmpty}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex gap-4 pb-5 border-b border-neutral-200">
                <img
                  src={product.images[0]}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-lg object-cover border border-neutral-200 shrink-0 bg-neutral-100"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-neutral-950 leading-snug">
                      {language === 'hi' && product.titleHi ? product.titleHi : product.title}
                    </h3>
                    <button
                      type="button"
                      onClick={onRemove}
                      aria-label="Remove item from cart"
                      className="p-1 text-neutral-400 hover:text-red-600 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm font-mono-tabular font-semibold text-neutral-950">
                    {formatInr(product.priceInr)} <span className="text-xs text-neutral-500 font-normal">/ unit</span>
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center border border-neutral-300 rounded-lg bg-white">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(Math.max(0, validQty - 1))}
                        aria-label="Decrease quantity"
                        className="w-9 h-9 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-l-lg"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-mono-tabular font-semibold">
                        {validQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(Math.min(maxAllowed, validQty + 1))}
                        disabled={validQty >= maxAllowed}
                        aria-label="Increase quantity"
                        className="w-9 h-9 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-r-lg disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-mono-tabular font-bold text-neutral-950">
                      {formatInr(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PIN-based Delivery Estimator */}
              {settings.deliveryMode === 'pincode' && (
                <div className="space-y-2">
                  <label
                    htmlFor="cart-pin-estimator"
                    className="block text-xs font-semibold text-neutral-700"
                  >
                    {t.deliveryEstimateLabel}
                  </label>
                  <input
                    id="cart-pin-estimator"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinCheck}
                    onChange={(e) => setPinCheck(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t.checkPinPlaceholder}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono-tabular"
                  />
                  {pinCheck.length > 0 && !pinValid && (
                    <p className="text-xs text-neutral-500">Enter a valid 6-digit Indian PIN code.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-6 border-t border-neutral-200 bg-neutral-50 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>
                {t.subtotal} ({validQty} × {formatInr(product.priceInr)})
              </span>
              <span className="font-mono-tabular font-medium text-neutral-950">
                {formatInr(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>
                {t.deliveryCharge}
                {settings.deliveryMode === 'pincode' && pinValid ? ` (PIN ${pinCheck})` : ''}
              </span>
              <span className="font-mono-tabular font-medium text-neutral-950">
                {formatInr(deliveryCharge)}
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-200 flex justify-between text-base font-bold text-neutral-950">
              <span>{t.totalPayable}</span>
              <span className="font-mono-tabular">{formatInr(totalPayable)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={validQty <= 0 || product.stock < validQty}
            onClick={() => {
              onClose();
              onProceedToCheckout();
            }}
            className="w-full py-3.5 px-5 rounded-xl text-sm font-extrabold transition-colors bg-yellow-400 text-neutral-950 hover:bg-yellow-300 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed touch-manipulation"
          >
            {t.proceedToCheckout}
          </button>
          {!settings.safetyComplianceApproved && (
            <p className="text-[11px] text-neutral-600 text-center leading-snug">
              {t.checkoutUnavailableNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
