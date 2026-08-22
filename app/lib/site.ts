export const SITE_URL = "https://shoprenova.com.ng";
export const SUPPORT_EMAIL = "support@shoprenova.com.ng";

export const BUSINESS_IDENTITY = {
  name: "Renova Store",
  legalDescription: "Independent online retailer",
  location: "Lagos, Nigeria",
  supportEmail: SUPPORT_EMAIL,
};

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}
