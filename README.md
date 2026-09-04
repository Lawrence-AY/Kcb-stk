# KCB M-Pesa Express Backend

Node.js and Express backend for KCB M-Pesa STK Push requests and callbacks.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with your KCB, Firebase, and callback settings.

Use `BACKEND_BASE_URL` for the public URL KCB should call back to, for example an ngrok URL during local testing.

You can use either `CONSUMER_KEY` / `CONSUMER_SECRET` or `KCB_USERNAME` / `KCB_PASSWORD`. They are used to generate the Basic Auth token required by KCB.

```env
PORT=3000
BACKEND_BASE_URL=https://your-public-url.ngrok-free.app
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIRESTORE_DATABASE_ID=(default)
FIRESTORE_REGISTRATIONS_COLLECTION=registrations
OAUTH_TOKEN_ENDPOINT=
BUNI_BASE_URL=
KCB_USERNAME=
KCB_PASSWORD=
KCB_SHARED_SHORTCODE=true
KCB_ORG_SHORTCODE=
KCB_ORG_PASSKEY=
```

3. Start the Express server:

```bash
npm run dev
```

4. Test in Postman:

```text
GET  http://localhost:3000/health
GET  http://localhost:3000/test-auth
POST http://localhost:3000/register
POST http://localhost:3000/kcbmpesa
POST http://localhost:3000/stkpush
POST http://localhost:3000/monthlycontributions
POST http://localhost:3000/loans_repayment
POST http://localhost:3000/fines
POST http://localhost:3000/sharecapital
POST http://localhost:3000/wallet
POST http://localhost:3000/savings
POST http://localhost:3000/callback
GET  http://localhost:3000/callback-test
```

Sample STK request body:

```json
{
  "phoneNumber": "254712345678",
  "amount": "1",
  "invoiceNumber": "KCBTILLNO-YOURACCREF",
  "transactionDescription": "school fee payment",
  "name": "Test Member"
}
```
