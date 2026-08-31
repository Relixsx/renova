"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function AdminForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim().toLowerCase();
    try {
      const response = await fetch("/api/admin/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          email,
          redirectTo: `${window.location.origin}/admin/reset-password`,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The recovery service did not respond.");
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.name !== "TimeoutError"
        ? requestError.message
        : "The recovery request timed out. Please try again in a moment.");
      setBusy(false);
      return;
    }

    setBusy(false);
    // Use the same response whether or not an account exists so the form does
    // not disclose which email addresses have administrative access.
    setMessage("If this email belongs to your Renova account, a secure reset link has been sent. Check your inbox and spam folder.");
  }

  return <form className="admin-login-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    {message ? <p className="admin-auth-success" role="status">{message}</p> : null}
    {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
    <button className="button espresso" type="submit" disabled={busy}>{busy ? "Sending secure link…" : "Send reset link"}</button>
    <Link className="admin-auth-link" href="/admin/login">Return to sign in</Link>
  </form>;
}
