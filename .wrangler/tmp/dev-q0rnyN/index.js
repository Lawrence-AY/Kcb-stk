var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/Endpoints/helpers.ts
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function corsResponse(data, status) {
  return Response.json(data, { status, headers: corsHeaders() });
}
__name(corsResponse, "corsResponse");
function jsonError(message, status) {
  return corsResponse({ error: message }, status);
}
__name(jsonError, "jsonError");
function pathToCategory(path) {
  const map = {
    "/register": "registration",
    "/kcbmpesa": "kcb_mpesa",
    "/stkpush": "stk_push",
    "/monthlycontributions": "monthly_contribution",
    "/loans_repayment": "loan_repayment",
    "/fines": "fine",
    "/sharecapital": "share_capital",
    "/wallet": "wallet",
    "/savings": "savings"
  };
  return map[path] || "unknown";
}
__name(pathToCategory, "pathToCategory");
function formatPhone(phone) {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  if (!p.startsWith("254") || p.length !== 12) {
    throw new Error("Invalid phone number. Must be 254XXXXXXXXX");
  }
  return p;
}
__name(formatPhone, "formatPhone");
async function rateLimit(key, limit = 3, windowSec = 60) {
  const cache = caches.default;
  const cacheKey = new Request(`https://rate-limit/${key}`);
  const res = await cache.match(cacheKey);
  let count = 0;
  if (res) {
    const data = await res.json();
    count = data.count || 0;
  }
  if (count >= limit) return false;
  count++;
  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ count }), {
      headers: { "Cache-Control": `max-age=${windowSec}` }
    })
  );
  return true;
}
__name(rateLimit, "rateLimit");
async function getToken(env) {
  const credentials = btoa(`${env.CONSUMER_KEY}:${env.CONSUMER_SECRET}`);
  const res = await fetch(env.OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
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
__name(getToken, "getToken");

// src/Endpoints/createTransaction.ts
async function createTransaction(request, env, category) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return jsonError("Invalid JSON body", 400);
    const phone = formatPhone(body.phone);
    const rawAmount = body.amount?.toString();
    if (!rawAmount || !/^[0-9]+$/.test(rawAmount)) {
      return jsonError("Invalid amount. Use an integer value with no decimals.", 400);
    }
    const amount = parseInt(rawAmount, 10);
    if (amount <= 0) {
      return jsonError("Amount must be greater than zero.", 400);
    }
    const name = body.name || null;
    const requestedInvoiceNumber = body.invoiceNumber || body.invoice_number || body.member_number || body.reference;
    const invoiceNumber = requestedInvoiceNumber ? requestedInvoiceNumber.toString().trim() : `AYEDOSSACCO-${category.slice(0, 6)}-${Date.now().toString().slice(-6)}`;
    const shortDesc = category.slice(0, 13);
    const phoneOk = await rateLimit(`phone:${phone}`, 3, 60);
    if (!phoneOk) return jsonError("Too many requests for this phone. Try again in 1 minute.", 429);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipOk = await rateLimit(`ip:${ip}`, 10, 60);
    if (!ipOk) return jsonError("Too many requests from this IP.", 429);
    console.log(`${category} request:`, { phone, amount, invoiceNumber });
    const token = await getToken(env);
    const configuredCallbackUrl = env.CALLBACK_URL?.trim() || (env.BACKEND_BASE_URL?.trim() ? `${env.BACKEND_BASE_URL.trim().replace(/\/+$/, "")}/api/mpesa/callback` : `${env.WORKER_BASE_URL?.trim().replace(/\/+$/, "")}/callback`);
    let callbackUrl;
    try {
      const parsedCallbackUrl = new URL(configuredCallbackUrl);
      if (parsedCallbackUrl.protocol !== "https:") throw new Error("Callback URL must use HTTPS");
      callbackUrl = parsedCallbackUrl.toString();
    } catch (error) {
      return jsonError(`Invalid M-Pesa callback configuration: ${error.message}`, 500);
    }
    const stkPayload = {
      phoneNumber: phone,
      amount: amount.toString(),
      invoiceNumber,
      sharedShortCode: true,
      orgShortCode: env.SHORTCODE,
      orgPassKey: env.PASSKEY,
      callbackUrl,
      transactionDescription: shortDesc
    };
    const baseUrl = env.BUNI_BASE_URL.replace(/\/$/, "");
    const targetUrl = `${baseUrl}/mm/api/request/1.0.0/stkpush`;
    const stkRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stkPayload)
    });
    const rawResponse = await stkRes.text();
    console.log("STK raw response:", rawResponse);
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      return jsonError(`Invalid structure or HTTP status encountered from KCB endpoint: ${rawResponse}`, 500);
    }
    if (parsedResponse?.fault) {
      const faultCode = parsedResponse.fault.code;
      const faultMsg = parsedResponse.fault.message;
      return jsonError(`KCB API Error [${faultCode}]: ${faultMsg}`, 401);
    }
    const statusCode = parsedResponse?.header?.statusCode;
    const statusDesc = parsedResponse?.header?.statusDescription || "Unknown error";
    if (statusDesc.toLowerCase().includes("failure") || statusDesc.toLowerCase().includes("error")) {
      if (statusDesc.toLowerCase().includes("authentication")) {
        return jsonError(
          `STK Authentication failed. Verify PASSKEY and SHORTCODE. Error: ${statusDesc}`,
          401
        );
      }
      return jsonError(`STK Push failed: ${statusDesc}`, 400);
    }
    if (statusCode !== "0") {
      return jsonError(`STK Push failed [${statusCode}]: ${statusDesc}`, 400);
    }
    if (!parsedResponse?.response || Object.keys(parsedResponse.response).length === 0) {
      return jsonError(
        `STK Push response body empty. ${statusDesc}. Verify credentials with KCB.`,
        400
      );
    }
    const checkoutRequestId = parsedResponse?.response?.CheckoutRequestID || null;
    const merchantRequestId = parsedResponse?.response?.MerchantRequestID || null;
    const responseCode = parsedResponse?.response?.ResponseCode || null;
    const customerMessage = parsedResponse?.response?.CustomerMessage || statusDesc;
    if (responseCode !== "0") {
      return jsonError(`STK Push response code [${responseCode}]: ${customerMessage}`, 400);
    }
    if (!merchantRequestId) {
      return jsonError("STK Push response missing MerchantRequestID", 500);
    }
    const dbPayload = {
      phone,
      name,
      amount,
      invoice_number: invoiceNumber,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      request_id: merchantRequestId,
      status: "pending",
      currency: "KES",
      channel_code: "207",
      organization_shortcode: env.SHORTCODE
    };
    const supabaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/registrations`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(dbPayload)
    });
    if (!supabaseRes.ok) {
      console.error("Failed to save transaction to database:", await supabaseRes.text());
    }
    return corsResponse(
      {
        success: true,
        merchantRequestId,
        checkoutRequestId,
        invoiceNumber,
        category,
        message: customerMessage || "STK Push sent successfully"
      },
      200
    );
  } catch (err) {
    console.error(err);
    return jsonError(err.message, 500);
  }
}
__name(createTransaction, "createTransaction");

// src/Endpoints/root.ts
async function rootEndpoint(request, env) {
  return createTransaction(request, env, "registration");
}
__name(rootEndpoint, "rootEndpoint");

// src/Endpoints/testAuth.ts
async function testAuth(env) {
  try {
    const token = await getToken(env);
    return corsResponse({ success: true, token_preview: token.slice(0, 20) + "..." }, 200);
  } catch (err) {
    return corsResponse({ success: false, error: err.message }, 500);
  }
}
__name(testAuth, "testAuth");

// src/Endpoints/callback.ts
async function callback(request, env) {
  try {
    const raw = await request.text();
    console.log("STK Push callback received", { size: raw.length });
    const data = JSON.parse(raw);
    const stk = data?.Body?.stkCallback;
    if (!stk) {
      console.log("Callback does not contain STK result, ignoring");
      return new Response("OK");
    }
    const merchantRequestId = stk.MerchantRequestID;
    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = stk.ResultCode;
    const resultDesc = stk.ResultDesc;
    const success = resultCode === 0;
    let receipt = null;
    let transactionAmount = null;
    if (success && stk.CallbackMetadata?.Item) {
      const items = stk.CallbackMetadata.Item;
      const receiptItem = items.find((i) => i.Name === "MpesaReceiptNumber");
      receipt = receiptItem?.Value || null;
      const amountItem = items.find((i) => i.Name === "Amount");
      if (amountItem?.Value) {
        transactionAmount = parseFloat(amountItem.Value.toString());
      }
    }
    const updateBody = {
      status: success ? "paid" : "failed",
      mpesa_receipt: receipt,
      result_code: resultCode?.toString(),
      result_desc: resultDesc,
      transaction_amount: transactionAmount,
      transaction_reference: receipt,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    let matchQuery = "";
    if (merchantRequestId) {
      matchQuery = `merchant_request_id=eq.${merchantRequestId}`;
    } else if (checkoutRequestId) {
      matchQuery = `checkout_request_id=eq.${checkoutRequestId}`;
    }
    if (!matchQuery) {
      console.error("Cannot update database: missing MerchantRequestID or CheckoutRequestID");
      return new Response("OK");
    }
    const updateRes = await fetch(`${env.SUPABASE_URL}/rest/v1/registrations?${matchQuery}`, {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updateBody)
    });
    if (!updateRes.ok) {
      console.error("Failed to update transaction status in database:", await updateRes.text());
    }
    return new Response("OK");
  } catch (err) {
    console.error("Callback processing error:", err);
    return new Response("OK");
  }
}
__name(callback, "callback");

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
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
      "/savings"
    ];
    if (endpoints.includes(url.pathname) && request.method === "POST") {
      const category = pathToCategory(url.pathname);
      return createTransaction(request, env, category);
    }
    if (url.pathname === "/callback" && request.method === "POST") {
      return callback(request, env);
    }
    return new Response("Not allowed", { status: 405 });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError2;

// .wrangler/tmp/bundle-xNS4DC/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-xNS4DC/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
