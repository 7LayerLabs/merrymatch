"use client";
import { db } from "./db";

export class ClientError extends Error {
  constructor(message: string, public status = 0, public signin = false) {
    super(message);
  }
}

// One call shape for every server action. Retries once on network blips,
// and turns every failure into a friendly sentence.
export async function api<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const user = await db.getAuth();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user?.refresh_token) headers.Authorization = `Bearer ${user.refresh_token}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/${action}`, { method: "POST", headers, body: JSON.stringify(body) });
      let data: { ok?: boolean; error?: string; signin?: boolean } & Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        throw new ClientError("We couldn't reach Merry Match. Check your connection and try again.", res.status);
      }
      if (!res.ok || !data.ok) {
        if (res.status >= 500 && attempt === 0) {
          lastErr = new ClientError(data.error || "Something hiccuped.", res.status);
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        throw new ClientError(data.error || "Something went wrong.", res.status, !!data.signin);
      }
      return data as T;
    } catch (e) {
      if (e instanceof ClientError) throw e;
      lastErr = e;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
    }
  }
  if (lastErr instanceof ClientError) throw lastErr;
  throw new ClientError("We couldn't reach Merry Match. Check your connection and try again.");
}
