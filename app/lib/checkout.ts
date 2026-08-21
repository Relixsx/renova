export const deliveryOptions = [
  { id: "jumia", name: "Jumia Delivery", detail: "3–5 working days · eligible campaign", priceKobo: 0, label: "Free delivery" },
  { id: "gig", name: "GIG Logistics", detail: "3–5 working days · nationwide courier", priceKobo: 700000, label: "" },
  { id: "sendbox", name: "Sendbox", detail: "3–5 working days · tracked delivery", priceKobo: 600000, label: "" },
  { id: "fez", name: "Fez Delivery", detail: "2–4 working days · selected locations", priceKobo: 550000, label: "Fastest" },
  { id: "kwik", name: "Kwik", detail: "Lagos routes only", priceKobo: 450000, label: "" },
] as const;

export function getDeliveryOption(id: string) {
  return deliveryOptions.find((option) => option.id === id);
}
