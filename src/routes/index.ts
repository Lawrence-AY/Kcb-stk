import { Request, Response } from 'express';
import { getRegistrationsCollection, serverTimestamp } from '../services/firebase';
import { KcbApiError, stkPush, getToken } from '../services/mpesa';
import { formatPhone, normalizeUrl, pathToCategory } from '../utils/helpers';
import { rateLimit } from '../services/rateLimitStore';
import { logger } from '../middleware/logger';
import { env } from '../config/env';

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const category = pathToCategory(req.path);
    const {
      phone,
      phoneNumber,
      amount,
      name,
      invoiceNumber: inv,
      callbackUrl: requestCallbackUrl,
      transactionDescription,
      description,
    } = req.body;

    const rawPhone = phoneNumber || phone;
    if (!rawPhone || amount === undefined) {
      return res.status(400).json({ error: 'Missing phone or amount' });
    }

    let formattedPhone: string;
    try {
      formattedPhone = formatPhone(rawPhone);
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
    const shortDesc = String(transactionDescription || description || category).slice(0, 30);
    const callbackUrl = requestCallbackUrl
      ? normalizeUrl(requestCallbackUrl)
      : `${env.BACKEND_BASE_URL.replace(/\/$/, '')}/callback`;

    if (!/^https:\/\/[^/\s]+\/.+/i.test(callbackUrl)) {
      return res.status(400).json({
        error: 'Invalid callbackUrl. Use a plain secure HTTPS URL, for example https://your-ngrok-url.ngrok-free.dev/callback',
      });
    }

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

    await getRegistrationsCollection().doc(merchantRequestId).set({
      phone: formattedPhone,
      name: name || null,
      amount: amountNum,
      invoice_number: invoiceNumber,
      checkout_request_id: checkoutRequestId || null,
      merchant_request_id: merchantRequestId,
      request_id: merchantRequestId,
      status: 'pending',
      currency: 'KES',
      channel_code: '207',
      organization_shortcode: env.SHORTCODE,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

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
    if (err instanceof KcbApiError) {
      return res.status(err.status || 502).json({
        error: err.message,
        kcbStatus: err.status,
        details: err.detail,
      });
    }
    res.status(500).json({ error: err.message });
  }
};

export const testAuth = async (req: Request, res: Response) => {
  try {
    const token = await getToken();
    res.json({ success: true, token_preview: token.slice(0, 20) + '...' });
  } catch (err: any) {
    if (err instanceof KcbApiError) {
      return res.status(err.status || 502).json({
        success: false,
        error: err.message,
        kcbStatus: err.status,
        details: err.detail,
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const root = createTransaction; // POST / behaves same as /register
