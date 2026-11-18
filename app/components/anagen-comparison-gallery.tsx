"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import styles from "../anagen/anagen.module.css";

const photos = Array.from({ length: 9 }, (_, index) => ({
  src: `/anagen/customer-gallery/photo-${String(index + 1).padStart(2, "0")}.webp`,
  number: index + 1,
}));

export function AnagenComparisonGallery() {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ first: 1, last: 1, previous: false, next: true });

  function updatePosition() {
    const node = track.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const visible = Array.from(node.children).flatMap((item, index) => {
      const box = item.getBoundingClientRect();
      const width = Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left);
      return width >= box.width / 2 ? [index + 1] : [];
    });
    setPosition({ first: visible[0] || 1, last: visible.at(-1) || 1, previous: node.scrollLeft > 2, next: node.scrollLeft + node.clientWidth < node.scrollWidth - 2 });
  }

  useEffect(() => {
    updatePosition();
    if (!track.current || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(track.current);
    return () => observer.disconnect();
  }, []);

  function move(direction: number) {
    const node = track.current;
    if (!node || node.children.length < 2) return;
    const first = node.children[0] as HTMLElement;
    const second = node.children[1] as HTMLElement;
    node.scrollBy({ left: direction * (second.offsetLeft - first.offsetLeft), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      track.current?.scrollTo({ left: event.key === "Home" ? 0 : track.current.scrollWidth, behavior: "auto" });
    }
  }

  return <section className={`${styles.section} ${styles.container} ${styles.comparisonGallery}`} aria-labelledby="comparison-heading">
    <header className={styles.sectionIntro}>
      <p className={styles.eyebrow}>Swipe to explore</p>
      <h2 id="comparison-heading">Before &amp; after.</h2>
    </header>
    <div className={styles.galleryToolbar}>
      <span aria-live="polite" aria-atomic="true">{position.first === position.last ? `Image ${position.first}` : `Images ${position.first}–${position.last}`} of {photos.length}</span>
      <div><button type="button" aria-label="Previous photo" aria-controls="anagen-comparisons" disabled={!position.previous} onClick={() => move(-1)}>←</button><button type="button" aria-label="Next photo" aria-controls="anagen-comparisons" disabled={!position.next} onClick={() => move(1)}>→</button></div>
    </div>
    <div id="anagen-comparisons" ref={track} className={styles.galleryTrack} role="region" aria-label={`${photos.length} before-and-after photos`} aria-describedby="gallery-help" tabIndex={0} onScroll={updatePosition} onKeyDown={handleKey}>
      {photos.map(({ src, number }) => <figure className={styles.galleryCard} key={src}>
        <img src={src} alt={`Before-and-after hair comparison supplied by Renova, photo ${number}`} width="1080" height="810" loading="lazy" decoding="async" />
      </figure>)}
    </div>
    <p id="gallery-help" className={styles.galleryHelp}>Swipe left or right, use the arrows, or focus the gallery and press the arrow keys.</p>
  </section>;
}
