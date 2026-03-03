import { NextResponse } from "next/server";

// Returns public-safe config derived from server env vars.
// The actual API key and full URL never leave the server.
export async function GET() {
  const configured = !!(
    process.env.LANGGRAPH_API_URL && process.env.LANGSMITH_API_KEY
  );
  return NextResponse.json({
    configured,
    assistantId: process.env.LANGGRAPH_ASSISTANT_ID ?? null,
  });
}
