import React, { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronDown, Clock, Minus, Plus, Star } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppView, StorefrontHeader } from './components/StorefrontHeader';
import { ProductGallery } from './components/ProductGallery';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutView } from './components/CheckoutView';
import { PaymentView } from './components/PaymentView';
import { OrderLookupView } from './components/OrderLookupView';
import { AdminDashboard } from './components/AdminDashboard';
import { PolicyModal } from './components/PolicyModal';
import { db } from './lib/firebase';
import {
  calculateDeliveryCharge,
  DEFAULT_PRODUCT,
  DEFAULT_SETTINGS,
  formatInr,
  Language,
  OrderRecord,
  ProductData,
  StorefrontSettings,
  VALIDATION_PATTERNS,
  VerifiedReview,
} from './types/store';
import { TRANSLATIONS } from './i18n/translations';

const CART_STORAGE_KEY = 'shock_shoe_india_cart_qty';

function readPersistedCartQty(): number {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 20) return parsed;
  } catch {
    // Ignore storage errors
  }
  return 0;
}

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [activeView, setActiveView] = useState<AppView>('storefront');
  const [product, setProduct] = useState<ProductData>(DEFAULT_PRODUCT);
  const [settings, setSettings] = useState<StorefrontSettings>(DEFAULT_SETTINGS);
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);

  // Product PDP quantity & persisted cart
  const [pdpQty, setPdpQty] = useState(1);
  const [cartQty, setCartQty] = useState<number>(() => readPersistedCartQty());
  const [cartOpen, setCartOpen] = useState(false);

  // PIN estimator on PDP
  const [pinEstimate, setPinEstimate] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [policyModal, setPolicyModal] = useState<{ title: string; content: string } | null>(null);

  // Active order flow state
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [activeOrderToken, setActiveOrderToken] = useState<string>('');
  const [justSubmittedProof, setJustSubmittedProof] = useState(false);

  const t = TRANSLATIONS[language];

  // Persist cart quantity across refreshes
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, String(cartQty));
    } catch {
      // Ignore storage errors
    }
  }, [cartQty]);

  // Clamp cart quantity against available stock
  useEffect(() => {
    if (cartQty > product.stock) {
      setCartQty(Math.max(0, product.stock));
    }
  }, [cartQty, product.stock]);

  // Hydrate storefront from backend + Firestore
  const loadStorefront = useCallback(async () => {
    try {
      const res = await fetch('/api/storefront');
      if (res.ok) {
        const data = (await res.json()) as {
          product?: ProductData;
          settings?: StorefrontSettings;
          reviews?: VerifiedReview[];
        };
        if (data.product) setProduct(data.product);
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
      }
    } catch {
      // Fall back cleanly to defaults or Firestore
    }

    try {
      const [prodSnap, setSnap] = await Promise.all([
        getDoc(doc(db, 'products', 'shock-shoe')),
        getDoc(doc(db, 'settings', 'storefront')),
      ]);
      if (prodSnap.exists()) {
        const d = prodSnap.data() as ProductData;
        const hasLegacyAiImages = d.images?.some((img) => img.startsWith('/src/assets/images/'));
        if (d.title && typeof d.priceInr === 'number' && !hasLegacyAiImages) {
          setProduct((prev) => ({ ...prev, ...d }));
        }
      }
      if (setSnap.exists()) {
        const s = setSnap.data() as StorefrontSettings;
        if (s.brandName && s.merchantUpiId) {
          const isLegacyDisabledBanner =
            s.announcementText?.includes('Checkout paused') ||
            s.announcementText?.includes('Sales Paused') ||
            s.announcementText?.includes('Launch Coming Soon') ||
            s.announcementText?.includes('Payment collection disabled');
          const cleanAnnouncement = isLegacyDisabledBanner
            ? DEFAULT_SETTINGS.announcementText
            : s.announcementText;
          const cleanAnnouncementHi =
            isLegacyDisabledBanner || s.announcementTextHi?.includes('चेकआउट बंद') || s.announcementTextHi?.includes('भुगतान बंद')
              ? DEFAULT_SETTINGS.announcementTextHi
              : s.announcementTextHi;
          setSettings((prev) => ({
            ...prev,
            ...s,
            safetyComplianceApproved: isLegacyDisabledBanner ? true : s.safetyComplianceApproved,
            announcementText: cleanAnnouncement || prev.announcementText,
            announcementTextHi: cleanAnnouncementHi || prev.announcementTextHi,
          }));
        }
      }
    } catch {
      // Public fallback already loaded via /api/storefront
    }
  }, []);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

  const handleNavigate = (view: AppView, sectionId?: string) => {
    setJustSubmittedProof(false);
    setActiveView(view);
    if (view === 'storefront' && sectionId) {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const maxOrderQty = Math.max(0, Math.min(product.stock, 20));
  const inStock = product.active && product.stock > 0;

  const handleAddToCart = () => {
    if (!inStock) return;
    setCartQty((prev) => Math.min(maxOrderQty, Math.max(1, prev + pdpQty)));
    setCartOpen(true);
  };

  const handleBuyNow = () => {
    if (!inStock) return;
    setCartQty(Math.min(maxOrderQty, pdpQty));
    setActiveView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const announcementText =
    language === 'hi' && settings.announcementTextHi
      ? settings.announcementTextHi
      : settings.announcementText;

  const displayTitle =
    language === 'hi' && product.titleHi ? product.titleHi : product.title;
  const displayDesc =
    language === 'hi' && product.descriptionHi ? product.descriptionHi : product.description;

  const estimatedDelivery = calculateDeliveryCharge(settings, pinEstimate);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-white text-neutral-950">
        <StorefrontHeader
          brandName={settings.brandName}
          announcementText={announcementText}
          language={language}
          onLanguageChange={setLanguage}
          cartCount={cartQty}
          onOpenCart={() => setCartOpen(true)}
          activeView={activeView}
          onNavigate={handleNavigate}
        />

        <main className="flex-1">
          {activeView === 'storefront' && (
            <div>
              {/* Product Hero Split */}
              <section
                id="product-hero"
                className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
              >
                {/* Left: Full-width Swipeable Gallery */}
                <div className="lg:col-span-7 lg:sticky lg:top-28">
                  <ProductGallery
                    title={displayTitle}
                    images={product.images}
                    videos={product.videos}
                  />
                </div>

                {/* Right: Contiguous Purchase Module */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-3 pb-5 border-b border-neutral-200">
                    <div className="text-xs font-medium text-neutral-500">
                      <span>{settings.brandName}</span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        {product.stock > 0
                          ? `${t.inStock} (${product.stock})`
                          : t.outOfStock}
                      </span>
                    </div>

                    <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 text-balance">
                      {displayTitle}
                    </h1>

                    <div className="flex items-baseline gap-3">
                      <span className="font-mono-tabular text-3xl font-extrabold text-neutral-950">
                        {formatInr(product.priceInr)}
                      </span>
                      <span className="text-xs text-neutral-500">INR</span>
                    </div>
                    <p className="text-xs text-neutral-600">{t.priceNote}</p>
                  </div>

                  {/* Educational Prototype Safety Disclosure */}
                  <div className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-neutral-950">Educational Prototype Unit</p>
                      <p className="text-xs text-neutral-600 leading-snug">
                        Offered for educational demonstration purposes. Follow all written safety warnings strictly.
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-neutral-700 leading-relaxed">{displayDesc}</p>

                  {/* Separate Product Price, Delivery Charge & Final Total Breakdown (Dynamic by Qty) */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span>
                        Product Price ({pdpQty} × {formatInr(product.priceInr)})
                      </span>
                      <span className="font-mono-tabular font-semibold text-neutral-950">
                        {formatInr(product.priceInr * pdpQty)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span>
                        {t.deliveryCharge}
                        {settings.deliveryMode === 'flat' ? ' (Flat across India)' : ''}
                      </span>
                      <span className="font-mono-tabular font-semibold text-neutral-950">
                        {formatInr(estimatedDelivery)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-sm font-bold text-neutral-950">
                      <span>{t.totalPayable}</span>
                      <span className="font-mono-tabular text-base">
                        {formatInr(product.priceInr * pdpQty + estimatedDelivery)}
                      </span>
                    </div>
                    {settings.deliveryMode === 'pincode' && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinEstimate}
                          onChange={(e) =>
                            setPinEstimate(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder={t.checkPinPlaceholder}
                          aria-label={t.deliveryEstimateLabel}
                          className="flex-1 px-3 py-1.5 text-xs font-mono-tabular bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                        {VALIDATION_PATTERNS.INDIAN_PIN.test(pinEstimate) && (
                          <span className="text-[11px] font-mono-tabular font-semibold text-neutral-700">
                            PIN {pinEstimate}: {formatInr(estimatedDelivery)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper & Purchase Actions */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700">{t.quantity}</span>
                      <div className="inline-flex items-center border border-neutral-300 rounded-lg bg-white">
                        <button
                          type="button"
                          onClick={() => setPdpQty((q) => Math.max(1, q - 1))}
                          disabled={pdpQty <= 1}
                          aria-label="Decrease quantity"
                          className="w-11 h-11 flex items-center justify-center text-neutral-800 hover:bg-neutral-100 rounded-l-lg disabled:opacity-40"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center text-sm font-mono-tabular font-bold">
                          {pdpQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPdpQty((q) => Math.min(maxOrderQty || 1, q + 1))}
                          disabled={pdpQty >= (maxOrderQty || 1)}
                          aria-label="Increase quantity"
                          className="w-11 h-11 flex items-center justify-center text-neutral-800 hover:bg-neutral-100 rounded-r-lg disabled:opacity-40"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={!inStock}
                        onClick={handleAddToCart}
                        className="order-2 sm:order-1 min-h-[52px] py-3.5 px-5 border-2 border-neutral-950 text-neutral-950 font-bold text-sm rounded-xl hover:bg-neutral-100 active:scale-[0.99] transition-all disabled:border-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed touch-manipulation"
                      >
                        {t.addToCart}
                      </button>
                      <button
                        type="button"
                        disabled={!inStock}
                        onClick={handleBuyNow}
                        className="order-1 sm:order-2 min-h-[54px] py-4 px-6 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-neutral-950 font-extrabold text-base tracking-wide rounded-xl shadow-sm transition-all disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed touch-manipulation"
                      >
                        {t.buyNow}
                      </button>
                    </div>

                    {!settings.safetyComplianceApproved && (
                      <p className="text-xs text-neutral-600 leading-snug">
                        {t.checkoutUnavailableNote}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Section 2: Specifications & Truthful Safety Warnings */}
              <section
                id="product-specs"
                className="border-t border-neutral-200 bg-neutral-50 py-12 sm:py-16"
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  <div className="space-y-4">
                    <h2 className="font-display text-2xl font-bold text-neutral-950">
                      {t.specsHeading}
                    </h2>
                    <div className="border border-neutral-200 rounded-xl bg-white divide-y divide-neutral-200">
                      {product.specs.map((spec, idx) => {
                        const [label, ...rest] = spec.split(':');
                        const val = rest.join(':').trim();
                        return (
                          <div
                            key={`${spec}-${idx}`}
                            className="px-4 py-3 flex items-start justify-between gap-4 text-sm"
                          >
                            <span className="font-medium text-neutral-600">
                              {val ? label : `Specification ${idx + 1}`}
                            </span>
                            <span className="font-semibold text-neutral-950 text-right">
                              {val || label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="font-display text-2xl font-bold text-neutral-950">
                      {t.safetyWarningsHeading}
                    </h2>
                    <div className="border border-neutral-200 rounded-xl bg-white p-5 space-y-3">
                      <ul className="space-y-2.5 text-sm text-neutral-700 leading-relaxed list-disc pl-5">
                        {product.safetyWarnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Shipping, Returns & FAQ */}
              <section className="border-t border-neutral-200 py-12 sm:py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                  <div className="lg:col-span-5 space-y-6">
                    <h2 className="font-display text-2xl font-bold text-neutral-950">
                      {t.shippingReturnsHeading}
                    </h2>
                    <div className="space-y-4">
                      <div className="border border-neutral-200 rounded-xl p-5 space-y-2">
                        <h3 className="text-sm font-bold text-neutral-950">
                          {t.shippingPolicyLabel}
                        </h3>
                        <p className="text-sm text-neutral-600 leading-relaxed">
                          {settings.shippingPolicy}
                        </p>
                      </div>
                      <div className="border border-neutral-200 rounded-xl p-5 space-y-2">
                        <h3 className="text-sm font-bold text-neutral-950">
                          {t.returnPolicyLabel}
                        </h3>
                        <p className="text-sm text-neutral-600 leading-relaxed">
                          {settings.returnPolicy}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 space-y-4">
                    <h2 className="font-display text-2xl font-bold text-neutral-950">
                      {t.faqHeading}
                    </h2>
                    <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-200 bg-white">
                      {t.faqs.map((item, idx) => {
                        const isOpen = openFaqIndex === idx;
                        return (
                          <div key={item.q}>
                            <button
                              type="button"
                              onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                              aria-expanded={isOpen}
                              className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left text-sm font-semibold text-neutral-950 hover:bg-neutral-50 transition-colors"
                            >
                              <span>{item.q}</span>
                              <ChevronDown
                                className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${
                                  isOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {isOpen && (
                              <div className="px-5 pb-4 text-sm text-neutral-600 leading-relaxed">
                                {item.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Genuine Verified Customer Reviews Only */}
              <section className="border-t border-neutral-200 bg-neutral-50 py-12 sm:py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-bold text-neutral-950">
                      {t.reviewsHeading}
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleNavigate('lookup')}
                      className="text-xs font-semibold text-neutral-800 underline underline-offset-4 hover:text-neutral-950 self-start"
                    >
                      Have a delivered order? Submit a verified review
                    </button>
                  </div>

                  {reviews.length === 0 ? (
                    <div className="border border-neutral-200 rounded-xl p-8 bg-white text-sm text-neutral-600">
                      {t.reviewsEmpty}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {reviews.map((rev) => (
                        <article
                          key={rev.id}
                          className="border border-neutral-200 rounded-xl p-5 bg-white space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span className="font-semibold text-neutral-950">{rev.customerName}</span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-neutral-950">
                              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500" />
                              {rev.rating}/5
                            </span>
                          </div>
                          <p className="text-sm text-neutral-700 leading-relaxed">{rev.comment}</p>
                          <div className="text-[11px] text-neutral-500">
                            Verified Order {rev.orderId} ·{' '}
                            {new Date(rev.createdAt).toLocaleDateString('en-IN')}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeView === 'checkout' && (
            <CheckoutView
              product={product}
              settings={settings}
              quantity={cartQty > 0 ? cartQty : pdpQty}
              onQuantityChange={(nextQty) => {
                setPdpQty(nextQty);
                if (cartQty > 0) setCartQty(nextQty);
              }}
              language={language}
              onBack={() => handleNavigate('storefront')}
              onOrderCreated={(order, token) => {
                setActiveOrder(order);
                setActiveOrderToken(token);
                setCartQty(0);
                setActiveView('payment');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {activeView === 'payment' && activeOrder && (
            <PaymentView
              order={activeOrder}
              lookupToken={activeOrderToken}
              settings={settings}
              language={language}
              onProofSubmitted={(updated) => {
                setActiveOrder(updated);
                setJustSubmittedProof(true);
                setActiveView('lookup');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {activeView === 'lookup' && (
            <OrderLookupView
              initialOrder={activeOrder}
              initialToken={activeOrderToken}
              justSubmitted={justSubmittedProof}
              language={language}
              onRetryPayment={(ord, token) => {
                setActiveOrder(ord);
                setActiveOrderToken(token);
                setActiveView('payment');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {activeView === 'admin' && (
            <AdminDashboard
              onStorefrontUpdated={(nextProduct, nextSettings) => {
                setProduct(nextProduct);
                setSettings(nextSettings);
              }}
            />
          )}
        </main>

        {/* Mobile Sticky Bottom Buy Bar (Android touch-friendly) */}
        {activeView === 'storefront' && (
          <div className="lg:hidden sticky bottom-0 z-30 bg-white/95 backdrop-blur border-t border-neutral-200 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-neutral-500 truncate">
                {pdpQty} × {formatInr(product.priceInr)} + {formatInr(estimatedDelivery)} delivery
              </div>
              <div className="font-mono-tabular text-sm font-extrabold text-neutral-950">
                Total {formatInr(product.priceInr * pdpQty + estimatedDelivery)}
              </div>
            </div>
            <button
              type="button"
              disabled={!inStock}
              onClick={handleBuyNow}
              className="px-6 min-h-[44px] py-2.5 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-neutral-950 font-extrabold text-sm tracking-wide rounded-xl shadow-sm whitespace-nowrap shrink-0 disabled:bg-neutral-200 disabled:text-neutral-500 touch-manipulation"
            >
              {t.buyNow}
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-neutral-200 bg-neutral-950 text-neutral-300 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
            <div className="space-y-2">
              <p className="font-display text-base font-bold text-white">{settings.brandName}</p>
              <p className="text-neutral-400 leading-relaxed">
                Prototype technical footwear engineering with transparent safety governance and
                manual bank-verified Indian UPI settlement.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-white">Contact</p>
              <p>{settings.contactEmail}</p>
              <p className="font-mono-tabular">{settings.contactPhone}</p>
              <p className="text-neutral-400">{settings.contactAddress}</p>
            </div>

            <div className="space-y-2 flex flex-col items-start">
              <p className="font-semibold text-white">Policies</p>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({ title: 'Shipping Policy', content: settings.shippingPolicy })
                }
                className="hover:text-yellow-400 transition-colors"
              >
                Shipping Policy
              </button>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({ title: 'Return Policy', content: settings.returnPolicy })
                }
                className="hover:text-yellow-400 transition-colors"
              >
                Returns & Refunds
              </button>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({
                    title: 'Privacy Policy',
                    content:
                      'Shock Shoe India collects only the shipping information required to verify and deliver your order (name, Indian mobile number, address, city, state, PIN code, and UPI transaction proof). Payment screenshots are stored privately for administrative verification only and are never shared publicly.',
                  })
                }
                className="hover:text-yellow-400 transition-colors"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({
                    title: 'Terms of Service',
                    content:
                      'Shock Shoe is offered as a prototype technical footwear item subject to explicit business-owner safety compliance confirmation. Orders are accepted strictly for lawful personal/laboratory evaluation in accordance with all written safety warnings. Never discharge static electricity toward people or animals. Payments are confirmed only after manual verification in our merchant bank statement.',
                  })
                }
                className="hover:text-yellow-400 transition-colors"
              >
                Terms of Service
              </button>
            </div>

            <div className="space-y-2 flex flex-col items-start">
              <p className="font-semibold text-white">Customer & Operations</p>
              <button
                type="button"
                onClick={() => handleNavigate('lookup')}
                className="hover:text-yellow-400 transition-colors"
              >
                Track Order Status
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className="hover:text-yellow-400 transition-colors"
              >
                Admin Operations Portal
              </button>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span>© {new Date().getFullYear()} {settings.brandName}. All rights reserved.</span>
            <span>Currency: INR (₹) · India</span>
          </div>
        </footer>

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          product={product}
          settings={settings}
          quantity={cartQty}
          onUpdateQuantity={(qty) => setCartQty(Math.max(0, Math.min(maxOrderQty, qty)))}
          onRemove={() => setCartQty(0)}
          onProceedToCheckout={() => {
            setActiveView('checkout');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          language={language}
        />

        {policyModal && (
          <PolicyModal
            title={policyModal.title}
            content={policyModal.content}
            onClose={() => setPolicyModal(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
