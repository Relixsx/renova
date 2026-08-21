const OWNER_EMAILS = new Set(["relixsx@gmail.com", "airebirth5@gmail.com"]);

export function requestAdminEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? null;
}

export function isOwnerEmail(email: string | null) {
  return Boolean(email && OWNER_EMAILS.has(email));
}

export function requireOwnerRequest(request: Request) {
  const email = requestAdminEmail(request);
  if (!email) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }
  if (!isOwnerEmail(email)) {
    return Response.json({ error: "This account is not authorised for Renova administration." }, { status: 403 });
  }
  return null;
}
