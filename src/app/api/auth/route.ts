import { NextRequest, NextResponse } from "next/server";

const APP_PIN = process.env.APP_PIN;
const AUTH_SECRET = process.env.AUTH_SECRET;
const COOKIE_NAME = "app_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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

// GET — check if the current request is authenticated
export async function GET(request: NextRequest) {
  if (!APP_PIN || !AUTH_SECRET) {
    return NextResponse.json({ authenticated: true });
  }
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return NextResponse.json({ authenticated: false });
  const expected = await computeToken(APP_PIN, AUTH_SECRET);
  return NextResponse.json({ authenticated: cookie === expected });
}

// POST — validate PIN and set auth cookie
export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (!APP_PIN || !AUTH_SECRET) {
    // Dev mode: no PIN configured, always allow
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "dev", cookieOptions());
    return res;
  }

  if (pin !== APP_PIN) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = await computeToken(pin, AUTH_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, cookieOptions());
  return res;
}

// DELETE — log out
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}
