import { NextRequest, NextResponse } from "next/server";
import { allowsStoreWrite, isRetryWebhook, maintenanceResponse, migrationMode } from "./app/lib/migration-mode.mjs";

export function proxy(request: NextRequest) {
  if (migrationMode() === "off") return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path === "/api/health" || path === "/api/migration/status" || path.startsWith("/api/auth/") || path === "/api/admin/password-recovery") return NextResponse.next();
  if ((request.method === "GET" || request.method === "HEAD") && (path === "/admin" || path.startsWith("/admin/"))) return NextResponse.next();
  if (isRetryWebhook(path) && allowsStoreWrite(path)) return NextResponse.next();
  return maintenanceResponse(path.startsWith("/api/"));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|renova-mark.svg).*)"] };
