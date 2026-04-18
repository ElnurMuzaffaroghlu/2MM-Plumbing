require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

// ============ VALIDATE REQUIRED ENV VARS ============
const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ============ EMAIL TRANSPORTER (singleton) ============
let emailTransporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

// ============ SECURITY MIDDLEWARE ============
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'self'", "https://www.google.com"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for contact form
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// File upload config with server-side type validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// ============ INPUT SANITIZATION ============
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeMd(str) {
  if (!str) return '';
  return String(str).replace(/[_*`\[\]]/g, '\\$&');
}

// ============ SEND TELEGRAM MESSAGE ============
function sendTelegram(text) {
  const postData = JSON.stringify({
    chat_id: CHAT_ID,
    text,
    parse_mode: 'Markdown'
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${TELEGRAM_API}/sendMessage`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.ok) {
            console.error('Telegram error:', data);
            reject(new Error(data.description || 'Telegram send failed'));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(new Error('Invalid Telegram response'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============ SEND TELEGRAM PHOTO ============
function sendTelegramPhoto(filePath, caption) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (readErr, fileData) => {
      if (readErr) return reject(readErr);

      const boundary = '----FormBoundary' + Date.now();
      const fileName = path.basename(filePath);

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption || ''}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`),
        fileData,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const url = new URL(`${TELEGRAM_API}/sendPhoto`);
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.ok) console.error('Telegram photo error:', parsed);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Invalid Telegram photo response'));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  });
}

// ============ SEND EMAIL ============
function sendEmail(subject, html, attachments) {
  if (!emailTransporter) {
    console.log('Email not configured, skipping');
    return Promise.resolve(null);
  }

  return emailTransporter.sendMail({
    from: `"2MM Contractor Website" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject,
    html,
    attachments
  });
}

// ============ CLEANUP HELPER ============
function cleanupFiles(files) {
  files.forEach(f => {
    fs.unlink(f.path, err => {
      if (err && err.code !== 'ENOENT') console.error('Cleanup error:', err.message);
    });
  });
}

// ============ FORM SUBMISSION ENDPOINT ============
app.post('/api/contact', contactLimiter, upload.array('photos', 5), async (req, res) => {
  const photos = req.files || [];

  try {
    const { name, phone, email, services, message, county } = req.body;

    // Server-side validation
    if (!name || !String(name).trim()) {
      cleanupFiles(photos);
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if ((!phone || !String(phone).trim()) && (!email || !String(email).trim())) {
      cleanupFiles(photos);
      return res.status(400).json({ success: false, error: 'Phone or email is required' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      cleanupFiles(photos);
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (!county || !String(county).trim()) {
      cleanupFiles(photos);
      return res.status(400).json({ success: false, error: 'County is required' });
    }
    if ((!services || !String(services).trim()) && (!message || !String(message).trim())) {
      cleanupFiles(photos);
      return res.status(400).json({ success: false, error: 'Service type or description is required' });
    }

    // Sanitize inputs
    const safeName = escapeMd(String(name).trim());
    const safePhone = escapeMd(String(phone || '').trim());
    const safeEmail = escapeMd(String(email || '').trim());
    const safeServices = escapeMd(String(services || '').trim());
    const safeMessage = escapeMd(String(message || '').trim().substring(0, 500));
    const safeCounty = escapeMd(String(county).trim());

    const contactMethod = email ? 'Email' : 'Phone';
    const contactValue = safeEmail || safePhone;

    // Build Telegram message
    let msg = '\uD83D\uDD14 *New Service Request*\n\n';
    msg += `*Name:* ${safeName}\n`;
    msg += `*Contact via:* ${contactMethod} \u2014 ${contactValue}\n`;
    if (phone && email) {
      msg += `*Phone:* ${safePhone}\n`;
      msg += `*Email:* ${safeEmail}\n`;
    }
    if (services) msg += `*Service:* ${safeServices}\n`;
    if (message) msg += `*Description:* ${safeMessage}\n`;
    if (county) msg += `*County:* ${safeCounty} County\n`;
    if (photos.length > 0) msg += `*Photos:* ${photos.length} attached\n`;
    msg += '\n_From 2mmcontractor.com_';

    // Build email HTML
    const h = {
      name: escapeHtml(String(name).trim()),
      phone: escapeHtml(String(phone || '').trim()),
      email: escapeHtml(String(email || '').trim()),
      services: escapeHtml(String(services || '').trim()),
      message: escapeHtml(String(message || '').trim()),
      county: escapeHtml(String(county).trim())
    };
    const htmlContactMethod = h.email ? 'Email' : 'Phone';
    const htmlContactValue = h.email || h.phone;

    const emailHtml = `
      <h2 style="color:#1e40af;">New Service Request</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${h.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Contact via</td><td style="padding:8px;border-bottom:1px solid #eee;">${htmlContactMethod} &mdash; ${htmlContactValue}</td></tr>
        ${h.phone ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${h.phone}</td></tr>` : ''}
        ${h.email ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${h.email}</td></tr>` : ''}
        ${h.services ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Service</td><td style="padding:8px;border-bottom:1px solid #eee;">${h.services}</td></tr>` : ''}
        ${h.message ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Description</td><td style="padding:8px;border-bottom:1px solid #eee;">${h.message}</td></tr>` : ''}
        ${h.county ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">County</td><td style="padding:8px;border-bottom:1px solid #eee;">${h.county} County</td></tr>` : ''}
        ${photos.length > 0 ? `<tr><td style="padding:8px;font-weight:bold;">Photos</td><td style="padding:8px;">${photos.length} attached</td></tr>` : ''}
      </table>
      <br><p style="color:#999;font-size:12px;">Sent from 2MM Contractor website</p>`;

    const emailAttachments = photos.map(f => ({
      filename: f.originalname,
      path: f.path
    }));

    // Send Telegram message
    await sendTelegram(msg);

    // Send photos to Telegram
    for (const photo of photos) {
      await sendTelegramPhoto(photo.path, `Photo from ${safeName}`);
    }

    // Send email (non-blocking — don't fail the request if email fails)
    sendEmail(`New Request \u2014 ${h.name}`, emailHtml, emailAttachments).catch(err => {
      console.log('Email skipped:', err.message);
    });

    // Clean up uploaded files
    cleanupFiles(photos);

    res.json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    cleanupFiles(photos);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// ============ STARTUP CLEANUP — remove orphan uploads ============
fs.readdir(uploadsDir, (err, files) => {
  if (err || !files.length) return;
  const now = Date.now();
  files.forEach(file => {
    const filePath = path.join(uploadsDir, file);
    fs.stat(filePath, (statErr, stats) => {
      if (statErr) return;
      // Remove files older than 1 hour
      if (now - stats.mtimeMs > 60 * 60 * 1000) {
        fs.unlink(filePath, () => {});
      }
    });
  });
});

// ============ START SERVER ============
const server = app.listen(PORT, () => {
  console.log(`\n  2MM Contractor server running at:`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Telegram: @YavuzMM_bot (Chat ID: ${CHAT_ID})`);
  console.log(`  Email: ${process.env.GMAIL_USER || 'not configured'}`);
  console.log(`  Email sending: ${emailTransporter ? 'ENABLED' : 'DISABLED'}\n`);
});

// ============ GRACEFUL SHUTDOWN ============
function shutdown(signal) {
  console.log(`\n  ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('  Server closed.');
    process.exit(0);
  });
  // Force exit after 5s if server hasn't closed
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
