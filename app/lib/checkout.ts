import { DEFAULT_DELIVERY_ESTIMATE, LAGOS_DELIVERY_ESTIMATE, deliveryEstimateForAddress } from "./delivery-estimate";

export const deliveryOptions = [
  { id: "jumia", name: "Jumia Delivery", detail: `${DEFAULT_DELIVERY_ESTIMATE} · eligible campaign`, priceKobo: 0, label: "Free delivery" },
  { id: "gig", name: "GIG Logistics", detail: `${DEFAULT_DELIVERY_ESTIMATE} · nationwide courier`, priceKobo: 700000, label: "" },
  { id: "sendbox", name: "Sendbox", detail: `${DEFAULT_DELIVERY_ESTIMATE} · tracked delivery`, priceKobo: 600000, label: "" },
  { id: "fez", name: "Fez Delivery", detail: `${DEFAULT_DELIVERY_ESTIMATE} · selected locations`, priceKobo: 550000, label: "" },
  { id: "kwik", name: "Kwik", detail: `${LAGOS_DELIVERY_ESTIMATE} · Lagos routes only`, priceKobo: 450000, label: "" },
] as const;

export function deliveryOptionDetail(option: typeof deliveryOptions[number], address?: unknown) {
  const estimate = option.id === "kwik" ? LAGOS_DELIVERY_ESTIMATE : deliveryEstimateForAddress(address);
  return `${estimate} · ${option.detail.split(" · ").slice(1).join(" · ")}`;
}

export function getDeliveryOption(id: string, address?: unknown) {
  const option = deliveryOptions.find((item) => item.id === id);
  return option ? { ...option, detail: deliveryOptionDetail(option, address) } : undefined;
}
