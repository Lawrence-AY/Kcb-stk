import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../middleware/logger';

export class KcbApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = 'KcbApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function getToken(): Promise<string> {
  if (!env.CONSUMER_KEY || !env.CONSUMER_SECRET) {
    throw new Error('KCB credentials are missing. Set CONSUMER_KEY/CONSUMER_SECRET or KCB_USERNAME/KCB_PASSWORD in .env');
  }

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
        validateStatus: () => true,
      }
    );

    if (response.status < 200 || response.status >= 300 || !response.data?.access_token) {
      logger.error('Token fetch rejected by KCB', {
        status: response.status,
        detail: response.data,
      });
      throw new KcbApiError('KCB token request failed', response.status, response.data);
    }

    return response.data.access_token;
  } catch (error: any) {
    if (error instanceof KcbApiError) throw error;
    const detail = error.response?.data || error.message;
    logger.error('Token fetch failed', { detail });
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
    sharedShortCode: env.SHARED_SHORTCODE,
    orgShortCode: env.SHARED_SHORTCODE ? '' : env.SHORTCODE,
    orgPassKey: env.SHARED_SHORTCODE ? '' : env.PASSKEY,
    callbackUrl: params.callbackUrl,
    transactionDescription: params.description,
  };
  const targetUrl = `${env.BUNI_BASE_URL.replace(/\/$/, '')}/mm/api/request/1.0.0/stkpush`;
  const response = await axios.post(targetUrl, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    logger.error('KCB STK push request rejected', {
      status: response.status,
      detail: response.data,
      payload: {
        ...payload,
        orgPassKey: payload.orgPassKey ? '[configured]' : '',
      },
    });
    throw new KcbApiError('KCB STK push request failed', response.status, response.data);
  }

  return response.data;
}
