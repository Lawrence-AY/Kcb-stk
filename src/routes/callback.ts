import { Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { logger } from '../middleware/logger';

export default async function callback(req: Request, res: Response) {
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    logger.info('STK Push callback received', { callback: raw });

    const stk = raw?.Body?.stkCallback;
    if (!stk) {
      return res.status(200).send('OK');
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stk;
    const success = ResultCode === 0;

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
      updated_at: new Date().toISOString(),
    };

    let query = supabase.from('registrations').update(updateData);
    if (MerchantRequestID) {
      query = query.eq('merchant_request_id', MerchantRequestID);
    } else if (CheckoutRequestID) {
      query = query.eq('checkout_request_id', CheckoutRequestID);
    } else {
      logger.error('Callback missing MerchantRequestID and CheckoutRequestID');
      return res.status(200).send('OK');
    }

    const { error } = await query;
    if (error) {
      logger.error('Supabase update error', error);
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error(err);
    res.status(200).send('OK');
  }
}