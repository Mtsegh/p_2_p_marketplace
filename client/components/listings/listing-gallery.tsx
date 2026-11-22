"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListingImage } from "@/lib/listings-api";

/**
 * Image gallery for the listing detail page. Keyboard arrows move between
 * images on desktop; a swipe gesture does the same on touch devices. Thumbnails
 * are buttons so the gallery is usable without a pointer gesture at all.
 */
export function ListingGallery({
  images,
  title,
}: {
  images: ListingImage[];
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count < 2) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, count, goTo]);

  if (count === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-line bg-surface-raised text-muted">
        No images
      </div>
    );
  }

  const current = images[index]!;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-raised"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          if (start === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(delta) > 40) {
            goTo(index + (delta < 0 ? 1 : -1));
          }
          touchStartX.current = null;
        }}
      >
        {/* Image host comes from runtime S3/CDN config, so next/image cannot
            be given a config-time remotePattern here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={`${title} — image ${index + 1} of ${count}`}
          className="size-full object-cover"
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 px-3 py-2 text-sm shadow"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 px-3 py-2 text-sm shadow"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-surface/90 px-2 py-1 text-xs text-muted">
              {index + 1} / {count}
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, imageIndex) => (
            <button
              type="button"
              key={image.id}
              onClick={() => goTo(imageIndex)}
              aria-label={`Show image ${imageIndex + 1}`}
              aria-current={imageIndex === index}
              className={`size-16 shrink-0 overflow-hidden rounded-md border-2 ${
                imageIndex === index ? "border-primary" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
