import { NextRequest, NextResponse } from "next/server";

import { getAuth0Client } from "../../../../lib/auth0";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
const ALLOWED_METHODS = new Set(["GET", "PATCH", "POST"]);

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  if (
    !ALLOWED_METHODS.has(request.method) ||
    path.some((segment) => !segment || segment === "." || segment === "..") ||
    path[0] !== "api" ||
    path[1] !== "v1"
  ) {
    return NextResponse.json(
      { message: "BFF route not allowed" },
      { status: 404 },
    );
  }
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "Origin not allowed" },
      { status: 403 },
    );
  }

  let token: string;
  try {
    ({ token } = await getAuth0Client().getAccessToken());
  } catch {
    return NextResponse.json(
      { code: "SESSION_EXPIRED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const target = new URL(`/${path.map(encodeURIComponent).join("/")}`, API_URL);
  target.search = request.nextUrl.search;
  const contentType = request.headers.get("content-type");
  const idempotencyKey = request.headers.get("idempotency-key");
  const response = await fetch(target, {
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      "X-Request-ID": crypto.randomUUID(),
    },
    method: request.method,
    signal: AbortSignal.timeout(10_000),
  });

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
    },
    status: response.status,
  });
}

export const GET = forward;
export const PATCH = forward;
export const POST = forward;
