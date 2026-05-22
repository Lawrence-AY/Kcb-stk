# Setup Guide: KCB M-Pesa Worker

## Prerequisites
- Cloudflare Workers account
- KCB Buni API credentials (CONSUMER_KEY, CONSUMER_SECRET)
- Supabase project with database
- Node.js 18+ and npm

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables

#### Set Wrangler Secrets (REQUIRED for production/secrets)
```bash
wrangler secret put CONSUMER_KEY
# Paste your KCB consumer key

wrangler secret put CONSUMER_SECRET
# Paste your KCB consumer secret

wrangler secret put SUPABASE_KEY
# Paste your Supabase JWT key

wrangler secret put PASSKEY
# Paste your KCB M-Pesa passkey
```

#### Update wrangler.jsonc
Update these public variables:
```json
{
  "vars": {
    "BUNI_BASE_URL": "https://uat.buni.kcbgroup.com",
    "SUPABASE_URL": "https://your-project.supabase.co",
    "WORKER_BASE_URL": "https://your-project.workers.dev",
    "SHORTCODE": "your_shortcode"
  }
}
```

### 3. Development

```bash
# Start local development server
npm run dev
# Opens http://localhost:8787

# View Swagger UI documentation
# Navigate to http://localhost:8787/ in browser
```

### 4. Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# The worker will be available at:
# https://kcb-mpesa.your-account.workers.dev
```

## Environment Variables Reference

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| BUNI_BASE_URL | Var | KCB API base URL | `https://uat.buni.kcbgroup.com` |
| SUPABASE_URL | Var | Supabase project URL | `https://abc123.supabase.co` |
| WORKER_BASE_URL | Var | Your worker URL for callbacks | `https://kcb-mpesa.workers.dev` |
| SHORTCODE | Var | KCB merchant shortcode | `522522` |
| CONSUMER_KEY | Secret | KCB API consumer key | From KCB dashboard |
| CONSUMER_SECRET | Secret | KCB API consumer secret | From KCB dashboard |
| SUPABASE_KEY | Secret | Supabase service role key | From Supabase dashboard |
| PASSKEY | Secret | M-Pesa passkey for STK | From KCB dashboard |

## Endpoints

### Health Check
```
GET /
```
Returns list of available endpoints.

### Test Authentication
```
GET /test-auth
```
Verifies CONSUMER_KEY and CONSUMER_SECRET are valid.

### Register (STK Push)
```
POST /register
Content-Type: application/json

{
  "phone": "+254712345678",
  "amount": 100,
  "name": "John Doe",
  "user_id": "optional-user-id"
}
```

### Other STK Push Endpoints
- `POST /monthlycontributions`
- `POST /loans_repayment`
- `POST /fines`
- `POST /sharecapital`
- `POST /wallet`
- `POST /savings`

All require the same payload structure as `/register`.

### Callback (M-Pesa Result)
```
POST /callback
```
Receives and processes M-Pesa transaction results. Called automatically by KCB.

## Database Setup

Create the `registrations` table in Supabase:

```sql
CREATE TABLE registrations (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT,
  amount DECIMAL NOT NULL,
  invoice_number TEXT,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  request_id TEXT,
  status TEXT DEFAULT 'pending',
  currency TEXT DEFAULT 'KES',
  channel_code TEXT DEFAULT '207',
  organization_shortcode TEXT,
  user_id TEXT,
  mpesa_receipt TEXT,
  result_code TEXT,
  result_desc TEXT,
  transaction_amount DECIMAL,
  transaction_reference TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_checkout_id ON registrations(checkout_request_id);
CREATE INDEX idx_merchant_id ON registrations(merchant_request_id);
CREATE INDEX idx_phone ON registrations(phone);
```

## Troubleshooting

### "PASSKEY not configured"
Solution: Run `wrangler secret put PASSKEY` with your actual passkey.

### Authentication test fails
Solution: Verify CONSUMER_KEY and CONSUMER_SECRET match your KCB account.

### Callback not received
Solution: Ensure WORKER_BASE_URL is correct and callback URL is updated in KCB dashboard.

### Database errors
Solution: Check SUPABASE_URL and SUPABASE_KEY are correct, and `registrations` table exists.

## Next Steps

1. [ ] Configure all secrets using `wrangler secret put`
2. [ ] Update wrangler.jsonc with your values
3. [ ] Test with `npm run dev`
4. [ ] Deploy with `npm run deploy`
5. [ ] Update callback URL in KCB dashboard
6. [ ] Test with real M-Pesa transaction

For more details, see [KCB_GUIDELINES_CHECKLIST.md](./KCB_GUIDELINES_CHECKLIST.md)
