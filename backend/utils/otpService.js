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
  console.log(`\x1b[36m[LOCAL DEV OTP - ${type.toUpperCase()}]\x1b[0m Target: \x1b[33m${target}\x1b[0m`);
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

// ─── Nodemailer transporter — built fresh each call (no broken cache) ─────────
const buildTransporter = () => {
  const gmailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').trim();

  const missing = [];
  if (!gmailUser) missing.push('EMAIL_USER (or GMAIL_USER)');
  if (!gmailPass) missing.push('GMAIL_APP_PASSWORD');
  if (missing.length) return { transporter: null, missing };

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const config = (smtpHost && smtpHost !== 'smtp.gmail.com')
    ? {
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: gmailUser, pass: gmailPass },
      }
    : { service: 'gmail', auth: { user: gmailUser, pass: gmailPass } };

  return { transporter: nodemailer.createTransport(config), missing: [] };
};

// ─── Send Email OTP ───────────────────────────────────────────────────────────
export const sendOtpEmail = async (email, otp) => {
  const { transporter, missing } = buildTransporter();

  // Credentials missing: warn and throw explicit error
  if (!transporter) {
    warnMissingEnvVars(missing, 'Email (Gmail SMTP)');
    throw new Error('Email service not configured. Add EMAIL_USER and GMAIL_APP_PASSWORD to backend/.env');
  }

  // Credentials present — attempt real send
  const senderEmail = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER).trim();
  try {
    const info = await transporter.sendMail({
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
    });
    console.log(`\x1b[32m[OTP Email] ✓ Sent to ${email} — MessageID: ${info?.messageId || 'OK'}\x1b[0m`);
    return info;
  } catch (smtpErr) {
    // Detailed SMTP error in the Node terminal
    console.error('\n' + '─'.repeat(60));
    console.error(`\x1b[31m[OTP Email SMTP ERROR] Failed to send to: ${email}\x1b[0m`);
    console.error(`\x1b[31m  Error Code   : ${smtpErr.code || 'N/A'}\x1b[0m`);
    console.error(`\x1b[31m  Response Code: ${smtpErr.responseCode || smtpErr.status || 'N/A'}\x1b[0m`);
    console.error(`\x1b[31m  Message      : ${smtpErr.message}\x1b[0m`);
    if (smtpErr.response) {
      console.error(`\x1b[31m  SMTP Response: ${smtpErr.response}\x1b[0m`);
    }
    console.error('─'.repeat(60) + '\n');

    // Explicit error thrown when SMTP fails
    throw new Error(`Email SMTP failed: ${smtpErr.message || 'SMTP Authentication / Network error'}`);
  }
};

// ─── Send SMS OTP ─────────────────────────────────────────────────────────────
export const sendOtpSms = async (phone, otp) => {
  // Always log the OTP clearly in the Node console for dev testing (no blocking errors)
  printConsoleOtp('SMS / PHONE', phone, otp, 'Dev testing active — Use this OTP in frontend.');

  // Optional background delivery if provider keys are configured
  const fast2smsKey = (process.env.FAST2SMS_API_KEY || '').trim();
  const twilioSid   = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const twilioFrom  = (process.env.TWILIO_FROM_NUMBER || '').trim();
  const smsProvider = (process.env.SMS_PROVIDER || 'fast2sms').toLowerCase();

  if (fast2smsKey && smsProvider !== 'twilio') {
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
  } else if (twilioSid && twilioToken && twilioFrom) {
    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(twilioSid, twilioToken);
      client.messages.create({
        body: `Your ChatApp verification code is ${otp}. Valid for 5 minutes.`,
        from: twilioFrom,
        to: phone,
      }).then((result) => {
        console.log(`\x1b[32m[OTP SMS] ✓ Twilio sent to ${phone} — SID: ${result.sid}\x1b[0m`);
      }).catch((err) => {
        console.warn(`[OTP SMS Twilio Non-blocking Error]: ${err.message}`);
      });
    } catch (err) {
      console.warn(`[OTP SMS Twilio Non-blocking Error]: ${err.message}`);
    }
  }

  // Never throw blocking errors for phone OTP in dev testing
  return { success: true, phone, devMode: true };
};
