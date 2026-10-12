import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import https from 'https';

export const OTP_TTL_MS = 5 * 60 * 1000;       // 5 minutes
export const MAX_OTP_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 30 * 1000;   // 30s between resends

export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const hashOtp = (otp) => bcrypt.hash(otp, 10);
export const compareOtp = (otp, hash) => bcrypt.compare(otp, hash);

// ─── Dev-only console OTP printer ────────────────────────────────────────────
const printConsoleOtp = (type, target, otp, note = '') => {
  console.log('\n' + '='.repeat(60));
  console.log(`\x1b[36m[DEV LOCAL OTP]\x1b[0m [${type.toUpperCase()}] Target: \x1b[33m${target}\x1b[0m`);
  console.log(`\x1b[32m\x1b[1m>>> VERIFICATION CODE: ${otp} <<<\x1b[0m`);
  if (note) console.log(`\x1b[90mNote: ${note}\x1b[0m`);
  console.log('='.repeat(60) + '\n');
};

// ─── Missing-env-var warning (printed once when the send is attempted) ────────
const warnMissingEnvVars = (missingVars, provider) => {
  console.log('\n' + '█'.repeat(60));
  console.log(`\x1b[31m\x1b[1m[OTP CONFIG ERROR] ${provider} credentials missing in backend/.env\x1b[0m`);
  console.log('\x1b[33mThe following environment variables are NOT set (empty or missing):\x1b[0m');
  missingVars.forEach((v) => console.log(`  \x1b[31m✗  ${v}\x1b[0m`));
  console.log('\n\x1b[36mHow to fix:\x1b[0m');
  if (provider === 'Email (Gmail SMTP)') {
    console.log('  1. Go to https://myaccount.google.com/security');
    console.log('  2. Enable 2-Step Verification');
    console.log('  3. Create an App Password (select "Mail" app)');
    console.log('  4. Add to backend/.env:');
    console.log('       GMAIL_USER=youraddress@gmail.com');
    console.log('       GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx');
  } else {
    console.log('  ─ For Fast2SMS: Sign up free at https://www.fast2sms.com and add:');
    console.log('       FAST2SMS_API_KEY=your_key_here');
    console.log('  ─ For Twilio: Log in at https://console.twilio.com and add:');
    console.log('       SMS_PROVIDER=twilio');
    console.log('       TWILIO_ACCOUNT_SID=ACxxxxx');
    console.log('       TWILIO_AUTH_TOKEN=your_token');
    console.log('       TWILIO_FROM_NUMBER=+1xxxxxxxxxx');
  }
  console.log('█'.repeat(60) + '\n');
};

// ─── Nodemailer transporter — robust configuration with port fallback ────────
const buildTransporter = (port = 587) => {
  const gmailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const gmailPass = rawPass.replace(/\s+/g, '');

  const missing = [];
  if (!gmailUser) missing.push('EMAIL_USER (or GMAIL_USER)');
  if (!gmailPass) missing.push('GMAIL_APP_PASSWORD (or SMTP_PASS)');
  if (missing.length) return { transporter: null, missing };

  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const isPort465 = Number(port) === 465;

  const config = {
    host: smtpHost,
    port: Number(port),
    secure: isPort465,       // false for 587 (STARTTLS), true for 465 (SSL)
    requireTLS: !isPort465,   // true for 587
    auth: { user: gmailUser, pass: gmailPass },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 5000,    // 5s greeting timeout
    socketTimeout: 15000,     // 15s socket timeout
    tls: {
      rejectUnauthorized: false, // Prevents certificate issues in local dev / corporate firewalls
      minVersion: 'TLSv1.2',
    },
  };

  return { transporter: nodemailer.createTransport(config), missing: [] };
};

