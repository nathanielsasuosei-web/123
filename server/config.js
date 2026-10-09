import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

function str(name, fallback = '') {
  const v = env[name];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}

export const config = {
  rootDir: path.resolve(here, '..'),
  publicDir: path.resolve(here, '..', 'public'),
  port: Number(str('PORT', '4000')),
  siteName: str('SITE_NAME', 'Beat Store'),
  siteUrl: str('SITE_URL', 'http://localhost:4000').replace(/\/+$/, ''),
  authSecret: str('AUTH_SECRET'),
  adminEmail: str('ADMIN_EMAIL').toLowerCase(),
  adminPassword: str('ADMIN_PASSWORD'),
  adminName: str('ADMIN_NAME', 'Producer'),
  dataDir: path.resolve(str('DATA_DIR', path.join(here, '..', 'data'))),
  paystackKey: str('PAYSTACK_SECRET_KEY'),
  currency: str('PAYMENT_CURRENCY', 'GHS').toUpperCase(),
  smtp: {
    host: str('SMTP_HOST'),
    port: Number(str('SMTP_PORT', '587')),
    secure: str('SMTP_SECURE', '0') === '1',
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS'),
  },
  mailFrom: str('MAIL_FROM', 'Beat Store <no-reply@example.com>'),
  attachMaxBytes: Number(str('EMAIL_ATTACH_MAX_MB', '10')) * 1024 * 1024,
  momo: { number: str('MOMO_NUMBER'), name: str('MOMO_NAME') },
  bank: {
    name: str('BANK_NAME'),
    accountName: str('BANK_ACCOUNT_NAME'),
    accountNumber: str('BANK_ACCOUNT_NUMBER'),
  },
};

export const paymentMode = () => (config.paystackKey ? 'paystack' : 'test');
export const emailMode = () => (config.smtp.host ? 'smtp' : 'outbox');
