import type { Review } from "./catalog";

export function formatReviewDate(review: Pick<Review, "reviewedAt" | "createdAt">) {
  const value = review.reviewedAt ?? review.createdAt;
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
