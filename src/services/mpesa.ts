import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../middleware/logger';

export async function getToken(): Promise<string> {
  const credentials = Buffer.from(`${env.CONSUMER_KEY}:${env.CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.post(
      env.OAUTH_TOKEN_ENDPOINT,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data.access_token;
  } catch (error: any) {
    const detail = error.response?.data || error.message;
    logger.error(`Token fetch failed: ${detail}`);
    throw new Error('Failed to obtain access token');
  }
}

interface StkPushParams {
  phoneNumber: string;
  amount: string;
  invoiceNumber: string;
  callbackUrl: string;
  description: string;
}

export async function stkPush(params: StkPushParams): Promise<any> {
  const token = await getToken();
  const payload = {
    phoneNumber: params.phoneNumber,
    amount: params.amount,
    invoiceNumber: params.invoiceNumber,
    sharedShortCode: true,
    orgShortCode: env.SHORTCODE,
    orgPassKey: env.PASSKEY,
    callbackUrl: params.callbackUrl,
    transactionDescription: params.description,
  };
  const targetUrl = `${env.BUNI_BASE_URL.replace(/\/$/, '')}/mm/api/request/1.0.0/stkpush`;
  const response = await axios.post(targetUrl, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}