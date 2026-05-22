# KCB M-Pesa STK Push - Official Spec Compliance

**Specification Document:** KCB M-Pesa STK Push API Specification v1.0  
**Implementation Status:** ✅ COMPLIANT  
**Last Updated:** 2026-05-15

---

## 📋 Request Compliance

### Authentication ✅
| Spec Requirement | Implementation | Status |
|-----------------|-----------------|--------|
| Method | Basic Auth with Consumer Key:Secret | ✅ Correct |
| Token Endpoint | `/token?grant_type=client_credentials` | ✅ Fixed |
| Header | `Authorization: Basic {base64_credentials}` | ✅ Correct |

### STK Push Request ✅
| Spec Requirement | Implementation | Status |
|-----------------|-----------------|--------|
| **Endpoint** | POST `/mm/api/request/1.0.0/stkpush` | ✅ Correct |
| **Content-Type** | `application/json` | ✅ Correct |

### Request Payload ✅

| Parameter | Type | Required | Spec | Implementation | Status |
|-----------|------|----------|------|-----------------|--------|
| phoneNumber | String(20) | ✅ YES | Format: 254XXXXXXXXX | Validated & formatted | ✅ |
| amount | String(30) | ✅ YES | Amount to transfer | Converted to string | ✅ |
| invoiceNumber | String(30) | ✅ YES | Format: KCBTILLNO-YOURACCREF | `KCBTILLNO-{CATEGORY}-{TIMESTAMP}` | ✅ |
| sharedShortCode | Boolean | ✅ YES | Set to true for KCB shortcode | Always `true` | ✅ |
| orgShortCode | String(30) | ❌ Optional | Organization's shortcode | From `env.SHORTCODE` | ✅ |
| orgPassKey | String(30) | ❌ Optional | Unique passkey | From `env.PASSKEY` | ✅ |
| transactionDescription | String(30) | ❌ Optional | Payment description | Generated from category | ✅ |
| callbackUrl | String(50) | ✅ YES | Must be secure URL | From `env.WORKER_BASE_URL` | ✅ |

**Sample Request per Spec:**
```json
{
  "phoneNumber": "254700123456",
  "amount": "1",
  "invoiceNumber": "KCBTILLNO-YOURACCREF",
  "sharedShortCode": true,
  "orgShortCode": "522522",
  "orgPassKey": "your_passkey",
  "callbackUrl": "https://posthere.io/f613-4b7f-b82b",
  "transactionDescription": "school fee payment"
}
```

**Our Implementation:**
```json
{
  "phoneNumber": "254758871032",
  "amount": "1",
  "invoiceNumber": "KCBTILLNO-REGISTRATION-1778837",
  "sharedShortCode": true,
  "orgShortCode": "522522",
  "orgPassKey": "your_actual_passkey",
  "callbackUrl": "https://your-worker.workers.dev/callback",
  "transactionDescription": "registration payment"
}
```
✅ **MATCHES SPEC**

---

## 📤 Response Compliance

### Success Response Structure ✅

**Per Spec:**
```json
{
  "response": {
    "MerchantRequestID": "7432-920544-1",
    "ResponseCode": "0",
    "CustomerMessage": "Success. Request accepted for processing",
    "CheckoutRequestID": "ws_CO_...",
    "ResponseDescription": "Success. Request accepted for processing"
  },
  "header": {
    "statusDescription": "Success. Request accepted for processing",
    "statusCode": "0"
  }
}
```

**Our Validation:**
- ✅ Extracts `header.statusCode` → Must be "0"
- ✅ Extracts `response.ResponseCode` → Must be "0"
- ✅ Extracts `response.MerchantRequestID` → Stores in DB
- ✅ Extracts `response.CheckoutRequestID` → Stores in DB (optional)
- ✅ Uses `response.CustomerMessage` for user feedback

### Error Response Handling ✅

**Per Spec - Invalid Token:**
```json
{
  "fault": {
    "code": 900901,
    "message": "Invalid Credentials",
    "description": "Invalid Credentials. Make sure you have given the correct access token"
  }
}
```
**Our Code:** ✅ Detects `fault` object and returns 401 error

**Per Spec - Bad Request:**
```json
{
  "response": {},
  "header": {
    "statusDescription": "STK Push Backend Posting Failure: Bad Request - Invalid Remarks",
    "statusCode": "1"
  }
}
```
**Our Code:** ✅ Checks `header.statusCode !== "0"` and returns 400 error

---

## 🔔 Callback Compliance

### Expected Callback Format ✅

