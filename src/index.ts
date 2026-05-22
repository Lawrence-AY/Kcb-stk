import type { Env } from "./types";
import { rootEndpoint, testAuth, createTransaction, callback } from "./Endpoints";
import { pathToCategory } from "./Endpoints/helpers";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname === "/" && request.method === "POST") {
      return rootEndpoint(request, env);
    }

    if (url.pathname === "/test-auth" && request.method === "GET") {
      return testAuth(env);
    }

    const endpoints = [
      "/register",
      "/kcbmpesa",
      "/stkpush",
      "/monthlycontributions",
      "/loans_repayment",
      "/fines",
      "/sharecapital",
      "/wallet",
      "/savings",
    ];

    if (endpoints.includes(url.pathname) && request.method === "POST") {
      const category = pathToCategory(url.pathname);
      return createTransaction(request, env, category);
    }

    if (url.pathname === "/callback" && request.method === "POST") {
      return callback(request, env);
    }

    return new Response("Not allowed", { status: 405 });
  },
};
