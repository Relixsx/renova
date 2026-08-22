"use client";

import { FormEvent, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";

const authClient = createAuthClient();

export function AdminLoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    {error ? <p role="alert">{error}</p> : null}
    <button className="button espresso" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
