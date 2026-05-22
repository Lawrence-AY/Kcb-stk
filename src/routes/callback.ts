import { Request, Response } from 'express';
import { supabase } from '../services/supabase';
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

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stk;
    logger.info('Parsed callback data', { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc });

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

    if (!MerchantRequestID && !CheckoutRequestID) {
      logger.error('Callback missing both MerchantRequestID and CheckoutRequestID', { stk });
      return res.status(200).send('OK');
    }

    // Update with the appropriate identifier
    let query = supabase.from('registrations').update(updateData);
    const matchField = MerchantRequestID ? 'merchant_request_id' : 'checkout_request_id';
    const matchValue = MerchantRequestID || CheckoutRequestID;
    
    query = query.eq(matchField, matchValue);
    
    logger.info('Executing update query', { matchField, matchValue, updateData });
    const { data, error } = await query.select();
    
    if (error) {
      logger.error('Supabase update error', { error, matchField, matchValue });
    } else {
      logger.info('Supabase update successful', { rowsAffected: data?.length || 0, data });
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('Callback exception', { error: err, message: (err as any)?.message });
    res.status(200).send('OK');
  }
}