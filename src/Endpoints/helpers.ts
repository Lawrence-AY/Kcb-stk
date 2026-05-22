import type { Env } from "../types";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function corsResponse(data: any, status: number): Response {
  return Response.json(data, { status, headers: corsHeaders() });
}

export function jsonError(message: string, status: number): Response {
  return corsResponse({ error: message }, status);
}

export function pathToCategory(path: string): string {
  const map: Record<string, string> = {
    "/register": "registration",
    "/kcbmpesa": "kcb_mpesa",
    "/stkpush": "stk_push",
    "/monthlycontributions": "monthly_contribution",
    "/loans_repayment": "loan_repayment",
    "/fines": "fine",
    "/sharecapital": "share_capital",
    "/wallet": "wallet",
    "/savings": "savings",
  };
  return map[path] || "unknown";
}

export function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  if (!p.startsWith("254") || p.length !== 12) {
    throw new Error("Invalid phone number. Must be 254XXXXXXXXX");
  }
  return p;
}

export async function rateLimit(key: string, limit = 3, windowSec = 60): Promise<boolean> {
  const cache = caches.default;
  const cacheKey = new Request(`https://rate-limit/${key}`);
  const res = await cache.match(cacheKey);
  let count = 0;
  if (res) {
    const data = (await res.json()) as any;
    count = data.count || 0;
  }
  if (count >= limit) return false;
  count++;
  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ count }), {
      headers: { "Cache-Control": `max-age=${windowSec}` },
    })
  );
  return true;
}

export async function getToken(env: Env): Promise<string> {
  const credentials = btoa(`${env.CONSUMER_KEY}:${env.CONSUMER_SECRET}`);
  const res = await fetch(env.OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Token error:", text);
    throw new Error(`Token failed: ${text}`);
  }

  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("No access_token in response");
  return data.access_token;
}
