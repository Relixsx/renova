"use client";

import { FormEvent, useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import Link from "next/link";

const authClient = createAuthClient();

export function AdminLoginForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("passwordReset") === "success") {
      setMessage("Your password has been updated. You can now sign in securely.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(data.get("email") || "").trim(),
      password: String(data.get("password") || ""),
      callbackURL: "/admin",
    });
    if (result.error) {
      setError(result.error.message || "The email or password is incorrect.");
      setBusy(false);
      return;
    }
    window.location.assign("/admin");
  }

  return <form className="admin-login-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={8} /></label>
    <Link className="admin-auth-link" href="/admin/forgot-password">Forgot password?</Link>
    {message ? <p className="admin-auth-success" role="status">{message}</p> : null}
    {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
    <button className="button espresso" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
