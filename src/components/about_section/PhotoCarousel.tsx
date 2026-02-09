import React, { useEffect, useState } from "react";
import { info } from "../../data/info";

type PhotoItem = (typeof info)["about"]["photos"][number];

type CarouselItem = PhotoItem & { placeholder?: boolean };

interface PhotoCarouselProps {
  photos: PhotoItem[] | undefined;
}

const AUTO_INTERVAL = 5000;

export default function PhotoCarousel(props: PhotoCarouselProps) {
  const { photos } = props;
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const placeholderSlides: CarouselItem[] = [
    {
      alt: "Grad photos placeholder",
      context: "Grad moments from NYU and beyond.",
      tag: "Grad",
      placeholder: true,
    },
    {
      alt: "Shure photos placeholder",
      context: "Behind-the-scenes snapshots from Shure.",
      tag: "Shure",
      placeholder: true,
    },
    {
      alt: "Hybridge photos placeholder",
      context: "Hybridge Implants moments in the making.",
      tag: "Hybridge",
      placeholder: true,
    },
  ];

  const items: CarouselItem[] =
    photos && photos.length > 0 ? photos : placeholderSlides;

  useEffect(() => {
    if (items.length < 2 || isPaused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [items.length, isPaused]);

  const goTo = (nextIndex: number) => {
    if (!items.length) return;
    const normalized = ((nextIndex % items.length) + items.length) % items.length;
    setIndex(normalized);
  };

  return (
    <div className="flex flex-col space-y-4 w-full lg:w-1/2 mx-4 reveal" data-reveal>
      <h1 className="text-3xl font-bold">Photos</h1>
      <div
        className="relative group rounded-xl border border-secondary/30 dark:border-dk-secondary/30 overflow-hidden bg-primary/40"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative w-full photo-carousel-frame">
          {items.map((photo, idx) => (
            <div
              key={`${photo.alt}-${idx}`}
              className={`absolute inset-0 transition-opacity duration-700 ${
                idx === index ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {photo.placeholder || !photo.src ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/10 via-primary to-secondary/20 dark:from-dk-secondary/20 dark:via-dk-primary dark:to-dk-secondary/30">
                  <span className="text-lg sm:text-xl font-semibold text-secondary/80 dark:text-dk-secondary/80">
                    {photo.tag} Photos
                  </span>
                </div>
              ) : (
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: photo.position ?? "center" }}
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white">
                {photo.tag && (
                  <span className="uppercase tracking-widest text-xs text-white/80 mb-2">
                    {photo.tag}
                  </span>
                )}
                <p className="text-sm sm:text-base font-medium">{photo.context}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(index - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary/80 text-secondary border border-secondary/30 dark:bg-dk-primary/80 dark:text-dk-secondary dark:border-dk-secondary/30 shadow hover:scale-105 transition"
          aria-label="Previous photo"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary/80 text-secondary border border-secondary/30 dark:bg-dk-primary/80 dark:text-dk-secondary dark:border-dk-secondary/30 shadow hover:scale-105 transition"
          aria-label="Next photo"
        >
          <i className="fas fa-chevron-right"></i>
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {items.map((_, idx) => (
            <button
              key={`dot-${idx}`}
              type="button"
              className={`w-2.5 h-2.5 rounded-full transition ${
                idx === index
                  ? "bg-secondary dark:bg-dk-secondary"
                  : "bg-secondary/40 dark:bg-dk-secondary/40"
              }`}
              aria-label={`Go to photo ${idx + 1}`}
              onClick={() => goTo(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
