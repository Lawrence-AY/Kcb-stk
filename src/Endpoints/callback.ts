import type { Env } from "../types";

export async function callback(request: Request, env: Env): Promise<Response> {
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

    let receipt: string | null = null;
    let transactionAmount: number | null = null;

    if (success && stk.CallbackMetadata?.Item) {
      const items = stk.CallbackMetadata.Item;
      const receiptItem = items.find((i: any) => i.Name === "MpesaReceiptNumber");
      receipt = receiptItem?.Value || null;

      const amountItem = items.find((i: any) => i.Name === "Amount");
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
      updated_at: new Date().toISOString(),
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateBody),
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
