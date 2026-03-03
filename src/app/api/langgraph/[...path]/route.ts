import { NextRequest, NextResponse } from "next/server";

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL;
const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY;

type Params = Promise<{ path: string[] }>;

async function proxy(request: NextRequest, params: Params): Promise<Response> {
  if (!LANGGRAPH_API_URL || !LANGSMITH_API_KEY) {
    return NextResponse.json(
      { error: "LangGraph not configured on server" },
      { status: 503 }
    );
  }

  const { path } = await params;
  const targetPath = path.join("/");
  const search = request.nextUrl.searchParams.toString();
  const url = `${LANGGRAPH_API_URL}/${targetPath}${search ? `?${search}` : ""}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!["host", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("X-Api-Key", LANGSMITH_API_KEY);

  const hasBody = !["GET", "HEAD"].includes(request.method);

  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // @ts-expect-error — duplex required for streaming request bodies
    duplex: "half",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export const GET    = (req: NextRequest, { params }: { params: Params }) => proxy(req, params);
export const POST   = (req: NextRequest, { params }: { params: Params }) => proxy(req, params);
export const PUT    = (req: NextRequest, { params }: { params: Params }) => proxy(req, params);
export const PATCH  = (req: NextRequest, { params }: { params: Params }) => proxy(req, params);
export const DELETE = (req: NextRequest, { params }: { params: Params }) => proxy(req, params);
