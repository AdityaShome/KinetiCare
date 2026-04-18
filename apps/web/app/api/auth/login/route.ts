import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../../lib/env";
import { fetchJson } from "../../../../lib/http";

type LoginPayload = {
  email: string;
  password: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginPayload;
    const response = await fetchJson<{ verified: boolean; message: string; user?: unknown }>(
      getServiceUrl("claims", "/auth/login"),
      {
        method: "POST",
        payload: {
          email: body.email,
          password: body.password,
        },
        timeoutMs: 15000,
        retries: 1,
      },
    );

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { error: "login_failed", message },
      { status: 502 },
    );
  }
}
