import { NextRequest, NextResponse } from "next/server";

const APP_PIN = process.env.APP_PIN;
const AUTH_SECRET = process.env.AUTH_SECRET;
const COOKIE_NAME = "app_auth";

async function computeToken(pin: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(pin));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function middleware(request: NextRequest) {
  // Only guard the LangGraph proxy
  if (!request.nextUrl.pathname.startsWith("/api/langgraph")) {
    return NextResponse.next();
  }

  // Dev mode: no PIN configured → allow through
  if (!APP_PIN || !AUTH_SECRET) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = await computeToken(APP_PIN, AUTH_SECRET);
  if (cookie !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/langgraph/:path*",
};
