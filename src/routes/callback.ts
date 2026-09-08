import { Request, Response } from 'express';
import { getRegistrationsCollection, serverTimestamp } from '../services/firebase';
import { logger } from '../middleware/logger';

export default async function callback(req: Request, res: Response) {
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    logger.info('STK Push callback received (RAW)', { callback: raw });

    // Try multiple callback structures
    let stk = raw?.Body?.stkCallback;
    
    if (!stk) {
      logger.warn('No stkCallback at Body.stkCallback, trying alternative paths', { 
        keys: Object.keys(raw || {}),
        bodyKeys: Object.keys(raw?.Body || {}),
        raw: JSON.stringify(raw).slice(0, 500)
      });
      
      // Try alternative paths
      stk = raw?.stkCallback || raw?.result || raw;
    }

    if (!stk) {
      logger.warn('Callback structure unrecognized, returning OK', { received: raw });
      return res.status(200).send('OK');
    }

    const MerchantRequestID = stk.MerchantRequestID || stk.merchantRequestId || stk.merchant_request_id;
    const CheckoutRequestID = stk.CheckoutRequestID || stk.checkoutRequestId || stk.checkout_request_id;
    const ResultCode = stk.ResultCode ?? stk.resultCode ?? stk.result_code;
    const ResultDesc = stk.ResultDesc || stk.resultDesc || stk.result_description || stk.statusMessage;
    const CallbackMetadata = stk.CallbackMetadata || stk.callbackMetadata || stk.callback_metadata;
    logger.info('Parsed callback data', { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc });

    const success = Number(ResultCode) === 0;

    let receipt: string | null = null;
    let transactionAmount: number | null = null;
    if (success && CallbackMetadata?.Item) {
      const items = CallbackMetadata.Item;
      const receiptItem = items.find((i: any) => i.Name === 'MpesaReceiptNumber');
      receipt = receiptItem?.Value || null;
      const amountItem = items.find((i: any) => i.Name === 'Amount');
      if (amountItem?.Value) transactionAmount = parseFloat(amountItem.Value);
    }

    const updateData = {
      status: success ? 'paid' : 'failed',
      mpesa_receipt: receipt,
      result_code: ResultCode?.toString(),
      result_desc: ResultDesc,
      transaction_amount: transactionAmount,
      transaction_reference: receipt,
      updated_at: serverTimestamp(),
    };

    if (!MerchantRequestID && !CheckoutRequestID) {
      logger.error('Callback missing both MerchantRequestID and CheckoutRequestID', { stk });
      return res.status(200).send('OK');
    }

    const matchField = MerchantRequestID ? 'merchant_request_id' : 'checkout_request_id';
    const matchValue = MerchantRequestID || CheckoutRequestID;

    logger.info('Executing update query', { matchField, matchValue, updateData });
    const snapshot = await getRegistrationsCollection().where(matchField, '==', matchValue).limit(10).get();
    const checkoutSnapshot = CheckoutRequestID
      ? await getRegistrationsCollection().where('checkout_request_id', '==', CheckoutRequestID).limit(10).get()
      : null;
    const docsToUpdate = new Map<string, any>();

    snapshot.docs.forEach((doc) => docsToUpdate.set(doc.id, doc));
    checkoutSnapshot?.docs.forEach((doc) => docsToUpdate.set(doc.id, doc));

    if (!docsToUpdate.size) {
      logger.warn('Firebase update found no matching registration', { matchField, matchValue, CheckoutRequestID });
    } else {
      await Promise.all([...docsToUpdate.values()].map((doc) => doc.ref.set(updateData, { merge: true })));
      logger.info('Firebase update successful', { rowsAffected: docsToUpdate.size, matchField, matchValue, CheckoutRequestID });
    }

    if (CheckoutRequestID) {
      await getRegistrationsCollection().doc(String(CheckoutRequestID)).set({
        checkout_request_id: CheckoutRequestID,
        merchant_request_id: MerchantRequestID || null,
        ...updateData,
      }, { merge: true });
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('Callback exception', { error: err, message: (err as any)?.message });
    res.status(200).send('OK');
  }
}
