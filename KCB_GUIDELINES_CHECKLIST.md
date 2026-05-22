# KCB M-Pesa Integration Guidelines Checklist

## ✅ Compliance Status

### STK Push Implementation
- ✅ Phone number validation (Kenyan format 254XXXXXXXXX)
- ✅ Amount validation and formatting
- ✅ Invoice number generation with timestamp
- ✅ Request ID tracking (CheckoutRequestID, MerchantRequestID)
- ✅ Proper KCB Multi-Channel Service Architecture headers (routeCode, operation, messageId)
- ✅ Callback URL configuration
- ✅ Rate limiting per phone and IP

### Callback Processing
- ✅ Proper STK callback parsing from M-Pesa
- ✅ Receipt number extraction
- ✅ Transaction amount tracking
- ✅ Status mapping (success/failed based on ResultCode)
- ✅ Database synchronization

### Security & Configuration
- ✅ Authorization header with Bearer token
- ✅ CORS headers properly set
- ✅ Environment-based configuration
- ✅ Secrets management preparation

---

## 🔴 CRITICAL ISSUES FIXED

### 1. **Removed Hard-coded URLs**
- ❌ **Before:** `const WORKER_BASE_URL = "https://f4a1-197-232-142-204.ngrok-free.app"`
- ✅ **After:** `WORKER_BASE_URL` comes from `env.WORKER_BASE_URL` (wrangler.jsonc)
- **Impact:** Prevents callback failures in production

### 2. **PASSKEY Configuration Validation**
- ✅ Added validation to check if PASSKEY is configured
- ✅ Returns clear error if PASSKEY is placeholder
- **Action Required:** Set via wrangler secrets (see below)

### 3. **Improved Error Messages**
- ✅ Replaced obscure error descriptions with clear, actionable messages
- ✅ Examples: "Missing identifier indexes..." → "STK Push response missing CheckoutRequestID"

### 4. **Updated Type Definitions**
- ✅ All required fields marked as non-optional
- ✅ WORKER_BASE_URL added to Env type

---

## 🚀 SETUP INSTRUCTIONS

### 1. **Configure Secrets (NOT in .env)**

```bash
# Set these secrets using wrangler CLI
wrangler secret put CONSUMER_KEY
# Paste: 7uHG5YbIE50l6FrIkn1QQEgacMAa

wrangler secret put CONSUMER_SECRET
# Paste: f3Px_gRjHcv7IabPfGN5dG0xZZka

wrangler secret put SUPABASE_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtc2dvd3Z3Z2J2c3BkeWp3YnJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE2ODkyMSwiZXhwIjoyMDkxNzQ0OTIxfQ.BQCG-CkaQ8ENMz7I27PIPc9amGA9S49uj9t1ui6w9kQ

wrangler secret put PASSKEY
# Paste: your_actual_passkey_here
```

### 2. **Update wrangler.jsonc**

Update these environment variables:

```jsonc
"vars": {
  "BUNI_BASE_URL": "https://uat.buni.kcbgroup.com",  // UAT URL
  "SUPABASE_URL": "https://smsgowvwgbvspdyjwbrh.supabase.co",
  "WORKER_BASE_URL": "https://your-deployed-worker-url.workers.dev",  // UPDATE THIS
  "SHORTCODE": "522522"  // Your KCB shortcode
}
```

### 3. **Remove .env from Git**

