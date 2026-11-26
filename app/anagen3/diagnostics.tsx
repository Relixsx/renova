"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { reportAnagenDiagnostic } from "../lib/anagen-diagnostics";

function reportVital({ name, value }: { name: string; value: number }) {
  if (name === "LCP" || name === "FCP" || name === "INP" || name === "CLS" || name === "TTFB") {
    reportAnagenDiagnostic(name, value);
  }
}

export function AnagenDiagnostics() {
  useEffect(() => {
    const frame = requestAnimationFrame(() => reportAnagenDiagnostic("rendered"));
    const error = (event: Event) => {
      if (event.target instanceof HTMLImageElement) reportAnagenDiagnostic("image-error");
      else if (event instanceof ErrorEvent) reportAnagenDiagnostic("javascript-error");
    };
    const rejection = () => reportAnagenDiagnostic("javascript-error");
    window.addEventListener("error", error, true);
    window.addEventListener("unhandledrejection", rejection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("error", error, true);
      window.removeEventListener("unhandledrejection", rejection);
    };
  }, []);
  useReportWebVitals(reportVital);
  return null;
}
