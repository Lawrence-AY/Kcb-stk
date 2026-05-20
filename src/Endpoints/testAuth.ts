import type { Env } from "../types";
import { corsResponse, getToken } from "./helpers";

export async function testAuth(env: Env): Promise<Response> {
  try {
    const token = await getToken(env);
    return corsResponse({ success: true, token_preview: token.slice(0, 20) + "..." }, 200);
  } catch (err: any) {
    return corsResponse({ success: false, error: err.message }, 500);
  }
}
