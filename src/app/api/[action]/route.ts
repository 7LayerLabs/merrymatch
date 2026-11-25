import { adminDb } from "@/server/admin";
import { ApiError, handlers, type Ctx } from "@/server/actions";


const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const entry = handlers[action];
  if (!entry) return Response.json({ ok: false, error: "Unknown action." }, { status: 404, headers: NO_STORE });

  // Same-origin writes only.
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const selfOrigin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") || `${proto}://${host}`;
  if (origin && new URL(origin).host !== host) {
    return Response.json({ ok: false, error: "Blocked." }, { status: 403, headers: NO_STORE });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    const maxBytes = action === "aiParseList" ? 4_000_000 : 200_000;
    if (text.length > maxBytes) throw new ApiError(413, "That's too much to send at once.");
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 400;
    return Response.json({ ok: false, error: e instanceof ApiError ? e.message : "Bad request." }, { status, headers: NO_STORE });
  }

  const ctx: Ctx = { user: null, origin: selfOrigin };
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) {
    try {
      const u = await adminDb.auth.verifyToken(token);
      if (u) ctx.user = { id: u.id, email: (u.email as string | null) ?? null };
    } catch {
      /* treated as signed out */
    }
  }
  if (entry.auth && !ctx.user) {
    return Response.json({ ok: false, error: "Please sign in again.", signin: true }, { status: 401, headers: NO_STORE });
  }

  try {
    const data = await entry.handler(body, ctx);
    return Response.json({ ok: true, ...data }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ ok: false, error: e.message }, { status: e.status, headers: NO_STORE });
    console.error(`[api/${action}]`, e);
    return Response.json(
      { ok: false, error: "Something hiccuped on our end. Please try again." },
      { status: 500, headers: NO_STORE },
    );
  }
}
