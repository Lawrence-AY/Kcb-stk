export function pathToCategory(path: string): string {
  const map: Record<string, string> = {
    '/register': 'registration',
    '/kcbmpesa': 'kcb_mpesa',
    '/stkpush': 'stk_push',
    '/monthlycontributions': 'monthly_contribution',
    '/loans_repayment': 'loan_repayment',
    '/fines': 'fine',
    '/sharecapital': 'share_capital',
    '/wallet': 'wallet',
    '/savings': 'savings',
  };
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return map[cleanPath] || 'unknown';
}

export function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  if (!p.startsWith('254') || p.length !== 12) {
    throw new Error('Invalid phone number. Must be 254XXXXXXXXX');
  }
  return p;
}