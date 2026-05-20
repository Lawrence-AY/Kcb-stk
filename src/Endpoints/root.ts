import type { Env } from "../types";
import { createTransaction } from "./createTransaction";

export async function rootEndpoint(request: Request, env: Env): Promise<Response> {
  return createTransaction(request, env, "registration");
}
