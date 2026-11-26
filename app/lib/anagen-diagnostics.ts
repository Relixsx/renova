export const webVitals = ["LCP", "FCP", "INP", "CLS", "TTFB"] as const;
export const diagnosticEvents = [
  "rendered", "image-error", "javascript-error", "availability-error", "order-rejected",
  "checkout-error", "meta-pageview-queued", "meta-script-loaded", "meta-script-error",
] as const;
type Vital = typeof webVitals[number];
type DiagnosticEvent = typeof diagnosticEvents[number];

let sampled: boolean | undefined;
let sent = 0;

export function reportAnagenDiagnostic(name: Vital | DiagnosticEvent, value?: number) {
  if (process.env.NEXT_PUBLIC_RENOVA_ANAGEN_DIAGNOSTICS !== "1" ||
      typeof window === "undefined" || !navigator.sendBeacon || sent >= 16) return;
  try {
    const consent = JSON.parse(localStorage.getItem("renova-consent-v1") ?? "null");
    if (consent?.analytics !== true) return;
    sampled ??= Math.random() < 0.1;
    if (!sampled) return;
    if (navigator.sendBeacon("/api/anagen/diagnostics", JSON.stringify({ name, value }))) sent++;
  } catch {
    // Diagnostics never hold up rendering or checkout.
  }
}
