import { Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { stkPush, getToken } from '../services/mpesa';
import { formatPhone, pathToCategory } from '../utils/helpers';
import { rateLimit } from '../services/rateLimitStore';
import { logger } from '../middleware/logger';
import { env } from '../config/env';

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const category = pathToCategory(req.path);
    const { phone, amount, name, invoiceNumber: inv } = req.body;

    if (!phone || amount === undefined) {
      return res.status(400).json({ error: 'Missing phone or amount' });
    }

    let formattedPhone: string;
    try {
      formattedPhone = formatPhone(phone);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Phone rate limit
    const phoneLimitOk = await rateLimit(`phone:${formattedPhone}`, 3, 60);
    if (!phoneLimitOk) {
      return res.status(429).json({ error: 'Too many requests for this phone. Try again in 1 minute.' });
    }

    // IP rate limit
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ipLimitOk = await rateLimit(`ip:${clientIp}`, 10, 60);
    if (!ipLimitOk) {
      return res.status(429).json({ error: 'Too many requests from this IP.' });
    }

    const invoiceNumber = inv || `AYEDOSSACCO-${category.slice(0, 6)}-${Date.now().toString().slice(-6)}`;
    const shortDesc = category.slice(0, 13);
    const callbackUrl = `${env.WORKER_BASE_URL.replace(/\/$/, '')}/callback`;

    const stkResult = await stkPush({
      phoneNumber: formattedPhone,
      amount: amountNum.toString(),
      invoiceNumber,
      callbackUrl,
      description: shortDesc,
    });

    // Error handling based on your original Worker logic
    if (stkResult.fault) {
      return res.status(401).json({ error: `KCB API Error: ${stkResult.fault.message}` });
    }

    const header = stkResult.header || {};
    const stkResponse = stkResult.response || {};
    if (header.statusCode !== '0' || stkResponse.ResponseCode !== '0') {
      const errorMsg = stkResponse.CustomerMessage || header.statusDescription || 'STK Push failed';
      return res.status(400).json({ error: errorMsg });
    }

    const merchantRequestId = stkResponse.MerchantRequestID;
    const checkoutRequestId = stkResponse.CheckoutRequestID;

    if (!merchantRequestId) {
      return res.status(500).json({ error: 'STK Push response missing MerchantRequestID' });
    }

    // Save to Supabase
    const { error: dbError } = await supabase.from('registrations').insert({
      phone: formattedPhone,
      name: name || null,
      amount: amountNum,
      invoice_number: invoiceNumber,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      request_id: merchantRequestId,
      status: 'pending',
      currency: 'KES',
      channel_code: '207',
      organization_shortcode: env.SHORTCODE,
    });

    if (dbError) {
      logger.error('Supabase insert error', dbError);
    }

    res.json({
      success: true,
      merchantRequestId,
      checkoutRequestId,
      invoiceNumber,
      category,
      message: stkResponse.CustomerMessage || 'STK Push sent successfully',
    });
  } catch (err: any) {
    logger.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const testAuth = async (req: Request, res: Response) => {
  try {
    const token = await getToken();
    res.json({ success: true, token_preview: token.slice(0, 20) + '...' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const root = createTransaction; // POST / behaves same as /register