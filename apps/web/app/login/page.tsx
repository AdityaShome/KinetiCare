"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LoginResponse = {
  verified: boolean;
  message: string;
  user?: {
    user_id: string;
    full_name: string;
    email: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginResponse | { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.message || data.error || "Login failed");
      }

      const result = data as LoginResponse;
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
      setError(submitError instanceof Error ? submitError.message : "Unable to login");
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
          "radial-gradient(circle at 10% 10%, rgba(14, 116, 144, 0.18), transparent 32%), linear-gradient(150deg, #f8fafc 0%, #ecfeff 55%, #f0f9ff 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
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
            color: "#0f766e",
            fontWeight: 700,
          }}
        >
          Account Access
        </p>
        <h1 style={{ margin: "8px 0 14px", fontSize: "1.8rem", color: "#0f172a" }}>
          Login
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
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
                : "linear-gradient(120deg, #0f766e 0%, #0284c7 100%)",
              color: "#fff",
              fontWeight: 700,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Checking..." : "Continue"}
          </button>
        </form>

        {message ? (
          <p style={{ margin: "12px 0 0", color: "#047857", fontSize: 14 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 14 }}>{error}</p>
        ) : null}

        <p style={{ margin: "14px 0 0", color: "#475569", fontSize: 14 }}>
          New here? <Link href="/signup">Create an account</Link>
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
