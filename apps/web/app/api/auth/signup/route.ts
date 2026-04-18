import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../../lib/env";

type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SignupPayload;
    const fullName = body.fullName?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!fullName || !email || !password) {
      return NextResponse.json(
        {
          error: "signup_failed",
          message: "Full name, email, and password are required",
        },
        { status: 422 },
      );
    }

    const upstream = await fetch(getServiceUrl("claims", "/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
      }),
      cache: "no-store",
    });

    const data = (await upstream.json()) as
      | { verified?: boolean; message?: string; user?: unknown }
      | { detail?: unknown; message?: string };

    if (!upstream.ok) {
      const detailText =
        typeof data === "object" && data && "detail" in data
          ? JSON.stringify(data.detail)
          : null;

      return NextResponse.json(
        {
          error: "signup_failed",
          message:
            (typeof data === "object" && data && "message" in data
              ? data.message
              : undefined) || detailText || `HTTP_${upstream.status}`,
        },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { error: "signup_failed", message },
      { status: 502 },
    );
  }
}
