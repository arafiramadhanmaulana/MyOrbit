require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mysql = require('mysql2/promise');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const xss = require('xss');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  app.set('trust proxy', 1);
}

// ===== ✅ Logging =====
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const accessLogStream = fs.createWriteStream(path.join(logDir, 'access.log'), { flags: 'a' });
const auditLogStream = fs.createWriteStream(path.join(logDir, 'audit.log'), { flags: 'a' });

app.use(morgan(isProd ? 'combined' : 'dev', {
  stream: isProd ? accessLogStream : process.stdout
}));

// ===== ✅ Keamanan HTTP Headers =====
if (isProd) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], 
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xPoweredBy: false,
  }));
  app.use(helmet.hsts({ maxAge: 63072000 }));
  app.use(helmet.noSniff());
  app.use(helmet.xssFilter());
}

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ===== ✅ CORS =====
app.use(cors({
  origin: isProd ? ['https://your-production-domain.com'] : 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
}));

// ===== ✅ Body Parser =====
app.use(express.json({ limit: '100kb', strict: true }));

// 🛡️ Mencegah Path Traversal sebelum static
app.use((req, res, next) => {
  const decodedPath = decodeURIComponent(req.path);
  if (decodedPath.includes('..')) {
    return res.status(400).json({ msg: 'Path tidak valid' });
  }
  next();
});

// ===== ✅ Static File Protection =====
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  index: false,
  dotfiles: 'ignore',
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// ===== ✅ Rate Limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: '⚠️ Terlalu banyak permintaan. Coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'];
  const blacklistedAgents = ['curl', 'python', 'wget', 'httpclient'];
  if (userAgent && blacklistedAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    logAudit('BLOCKED_USER_AGENT', { agent: userAgent, ip: req.ip });
    return res.status(403).json({ msg: 'User-Agent ditolak' });
  }
  next();
});


const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: '⚠️ Terlalu banyak percobaan login. Coba beberapa menit lagi.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ===== ✅ Audit Logging Function =====
function logAudit(event, detail) {
  const line = `${new Date().toISOString()} [${event}] ${JSON.stringify(detail)}\n`;
  auditLogStream.write(line);
}

// ===== ✅ IP Blacklist  =====
const blacklist = ['123.123.123.123'];
app.use((req, res, next) => {
  const ip = req.ip;
  if (blacklist.includes(ip)) {
    return res.status(403).json({ msg: 'Akses ditolak' });
  }
  next();
});


// Validasi token / API key untuk endpoint sensitif
app.use((req, res, next) => {
  const token = req.headers['x-api-key'];
  if (isProd && token !== process.env.API_KEY) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }
  next();
});

const apiKeyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 20,
  message: '⚠️ Terlalu banyak permintaan API. Coba lagi nanti.',
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});
// app.use(apiKeyLimiter);

// ===== ✅ Sanitasi Input Middleware =====
const sanitizeInput = (val) => typeof val === 'string' ? xss(val.trim()) : val;
const cleanObject = (obj) => {
  for (let key in obj) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete obj[key];
    }
  }
  return obj;
};

app.use((req, res, next) => {
  for (let key in req.query) req.query[key] = sanitizeInput(req.query[key]);
  for (let key in req.params) req.params[key] = sanitizeInput(req.params[key]);
  next();
});

const allowedFields = ['referralCode']; // tambah field lain bila perlu
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    cleanObject(req.body);
    for (let key in req.body) {
    if (allowedFields.includes(key)) {
        req.body[key] = sanitizeInput(req.body[key]);
    } else {
        logAudit('INVALID_FIELD_REMOVED', { field: key, ip: req.ip });
        delete req.body[key];
      }
    }
  }
  next();
});


// ===== ✅ Koneksi Database =====
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Koneksi DB berhasil');
    conn.release();
  } catch (err) {
    console.error('❌ Gagal koneksi DB:', err.message);
  }
})();

function sanitizeRow(row) {
  for (let key in row) {
    if (typeof row[key] === 'string') {
      row[key] = xss(row[key]);
    }
  }
  return row;
}

function fixDateRows(rows) {
  return rows.map(row => {
    if (row.active_date instanceof Date) {
      row.active_date = row.active_date.toISOString().split('T')[0];
    }
    return sanitizeRow(row);
  });
}

