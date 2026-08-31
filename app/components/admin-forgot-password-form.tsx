"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createAuthClient } from "@neondatabase/auth/next";

const authClient = createAuthClient();

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
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });

    setBusy(false);
    if (result.error) {
      setError(result.error.message || "We could not send the recovery email. Please try again.");
      return;
    }

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
