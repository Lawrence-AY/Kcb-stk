import type { Env } from "../types";
import { corsResponse, jsonError, formatPhone, rateLimit, getToken } from "./helpers";

export async function createTransaction(request: Request, env: Env, category: string): Promise<Response> {
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
    const invoiceNumber = requestedInvoiceNumber
      ? requestedInvoiceNumber.toString().trim()
      : `AYEDOSSACCO-${category.slice(0, 6)}-${Date.now().toString().slice(-6)}`;
    const shortDesc = category.slice(0, 13);

    const phoneOk = await rateLimit(`phone:${phone}`, 3, 60);
    if (!phoneOk) return jsonError("Too many requests for this phone. Try again in 1 minute.", 429);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipOk = await rateLimit(`ip:${ip}`, 10, 60);
    if (!ipOk) return jsonError("Too many requests from this IP.", 429);

    console.log(`${category} request:`, { phone, amount, invoiceNumber });

    const token = await getToken(env);
    const callbackUrl = `${env.WORKER_BASE_URL}/callback`;

    const stkPayload = {
      phoneNumber: phone,
      amount: amount.toString(),
      invoiceNumber: invoiceNumber,
      sharedShortCode: true,
      orgShortCode: env.SHORTCODE,
      orgPassKey: env.PASSKEY,
      callbackUrl: callbackUrl,
      transactionDescription: shortDesc,
    };

    const baseUrl = env.BUNI_BASE_URL.replace(/\/$/, "");
    const targetUrl = `${baseUrl}/mm/api/request/1.0.0/stkpush`;

    const stkRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
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

    const dbPayload: Record<string, any> = {
      phone: phone,
      name: name,
      amount: amount,
      invoice_number: invoiceNumber,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      request_id: merchantRequestId,
      status: "pending",
      currency: "KES",
      channel_code: "207",
      organization_shortcode: env.SHORTCODE,
    };

    const supabaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/registrations`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(dbPayload),
    });

    if (!supabaseRes.ok) {
      console.error("Failed to save transaction to database:", await supabaseRes.text());
    }

    return corsResponse(
      {
        success: true,
        merchantRequestId: merchantRequestId,
        checkoutRequestId: checkoutRequestId,
        invoiceNumber,
        category,
        message: customerMessage || "STK Push sent successfully",
      },
      200
    );
  } catch (err: any) {
    console.error(err);
    return jsonError(err.message, 500);
  }
}
