import React, { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { Language } from '../types/store';
import { TRANSLATIONS } from '../i18n/translations';

export type AppView = 'storefront' | 'checkout' | 'payment' | 'lookup' | 'admin';

interface StorefrontHeaderProps {
  brandName: string;
  announcementText: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  cartCount: number;
  onOpenCart: () => void;
  activeView: AppView;
  onNavigate: (view: AppView, sectionId?: string) => void;
}

export const StorefrontHeader: React.FC<StorefrontHeaderProps> = ({
  brandName,
  announcementText,
  language,
  onLanguageChange,
  cartCount,
  onOpenCart,
  activeView,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = TRANSLATIONS[language];

  const handleLink = (view: AppView, sectionId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(view, sectionId);
  };

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      {/* Slim announcement offer bar (<= 36px) */}
      <div className="bg-yellow-400 text-neutral-950 px-4 py-1.5 text-xs font-medium flex items-center justify-between gap-4">
        <div className="flex-1 text-center truncate">{announcementText}</div>
        <div className="flex items-center gap-1 shrink-0 border-l border-neutral-950/20 pl-3">
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              language === 'en'
                ? 'bg-neutral-950 text-white'
                : 'text-neutral-900 hover:bg-neutral-950/10'
            }`}
            aria-label="Switch to English"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('hi')}
            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              language === 'hi'
                ? 'bg-neutral-950 text-white'
                : 'text-neutral-900 hover:bg-neutral-950/10'
            }`}
            aria-label="Switch to Hindi"
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Strict 3-zone Top Bar Contract */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Mobile Hamburger + Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 -ml-2 text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => handleLink('storefront')}
            className="font-display text-lg font-extrabold tracking-tight text-neutral-950 whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity"
          >
            {brandName.toUpperCase()}
          </button>
        </div>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600"
        >
          <button
            type="button"
            onClick={() => handleLink('storefront', 'product-hero')}
            className={`whitespace-nowrap shrink-0 hover:text-neutral-950 transition-colors ${
              activeView === 'storefront' ? 'text-neutral-950 underline underline-offset-8' : ''
            }`}
          >
            {t.navProduct}
          </button>
          <button
            type="button"
            onClick={() => handleLink('storefront', 'product-specs')}
            className="whitespace-nowrap shrink-0 hover:text-neutral-950 transition-colors"
          >
            {t.navSpecs}
          </button>
          <button
            type="button"
            onClick={() => handleLink('lookup')}
            className={`whitespace-nowrap shrink-0 hover:text-neutral-950 transition-colors ${
              activeView === 'lookup' ? 'text-neutral-950 underline underline-offset-8' : ''
            }`}
          >
            {t.navTrack}
          </button>
          <button
            type="button"
            onClick={() => handleLink('admin')}
            className={`whitespace-nowrap shrink-0 hover:text-neutral-950 transition-colors ${
              activeView === 'admin' ? 'text-neutral-950 underline underline-offset-8' : ''
            }`}
          >
            {t.navAdmin}
          </button>
        </nav>

        {/* Zone 3: 1 primary action (Shopping Cart) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0"
            aria-label={`${t.cartLabel} (${cartCount})`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t.cartLabel}</span>
            <span className="font-mono-tabular text-yellow-400">({cartCount})</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-neutral-200 bg-white px-4 py-3 flex flex-col gap-1"
        >
          <button
            type="button"
            onClick={() => handleLink('storefront', 'product-hero')}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-neutral-950 rounded-lg hover:bg-neutral-100"
          >
            {t.navProduct}
          </button>
          <button
            type="button"
            onClick={() => handleLink('storefront', 'product-specs')}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-neutral-950 rounded-lg hover:bg-neutral-100"
          >
            {t.navSpecs}
          </button>
          <button
            type="button"
            onClick={() => handleLink('lookup')}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-neutral-950 rounded-lg hover:bg-neutral-100"
          >
            {t.navTrack}
          </button>
          <button
            type="button"
            onClick={() => handleLink('admin')}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-neutral-950 rounded-lg hover:bg-neutral-100"
          >
            {t.navAdmin}
          </button>
        </nav>
      )}
    </div>
  );
};
