"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createAuthClient } from "@neondatabase/auth/next";

const authClient = createAuthClient();

export function AdminResetPasswordForm() {
  const [token, setToken] = useState("");
  const [invalidLink, setInvalidLink] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get("token") || "";
    setToken(resetToken);
    setInvalidLink(!resetToken || resetToken === "INVALID_TOKEN");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirmation") || "");

    if (password !== confirmation) {
      setError("The passwords do not match.");
      setBusy(false);
      return;
    }

    const result = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "This reset link is invalid or has expired. Request a new link.");
      return;
    }

    window.location.assign("/admin/login?passwordReset=success");
  }

  if (invalidLink) return <div className="admin-login-form">
    <p className="admin-auth-error" role="alert">This password-reset link is invalid or has expired.</p>
    <Link className="button espresso" href="/admin/forgot-password">Request a new link</Link>
  </div>;

  return <form className="admin-login-form" onSubmit={submit}>
    <label>New password<input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
    <label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} /></label>
    {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
    <button className="button espresso" type="submit" disabled={busy}>{busy ? "Updating password…" : "Create new password"}</button>
    <Link className="admin-auth-link" href="/admin/login">Return to sign in</Link>
  </form>;
}
