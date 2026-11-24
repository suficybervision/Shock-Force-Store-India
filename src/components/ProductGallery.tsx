import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Play } from 'lucide-react';

interface ProductGalleryProps {
  title: string;
  images: string[];
  videos: string[];
}

type MediaSlide =
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  title,
  images,
  videos,
}) => {
  const slides: MediaSlide[] = [
    ...images.filter(Boolean).map((url) => ({ type: 'image' as const, url })),
    ...videos.filter(Boolean).map((url) => ({ type: 'video' as const, url })),
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  const safeIndex = activeIndex < slides.length ? activeIndex : 0;
  const activeSlide = slides[safeIndex];

  const goPrev = () => {
    if (slides.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    if (slides.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 40) {
      if (delta < 0) goNext();
      else goPrev();
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Carousel Frame */}
      <div
        className="relative aspect-[4/3] w-full bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200 select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') goPrev();
          if (e.key === 'ArrowRight') goNext();
        }}
        aria-label="Product media carousel"
      >
        {activeSlide?.type === 'video' ? (
          <video
            src={activeSlide.url}
            controls
            playsInline
            className="w-full h-full object-cover bg-neutral-950"
          />
        ) : activeSlide && !failedUrls[activeSlide.url] ? (
          <img
            src={activeSlide.url}
            alt={`${title} — view ${safeIndex + 1}`}
            referrerPolicy="no-referrer"
            onError={() =>
              setFailedUrls((prev) => ({ ...prev, [activeSlide.url]: true }))
            }
            className="w-full h-full object-cover transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-500 p-6 text-center">
            <ImageOff className="w-10 h-10 mb-2 text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-700">{title}</p>
            <p className="text-xs text-neutral-500 mt-1">Product preview image unavailable</p>
          </div>
        )}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous product image"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 border border-neutral-200 text-neutral-950 flex items-center justify-center shadow-sm hover:bg-yellow-400 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next product image"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 border border-neutral-200 text-neutral-950 flex items-center justify-center shadow-sm hover:bg-yellow-400 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-neutral-950/85 text-white text-xs font-mono-tabular">
              {safeIndex + 1} / {slides.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails Strip */}
      {slides.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
          {slides.map((slide, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <button
                key={`${slide.type}-${slide.url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`View media ${idx + 1}`}
                className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-neutral-950 ring-2 ring-yellow-400'
                    : 'border-neutral-200 opacity-75 hover:opacity-100'
                }`}
              >
                {slide.type === 'video' ? (
                  <div className="w-full h-full bg-neutral-900 text-white flex flex-col items-center justify-center gap-1">
                    <Play className="w-4 h-4 text-yellow-400" />
                    <span className="text-[10px] font-medium">Video</span>
                  </div>
                ) : !failedUrls[slide.url] ? (
                  <img
                    src={slide.url}
                    alt={`${title} thumbnail ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedUrls((prev) => ({ ...prev, [slide.url]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                    <ImageOff className="w-4 h-4 text-neutral-400" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
