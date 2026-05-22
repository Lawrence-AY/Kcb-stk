import express, { json, urlencoded } from 'express';
import cors from 'cors';
import { httpLogger } from './middleware/logger';
import { whitelistIpAndGeo } from './middleware/security';
import { ipLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';
import * as routes from './routes';
import callbackRoute from './routes/callback';

const app = express();

// Trust proxy (Cloudflare, nginx)
app.set('trust proxy', true);

// Global middleware
app.use(cors({
  origin: '*',
  methods: ['POST', 'OPTIONS', 'GET'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));
app.use(httpLogger);
app.use(whitelistIpAndGeo);
app.use(ipLimiter);

app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true }));

// Routes
app.post('/', routes.root);
app.get('/test-auth', routes.testAuth);
app.post('/register', routes.createTransaction);
app.post('/kcbmpesa', routes.createTransaction);
app.post('/stkpush', routes.createTransaction);
app.post('/monthlycontributions', routes.createTransaction);
app.post('/loans_repayment', routes.createTransaction);
app.post('/fines', routes.createTransaction);
app.post('/sharecapital', routes.createTransaction);
app.post('/wallet', routes.createTransaction);
app.post('/savings', routes.createTransaction);
app.post('/callback', callbackRoute);

// Error handling
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});