```bash
# Add to .gitignore
echo ".env" >> .gitignore
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## 📋 KCB API Requirements

### STK Push Endpoint
- **URL:** `https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush`
- **Method:** POST
- **Headers Required:**
  - `Authorization: Bearer {access_token}`
  - `Content-Type: application/json`
  - `routeCode: 207` (M-Pesa channel)
  - `operation: STKPush`
  - `messageId: {unique_tracking_id}`

### Payload Structure
```json
{
  "phoneNumber": "254712345678",
  "amount": "100",
  "invoiceNumber": "KCBTILLNO-{CATEGORY}-{TIMESTAMP}",
  "sharedShortCode": true,
  "orgShortCode": "522522",
  "orgPassKey": "your_passkey",
  "callbackUrl": "https://your-worker.workers.dev/callback",
  "transactionDescription": "Payment description"
}
```

### Response Format
```json
{
  "header": {
    "statusCode": "0",
    "statusDescription": "Success"
  },
  "response": {
    "CheckoutRequestID": "...",
    "MerchantRequestID": "..."
  }
}
```

---

## ✨ Recent Code Improvements

### 1. **Clearer Comments**
- Replaced vague descriptions with specific KCB architecture references
- Improved log messages for debugging

### 2. **Better Error Handling**
- Explicit validation of PASSKEY configuration
- Clear error messages for database failures
- Proper status code checks

### 3. **Type Safety**
- All required environment variables marked as non-optional
- Prevents undefined errors at runtime

### 4. **Configuration Management**
- WORKER_BASE_URL now environment-based
- SHORTCODE defined in config (not hard-coded)
- Easy to switch between dev/staging/prod

---

## 🧪 Testing STK Push

### 1. **Test Authentication**
```bash
curl -X GET "http://localhost:8787/test-auth"
```

Expected response:
```json
{
  "success": true,
  "token_preview": "eyJhbGciOi..."
}
```

### 2. **Test STK Push**
```bash
curl -X POST "http://localhost:8787/register" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+254712345678",
    "amount": 100,
    "name": "John Doe",
    "user_id": "user123"
  }'
```

Expected response:
```json
{
  "success": true,
  "checkoutRequestId": "...",
  "category": "registration",
  "message": "STK Push sent successfully"
}
```

### 3. **Simulate Callback**
```bash
curl -X POST "http://localhost:8787/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "...",
        "CheckoutRequestID": "...",
        "ResultCode": 0,
        "ResultDesc": "The service request has been processed successfully.",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 100},
            {"Name": "MpesaReceiptNumber", "Value": "LKL71H9B60"}
          ]
        }
      }
    }
  }'
```

---

## 📊 Database Schema Expected

The code expects a `registrations` table in Supabase with:

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
  status TEXT DEFAULT 'pending', -- pending, paid, failed
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

---

## 🔒 Security Best Practices

1. ✅ **Never commit secrets** - Use wrangler secrets
2. ✅ **Rate limiting** - Implemented per phone/IP
3. ✅ **CORS headers** - Properly configured
4. ✅ **Input validation** - Phone format checked
5. ✅ **Error logging** - Sensitive data not logged

### Recommended Additional Steps:
- [ ] Implement request signature verification from KCB
- [ ] Add IP whitelist for callback requests
- [ ] Set up monitoring/alerting for failed STK pushes
- [ ] Log all transactions for audit trail

---

## 📝 Deployment Checklist

- [ ] Run `wrangler secret put` for all secrets
- [ ] Update `WORKER_BASE_URL` in wrangler.jsonc
- [ ] Verify `SHORTCODE` matches your KCB account
- [ ] Test authentication endpoint
- [ ] Deploy: `wrangler deploy`
- [ ] Update KCB dashboard with new callback URL
- [ ] Test STK push with real phone number
- [ ] Verify callback updates database
- [ ] Monitor logs for errors

---

## ⚠️ Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "PASSKEY not configured" | PASSKEY not set or placeholder | Run `wrangler secret put PASSKEY` |
| Callback fails to reach endpoint | Wrong WORKER_BASE_URL | Update WORKER_BASE_URL in wrangler.jsonc |
| "No access_token in response" | Invalid CONSUMER_KEY/SECRET | Verify credentials with KCB |
| Database sync fails | Invalid SUPABASE_KEY | Check Supabase project settings |
| Rate limit errors | Too many requests | Wait 60 seconds or request from different phone/IP |

---

## 📞 Support
For KCB M-Pesa API documentation: https://uat.buni.kcbgroup.com/developers
For Supabase issues: https://supabase.com/docs
