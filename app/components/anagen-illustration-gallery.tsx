"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import styles from "../anagen/anagen.module.css";

// The original illustrations stay unchanged. Only their surrounding frame is
// typeset in HTML so it can remain pure white, with crisp black lettering.
type PhotoCrop = readonly [x: number, y: number, width: number, height: number];
const photoCrops: readonly (readonly [PhotoCrop, PhotoCrop])[] = [
  [[30, 107, 504, 536], [548, 107, 504, 536]],
  [[29, 108, 505, 550], [548, 108, 503, 550]],
  [[29, 106, 503, 537], [549, 106, 502, 537]],
  [[29, 106, 505, 537], [548, 106, 502, 537]],
  [[30, 106, 503, 558], [549, 106, 503, 558]],
  [[26, 106, 508, 538], [548, 106, 507, 538]],
  [[29, 107, 503, 545], [548, 107, 503, 545]],
  [[28, 106, 505, 533], [548, 107, 503, 532]],
  [[30, 107, 504, 540], [548, 107, 502, 540]],
  [[31, 107, 503, 532], [549, 107, 502, 532]],
];
const illustrations = photoCrops.map((crops, index) => ({
  src: `/anagen/illustrations/hair-${String(index + 1).padStart(2, "0")}.webp`,
  number: index + 1,
  crops,
}));

function ComparisonPhotos({ src, number, crops }: { src: string; number: number; crops: readonly [PhotoCrop, PhotoCrop] }) {
  return <div className={styles.comparisonFrame}>
    <h3 className={styles.comparisonTitle}>Before &amp; after</h3>
    <div className={styles.comparisonPhotos}>
      {crops.map(([x, y, width, height], index) => <div className={styles.comparisonPhoto} key={index} style={{ aspectRatio: `${width} / ${height}` }}>
        <img src={src} alt={`${index === 0 ? "Before" : "After"}: AI-generated hairline illustration ${number}; not a customer result`} width="1080" height="810" loading="lazy" decoding="async" style={{ width: `${1080 / width * 100}%`, height: `${810 / height * 100}%`, left: `${-x / width * 100}%`, top: `${-y / height * 100}%` }} />
      </div>)}
    </div>
    <div className={styles.comparisonLabels} aria-hidden="true"><b>BEFORE</b><b>AFTER</b></div>
    <p className={styles.comparisonNote}>Illustrative example only</p>
  </div>;
}

export function AnagenIllustrationGallery() {
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
    if (!node) return;
    const first = node.children[0] as HTMLElement;
    const second = node.children[1] as HTMLElement;
    const step = second.offsetLeft - first.offsetLeft;
    node.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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

  return <section className={`${styles.section} ${styles.container} ${styles.illustrationGallery}`} aria-labelledby="illustration-heading">
    <header className={styles.sectionIntro}>
      <p className={styles.eyebrow}>Swipe to explore</p>
      <h2 id="illustration-heading">Before &amp; after illustrations.</h2>
      <p id="illustration-disclosure">These 10 images are AI-generated illustrations, not customer photographs or evidence of Anagen results.</p>
    </header>
    <div className={styles.galleryToolbar}>
      <span aria-live="polite" aria-atomic="true">{position.first === position.last ? `Image ${position.first}` : `Images ${position.first}–${position.last}`} of 10</span>
      <div><button type="button" aria-label="Previous illustration" aria-controls="anagen-illustrations" disabled={!position.previous} onClick={() => move(-1)}>←</button><button type="button" aria-label="Next illustration" aria-controls="anagen-illustrations" disabled={!position.next} onClick={() => move(1)}>→</button></div>
    </div>
    <div id="anagen-illustrations" ref={track} className={styles.galleryTrack} role="region" aria-label="10 before-and-after illustrations" aria-describedby="illustration-disclosure gallery-help" tabIndex={0} onScroll={updatePosition} onKeyDown={handleKey}>
      {illustrations.map(({ src, number, crops }) => <figure className={styles.galleryCard} key={src}>
        <ComparisonPhotos src={src} number={number} crops={crops} />
        <figcaption><span>AI-generated illustration</span><b>{String(number).padStart(2, "0")} / 10</b></figcaption>
      </figure>)}
    </div>
    <p id="gallery-help" className={styles.galleryHelp}>Swipe left or right, use the arrows, or focus the gallery and press the arrow keys.</p>
  </section>;
}
