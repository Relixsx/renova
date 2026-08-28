"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  enabled?: boolean;
  label?: string;
  endsAt?: string;
};

export function ProductPromoBanner({ enabled, label, endsAt }: Props) {
  const deadline = useMemo(() => new Date(endsAt || "").getTime(), [endsAt]);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !Number.isFinite(deadline)) return;
    const cycleLength = 2 * 60 * 60 * 1000;
    const update = () => {
      const untilFirstDeadline = deadline - Date.now();
      if (untilFirstDeadline > 0) {
        setRemaining(untilFirstDeadline);
        return;
      }

      const elapsedSinceDeadline = Math.abs(untilFirstDeadline);
      const elapsedInCycle = elapsedSinceDeadline % cycleLength;
      setRemaining(elapsedInCycle === 0 ? cycleLength : cycleLength - elapsedInCycle);
    };
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [deadline, enabled]);

  if (!enabled || !Number.isFinite(deadline)) return null;

  const total = Math.max(0, Math.floor((remaining ?? 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const units = [
    [hours, "HRS"],
    [minutes, "MIN"],
    [seconds, "SEC"],
  ] as const;

  return (
    <aside
      className="product-promo-banner"
      aria-label={`${label || "Promo"}. ${hours} hours and ${minutes} minutes remain in the current promotion cycle.`}
    >
      <span className="product-promo-glitter" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <i key={index}>✦</i>)}
      </span>
      <div className="product-promo-badge">
        <span aria-hidden="true">✦</span>
        <strong>{label || "PROMO"}</strong>
      </div>
      <div className="product-promo-timer" aria-hidden="true">
        {units.map(([value, unit], index) => (
          <div key={unit}>
            {index > 0 && <i>:</i>}
            <span>
              <b>{String(value).padStart(2, "0")}</b>
              <small>{unit}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="product-promo-message">
        <b>Limited-time offer</b>
      </div>
    </aside>
  );
}