// ===== ✅ Endpoint Login =====
app.post('/login',
  // loginLimiter, // ✅ Rate limiter dinonaktifkan sementara
  async (req, res, next) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    next();
  },
  body('referralCode')
    .trim()
    .notEmpty().withMessage('Kode wajib diisi')
    .isAlphanumeric().withMessage('Kode hanya huruf/angka')
    .isLength({ min: 4, max: 20 }).withMessage('Panjang kode tidak valid'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ msg: 'Input tidak valid', errors: errors.array() });
    }

    const { referralCode } = req.body;
    const pattern = /^[A-Z0-9]+$/;
    if (!pattern.test(referralCode)) {
      return res.status(400).json({ msg: 'Format kode tidak valid' });
    }

    try {
      const [rows] = await pool.execute(`
        SELECT * FROM universal_db 
        WHERE referral_code = ? 
        AND referral_code IN (SELECT referral_code FROM kodenya)
      `, [referralCode]);

      if (rows.length === 0) {
        logAudit('LOGIN_FAILED', { referralCode: '[REDACTED]' });
        return res.status(404).json({ msg: 'Kode tidak ditemukan' });
      }
      logAudit('LOGIN_SUCCESS', { referralCode: '[REDACTED]' });
      res.json(fixDateRows(rows));
    } catch (err) {
      console.error('❌ Login error:', err.message);
      res.status(500).json({ msg: 'Terjadi kesalahan server' });
    }
  }
);

// ===== ✅ Endpoint Ringkasan User =====
app.get('/user-summary/:referralCode', async (req, res) => {
  const { referralCode } = req.params;
    const referralPattern = /^[A-Z0-9]{4,20}$/;
  if (!referralPattern.test(referralCode)) {
    return res.status(400).json({ msg: 'Format kode tidak valid' });
  }
  const month = req.query.month;

  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month !== 'all') {
    return res.status(400).json({ msg: 'Format bulan salah (yyyy-mm)' });
  }
  logAudit('USER_SUMMARY_VIEWED', { referralCode, ip: req.ip });
  try {
    const [[refRow]] = await pool.query(`
      SELECT branch, total_target, umk
      FROM kodenya
      WHERE referral_code = ?
    `, [referralCode]);

    if (!refRow) return res.status(404).json({ message: 'Referral tidak ditemukan' });

    const { branch, total_target, umk } = refRow;

    let salesQuery = `
      SELECT COUNT(*) AS total_sales 
      FROM universal_db 
      WHERE branch = ?
    `;
    const salesParams = [branch];

    if (month && month !== 'all') {
      salesQuery += ` AND active_date LIKE ?`;
      salesParams.push(`${month}%`);
    }

    const [[salesRow]] = await pool.query(salesQuery, salesParams);

    res.json({
      branch,
      total_target: total_target || 0,
      total_sales: salesRow.total_sales || 0,
      umk: umk || 0
    });
  } catch (err) {
    console.error('❌ Error user-summary:', err.message);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// ===== ✅ Endpoint Ringkasan per Branch =====
app.get('/branch-summary', async (req, res) => {
  try {
    const [summary] = await pool.execute(`
      SELECT 
        d.branch,
        d.total_target,
        COUNT(u.branch) AS total_sales
      FROM daerah d
      LEFT JOIN universal_db u ON u.branch = d.branch
      GROUP BY d.branch, d.total_target
      ORDER BY d.branch
    `);
    res.json(summary.map(sanitizeRow));
  } catch (err) {
    console.error('❌ Error branch-summary:', err.message);
    res.status(500).json({ msg: 'Gagal ambil data' });
  }
});

// ===== ✅ Endpoint Total Ringkasan =====
app.get('/summary-total', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        SUM(d.total_target) AS total_target,
        COUNT(u.branch) AS total_sales
      FROM daerah d
      LEFT JOIN universal_db u ON u.branch = d.branch
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error summary-total:', err.message);
    res.status(500).json({ msg: 'Gagal ambil data' });
  }
});

// ✅ Tambahan untuk menampilkan index.html saat buka /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});


// ===== ✅ Fallback untuk Endpoint Tidak Dikenal =====
app.use((req, res) => {
  res.status(404).json({ msg: 'Endpoint tidak ditemukan' });
});

// ===== ✅ HTTPS Redirect (Hanya untuk produksi) =====
if (isProd) {
  app.enable('trust proxy');
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    res.redirect(`https://${req.headers.host}${req.url}`);
  });
}

// ===== ✅ Start Server =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server aktif di http://localhost:${PORT}`);
});