**Per Spec - Success:**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "17684-56147665-1",
      "CheckoutRequestID": "ws_CO_21072023153404650713165445",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 1.00},
          {"Name": "MpesaReceiptNumber", "Value": "ABCDE12345"},
          {"Name": "TransactionDate", "Value": 20230721153232},
          {"Name": "PhoneNumber", "Value": 254700000000}
        ]
      }
    }
  }
}
```

**Our Implementation:**
- ✅ Parses `Body.stkCallback`
- ✅ Extracts `MerchantRequestID` (used as primary key)
- ✅ Extracts `CheckoutRequestID` (backup identifier)
- ✅ Checks `ResultCode === 0` for success
- ✅ Extracts from `CallbackMetadata.Item`:
  - Amount
  - MpesaReceiptNumber
  - TransactionDate
  - PhoneNumber

### Possible Callback Result Codes ✅

| ResultCode | ResultDesc | Our Handling | Status |
|-----------|-----------|--------------|--------|
| 0 | "The service request is processed successfully." | Mark as "paid" | ✅ |
| 1037 | "DS timeout user cannot be reached" | Mark as "failed" | ✅ |
| 2001 | "The initiator information is invalid." | Mark as "failed" | ✅ |
| 1032 | "Request cancelled by user" | Mark as "failed" | ✅ |

**Our Code:**
```typescript
const success = resultCode === 0;
status: success ? "paid" : "failed"
```
✅ **CORRECT**

---

## 🔐 Security Compliance

| Requirement | Our Implementation | Status |
|------------|------------------|--------|
| Callback URL must be HTTPS | Enforced via env config | ✅ |
| Store credentials as secrets | Via wrangler secrets | ✅ |
| Validate phone numbers | Format check: 254XXXXXXXXX | ✅ |
| Rate limiting | Per phone + IP | ✅ |
| Proper HTTP headers | CORS, Content-Type | ✅ |

---

## 🚀 HTTP Response Codes ✅

Per Spec:
| Code | Meaning | Our Use |
|------|---------|---------|
| 200 | Request processed successfully | STK Push sent ✅ |
| 400 | Bad request | Invalid payload, bad response ✅ |
| 401 | Unauthorized | Invalid credentials ✅ |
| 403 | Forbidden | (Not used) |
| 404 | Resource not found | (Not used) |
| 500 | Internal error | Database/server errors ✅ |

---

## 📊 Database Schema Alignment

**Per Spec:** MerchantRequestID is primary identifier, CheckoutRequestID is optional

**Our Schema:**
```sql
CREATE TABLE registrations (
  merchant_request_id TEXT PRIMARY KEY,  -- Primary per spec
  checkout_request_id TEXT,               -- Optional per spec
  status TEXT,                            -- pending/paid/failed
  mpesa_receipt TEXT,                     -- From callback
  result_code TEXT,                       -- ResultCode from callback
  result_desc TEXT,                       -- ResultDesc from callback
  transaction_amount DECIMAL,             -- From callback Amount
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```
✅ **CORRECT**

---

## ✨ Key Changes Made (2026-05-15)

1. **Token Endpoint:** Changed from `/oauth2/token` → `/token?grant_type=client_credentials` (per spec)
2. **Response Parsing:** Now correctly uses `response.ResponseCode` to validate (per spec)
3. **Request IDs:** Prioritizes MerchantRequestID over CheckoutRequestID (per spec)
4. **Error Handling:** Now checks for `fault` object for authentication errors (per spec)
5. **Callback Processing:** Uses MerchantRequestID as primary identifier (per spec)
6. **Removed custom headers:** Removed `routeCode`, `operation`, `messageId` (not in spec)

---

## 📝 Configuration Checklist

Before deployment:

- [ ] Get PASSKEY from KCB dashboard
- [ ] Set CONSUMER_KEY via: `wrangler secret put CONSUMER_KEY`
- [ ] Set CONSUMER_SECRET via: `wrangler secret put CONSUMER_SECRET`
- [ ] Set SUPABASE_KEY via: `wrangler secret put SUPABASE_KEY`
- [ ] Set PASSKEY via: `wrangler secret put PASSKEY`
- [ ] Update WORKER_BASE_URL in `wrangler.jsonc`
- [ ] Update BUNI_BASE_URL (prod: `https://buni.kcbgroup.com`)
- [ ] Ensure callback URL registered with KCB

---

## 🧪 Testing Per Spec

### 1. Test Authentication
```bash
curl --location 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials' \
  --header 'Authorization: Basic YOUR_BASE64_CREDENTIALS' \
  --header 'Content-Type: application/x-www-form-urlencoded'
```

### 2. Test STK Push (via Worker)
```bash
curl -X POST "http://localhost:8787/register" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254712345678",
    "amount": 100,
    "name": "Test User"
  }'
```

Expected 200 response with `merchantRequestId`.

### 3. Test Callback (Simulate)
```bash
curl -X POST "http://localhost:8787/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-123",
        "CheckoutRequestID": "ws_CO_test",
        "ResultCode": 0,
        "ResultDesc": "The service request is processed successfully.",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 100},
            {"Name": "MpesaReceiptNumber", "Value": "ABC123"}
          ]
        }
      }
    }
  }'
```

Expected: 200 response with "OK", database updated.

---

## 📞 Production Deployment

Per Spec Section "Production Requirements":

1. **Duly signed request letter** (template from API developer portal)
2. **Send to:** buni@kcbgroup.com
3. **Get approval** before using production endpoints

**Production URL:** `https://buni.kcbgroup.com`

---

## 📖 References

- Official Spec: KCB M-Pesa STK Push API Specification v1.0
- Sandbox Portal: https://sandbox.buni.kcbgroup.com/devportal/apis
- Getting Started: https://buni.kcbgroup.com/getting-started
- Support: buni@kcbgroup.com
