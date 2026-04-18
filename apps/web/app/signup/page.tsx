"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SignupResponse = {
  verified: boolean;
  message: string;
  user?: {
    user_id: string;
    full_name: string;
    email: string;
  };
};

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      setError("Full name, email, and password are required.");
      return;
    }
    if (normalizedPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: normalizedName,
          email: normalizedEmail,
          password: normalizedPassword,
        }),
      });

      const data = (await response.json()) as SignupResponse | { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.message || data.error || "Signup failed");
      }

      const result = data as SignupResponse;
      startTransition(() => {
        setMessage(`${result.message}${result.user ? ` for ${result.user.full_name}` : ""}`);
      });
      if (result.user) {
        window.localStorage.setItem(
          "kineticare_auth_user",
          JSON.stringify(result.user),
        );
      }
      router.push("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign up");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background:
          "radial-gradient(circle at 85% 8%, rgba(245, 158, 11, 0.16), transparent 30%), linear-gradient(160deg, #fff7ed 0%, #ecfeff 52%, #f8fafc 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 500,
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(15, 23, 42, 0.12)",
          borderRadius: 16,
          padding: 22,
          boxShadow: "0 14px 40px rgba(15, 23, 42, 0.12)",
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        }}
      >
        <p
          style={{
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            fontSize: 12,
            color: "#b45309",
            fontWeight: 700,
          }}
        >
          New Account
        </p>
        <h1 style={{ margin: "8px 0 14px", fontSize: "1.8rem", color: "#0f172a" }}>
          Sign Up
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Full Name</span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create password"
              minLength={8}
              required
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "11px 14px",
              background: isPending
                ? "linear-gradient(120deg, #94a3b8 0%, #94a3b8 100%)"
                : "linear-gradient(120deg, #b45309 0%, #0284c7 100%)",
              color: "#fff",
              fontWeight: 700,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Creating..." : "Create Account"}
          </button>
        </form>

        {message ? (
          <p style={{ margin: "12px 0 0", color: "#047857", fontSize: 14 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 14 }}>{error}</p>
        ) : null}

        <p style={{ margin: "14px 0 0", color: "#475569", fontSize: 14 }}>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(15, 23, 42, 0.2)",
  padding: "10px 12px",
  background: "#fff",
  outline: "none",
  fontSize: 14,
};
