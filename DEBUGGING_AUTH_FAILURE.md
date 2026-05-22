# STK Authentication Failure - Debugging Guide

## Error Message
```
"STK Push response body empty. STK Authentication failure. Verify credentials with KCB."
```

## Root Causes (in order of likelihood)

### 1. ❌ PASSKEY is Incorrect or Placeholder

**Current in .env:**
```env
PASSKEY=your_passkey
```

**Status:** This is a placeholder and will NOT work.

**Solution:**
- Get your actual PASSKEY from KCB Buni dashboard
- Update `.env`:
  ```env
  PASSKEY=your_actual_passkey_from_kcb
  ```
- Restart dev server: `npm run dev`

---

### 2. ❌ SHORTCODE Doesn't Match Your Merchant Account

**Current in wrangler.jsonc:**
```json
"SHORTCODE": "522522"
```

**Solution:**
- Verify your actual shortcode from KCB dashboard
- Update in `wrangler.jsonc`:
  ```json
  "SHORTCODE": "your_actual_shortcode"
  ```

**Common shortcodes:**
- `522533` - KCB Paybill (common for testing)
- `522522` - Your organization's shortcode
- Check your KCB merchant portal for the exact value

---

### 3. ❌ Credentials Don't Match Between Systems

**The payload sent to KCB includes:**
```json
{
  "orgShortCode": "522522",        // From env.SHORTCODE
  "orgPassKey": "your_passkey"     // From env.PASSKEY
}
```

**What KCB expects:**
- `orgShortCode` must be registered in KCB for your account
- `orgPassKey` must match the passkey registered for that shortcode
- They must be linked together

**Solution:**
1. Log into KCB Buni dashboard
2. Go to **Settings → M-Pesa Configuration** (or similar)
3. Find your shortcode
4. Verify the passkey matches
5. Copy both values and update `.env` and `wrangler.jsonc`

---

## Step-by-Step Verification

### Step 1: Get Correct Credentials from KCB

**Go to:** https://uat.buni.kcbgroup.com/

1. Login with your merchant account
2. Navigate to **API/Developer Settings** or **M-Pesa Configuration**
3. Look for:
   - **Shortcode:** Note the exact value
   - **Passkey:** Copy the full passkey
   - **Consumer Key:** Already have this
   - **Consumer Secret:** Already have this

### Step 2: Update Your Configuration

**File 1: `.env`**
```env
SUPABASE_URL=https://smsgowvwgbvspdyjwbrh.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

CONSUMER_KEY=7uHG5YbIE50l6FrIkn1QQEgacMAa
CONSUMER_SECRET=f3Px_gRjHcv7IabPfGN5dG0xZZka

SHORTCODE=522522                              # ← Verify this
PASSKEY=your_actual_passkey_from_kcb           # ← Replace this
```

**File 2: `wrangler.jsonc`**
```json
"vars": {
  "BUNI_BASE_URL": "https://uat.buni.kcbgroup.com",
  "SUPABASE_URL": "https://smsgowvwgbvspdyjwbrh.supabase.co",
  "WORKER_BASE_URL": "https://kcb-mpesa.simrion.workers.dev",
  "SHORTCODE": "522522"                       # ← Verify this matches .env
}
```

### Step 3: Restart Dev Server
```bash
npm run dev
```

### Step 4: Test Again
```bash
curl -X POST "http://localhost:8787/register" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254712345678",
    "amount": 100,
    "name": "Test User"
  }'
```

---

## Common Credential Formats

### PASSKEY
- Length: Usually 20-50 characters
- Format: Mix of uppercase, lowercase, numbers, sometimes special chars
- Example: `bfb279f9437018fd8313f6ca8356253d`

### SHORTCODE
- Length: 6 digits
- Format: Numeric only
- Example: `522522`, `522533`

### CONSUMER_KEY / CONSUMER_SECRET
- Length: 30+ characters each
- Already configured correctly ✅

---

## Testing Tools

### Option 1: Test Authentication Endpoint
```bash
curl -X GET "http://localhost:8787/test-auth"
```

**Expected Response:**
```json
{
  "success": true,
  "token_preview": "eyJhbGciOi..."
}
```

If this fails: **Consumer Key/Secret are invalid**

### Option 2: Verify Token Directly
```bash
curl --location 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials' \
  --header 'Authorization: Basic YOUR_BASE64_ENCODED_CREDENTIALS' \
  --header 'Content-Type: application/x-www-form-urlencoded'
```

Replace `YOUR_BASE64_ENCODED_CREDENTIALS` with base64 of `CONSUMER_KEY:CONSUMER_SECRET`

---

## If Still Failing After Verification

### 1. **Check Current Configuration:**
```bash
# View current vars in dev server output
npm run dev
# Look at the "Your Worker has access to the following bindings" section
```

### 2. **Ensure .env is Being Loaded:**
```bash
# Restart with clean state
npm run dev
# Should show .env values in startup output
```

### 3. **Log the Exact Payload Being Sent:**
Add this before the fetch call in `src/index.ts`:
```typescript
console.log("STK Payload:", JSON.stringify(stkPayload, null, 2));
console.log("Shortcode:", env.SHORTCODE);
console.log("PassKey length:", env.PASSKEY?.length);
```

### 4. **Contact KCB Support:**
- Email: buni@kcbgroup.com
- Subject: "STK Authentication Failure - Invalid Credentials Error"
- Include:
  - Your merchant account details
  - Shortcode being used
  - Error response from API
  - Consumer Key (first 5 chars only)

---

## Success Indicators

When configured correctly, you should see:

**STK Push Request:**
```json
{
  "phone": "254758871032",
  "amount": 1,
  "invoiceNumber": "KCBTILLNO-REGISTRATION-1778838"
}
```

**STK Push Response (200):**
```json
{
  "success": true,
  "merchantRequestId": "7432-920544-1",
  "checkoutRequestId": "ws_CO_...",
  "category": "registration",
  "message": "Success. Request accepted for processing"
}
```

**Not this:**
```json
{
  "error": "STK Authentication failed. Verify PASSKEY and SHORTCODE..."
}
```

---

## Checklist Before Deployment

- [ ] PASSKEY is actual value (not "your_passkey" placeholder)
- [ ] SHORTCODE matches KCB merchant account
- [ ] PASSKEY + SHORTCODE pair is registered together in KCB
- [ ] CONSUMER_KEY and CONSUMER_SECRET work (test-auth passes)
- [ ] .env file is not committed to git
- [ ] wrangler.jsonc has correct SHORTCODE
- [ ] WORKER_BASE_URL is correct deployment URL
- [ ] Database table `registrations` exists in Supabase
- [ ] Callback URL is registered with KCB

---

## Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| "Authentication failure" | PASSKEY | Get actual value from KCB dashboard |
| Empty response body | SHORTCODE | Verify matches merchant account |
| Token fails | Consumer Key/Secret | Run `npm run dev` to reload .env |
| Callback not received | WORKER_BASE_URL | Update in wrangler.jsonc |

---

## Files to Review

1. `.env` - Your local secrets
2. `wrangler.jsonc` - Environment variables
3. `src/index.ts` - STK Push logic (search for `orgPassKey`)
4. `KCB_SPEC_COMPLIANCE.md` - Spec alignment