// ─── Send Email OTP ───────────────────────────────────────────────────────────
export const sendOtpEmail = async (email, otp) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const initialPort = Number(process.env.SMTP_PORT) || 587;
  const { transporter, missing } = buildTransporter(initialPort);

  // Credentials missing: warn and fallback gracefully in development
  if (!transporter) {
    warnMissingEnvVars(missing, 'Email (Gmail SMTP)');
    if (isDev) {
      printConsoleOtp('EMAIL', email, otp, 'SMTP credentials missing — local dev fallback active.');
      return { success: true, devMode: true, message: 'OTP logged in console for testing.' };
    }
    throw new Error('Email service not configured. Add EMAIL_USER and GMAIL_APP_PASSWORD to backend/.env');
  }

  const senderEmail = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const mailOptions = {
    from: `"ChatApp Verification" <${senderEmail}>`,
    to: email,
    subject: `Your ChatApp Verification Code: ${otp}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;
                  border:1px solid #e9edef;border-radius:16px;background:#ffffff;color:#111b21;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;width:48px;height:48px;border-radius:50%;
                      background:#00a884;line-height:48px;color:#fff;font-size:24px;">💬</div>
          <h2 style="color:#111b21;margin:12px 0 4px;font-size:20px;">ChatApp Verification</h2>
          <p style="color:#667781;font-size:13px;margin:0;">Use this code to verify your identity</p>
        </div>
        <div style="background:#f0f2f5;border-radius:12px;padding:16px;text-align:center;margin:20px 0;">
          <span style="font-size:34px;font-weight:bold;letter-spacing:6px;color:#00a884;
                       font-family:monospace;">${otp}</span>
          <p style="font-size:11px;color:#8696a0;margin:8px 0 0;">
            Valid for 5 minutes. Do not share this code.
          </p>
        </div>
      </div>`,
  };

  try {
    // Primary send attempt with configured/default port 587
    const info = await transporter.sendMail(mailOptions);
    console.log(`\x1b[32m[OTP Email] ✓ Sent to ${email} (port ${initialPort}) — MessageID: ${info?.messageId || 'OK'}\x1b[0m`);
    return { success: true, devMode: false, messageId: info?.messageId || 'OK', message: 'OTP sent to email.' };
  } catch (primaryErr) {
    console.warn(`\x1b[33m[OTP Email Warning] Primary attempt on port ${initialPort} failed: ${primaryErr.message}\x1b[0m`);

    // Automatic fallback: try port 465 if 587 failed (or port 587 if 465 failed)
    const fallbackPort = initialPort === 587 ? 465 : 587;
    try {
      console.log(`\x1b[33m[OTP Email] Retrying via fallback port ${fallbackPort}...\x1b[0m`);
      const fallback = buildTransporter(fallbackPort);
      if (fallback.transporter) {
        const info = await fallback.transporter.sendMail(mailOptions);
        console.log(`\x1b[32m[OTP Email] ✓ Sent to ${email} (fallback port ${fallbackPort}) — MessageID: ${info?.messageId || 'OK'}\x1b[0m`);
        return { success: true, devMode: false, messageId: info?.messageId || 'OK', message: 'OTP sent to email.' };
      }
    } catch (fallbackErr) {
      console.warn(`\x1b[31m[OTP Email Warning] Fallback port ${fallbackPort} also failed: ${fallbackErr.message}\x1b[0m`);
    }

    // Diagnostic log in terminal
    console.error('\n' + '─'.repeat(60));
    console.error(`\x1b[31m[OTP Email SMTP ERROR] Failed to send to: ${email}\x1b[0m`);
    console.error(`\x1b[31m  Message: ${primaryErr.message}\x1b[0m`);
    if (primaryErr.code) console.error(`\x1b[31m  Code   : ${primaryErr.code}\x1b[0m`);
    console.error('─'.repeat(60) + '\n');

    // Graceful local development fallback — never block testing on network drops
    if (isDev) {
      printConsoleOtp('EMAIL', email, otp, 'SMTP socket error or network drop — local dev fallback active.');
      return {
        success: true,
        devMode: true,
        message: 'OTP logged in console for testing.',
      };
    }

    // In production, throw clear error
    throw new Error(`Email SMTP failed: ${primaryErr.message || 'SMTP Authentication / Network error'}`);
  }
};

// ─── Send SMS OTP ─────────────────────────────────────────────────────────────
export const sendOtpSms = async (phone, otp) => {
  // Always log the OTP clearly in the Node console for dev testing (no blocking errors)
  printConsoleOtp('SMS / PHONE', phone, otp, 'Dev testing active — Use this OTP in frontend.');

  const fast2smsKey = (process.env.FAST2SMS_API_KEY || '').trim();
  // Optional background delivery if provider keys are configured
  if (fast2smsKey) {
    try {
      const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
      const apiUrl = `https://www.fast2sms.com/dev/bulkV2` +
        `?authorization=${fast2smsKey}&route=otp&variables_values=${otp}` +
        `&flash=0&numbers=${cleanPhone}`;

      https.get(apiUrl, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          console.log(`[OTP SMS Fast2SMS] HTTP ${res.statusCode} → ${cleanPhone}`);
        });
      }).on('error', (netErr) => {
        console.warn(`[OTP SMS Fast2SMS Non-blocking Error]: ${netErr.message}`);
      });
    } catch (err) {
      console.warn(`[OTP SMS Fast2SMS Non-blocking Error]: ${err.message}`);
    }
  }

  // Never throw blocking errors for phone OTP in dev testing
  return { success: true, phone, devMode: true };
};
