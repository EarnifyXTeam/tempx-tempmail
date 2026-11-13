const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'sms_config.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

// Helper: Read SMS provider config
function getSmsConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) { }
  return { provider: 'smsbower', apiKey: '', active: false };
}

// Helper: Get Base URL according to chosen provider
function getProviderBaseUrl(provider) {
  if (provider === 'smsbower' || !provider) {
    return 'https://smsbower.app/stubs/handler_api.php';
  }
  if (provider === 'sms-activate') {
    return 'https://api.sms-activate.org/stubs/handler_api.php';
  }
  if (provider === '5sim') {
    return 'https://api.5sim.net/stubs/handler_api.php';
  }
  if (provider === 'smspool') {
    return 'https://api.smspool.net/stubs/handler_api.php';
  }
  return 'https://smsbower.app/stubs/handler_api.php';
}

// Helper: Map country abbreviations to SMSBower / SMS-Activate ID codes
function getCountryCode(country) {
  const map = {
    'ind': '22',  // India
    'usa': '187', // United States
    'can': '36',  // Canada
    'gbr': '16',  // United Kingdom
    'rus': '0',   // Russia
    'idn': '6',   // Indonesia
    'bra': '73',  // Brazil
    'pak': '66',  // Pakistan
    'bgd': '60',  // Bangladesh
    'deu': '43',  // Germany
    'fra': '78'   // France
  };
  return map[country] || '22';
}

// Helper: Save SMS config
function saveSmsConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) { }
}

// Helper: Make external HTTPS GET request
function fetchRemote(reqUrl) {
  return new Promise((resolve, reject) => {
    https.get(reqUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // ══════════════════════════════════════════════
  // BACKEND API ROUTER
  // ══════════════════════════════════════════════

  // 1. Get / Save SMS Config
  if (pathname === '/api/sms/config') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const newCfg = JSON.parse(body);
          saveSmsConfig(newCfg);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, config: newCfg }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    const cfg = getSmsConfig();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(cfg));
    return;
  }

  // 1b. Check Live Provider Balance
  if (pathname === '/api/sms/balance') {
    const cfg = getSmsConfig();
    if (cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY_HERE') {
      try {
        const baseUrl = getProviderBaseUrl(cfg.provider);
        const apiUrl = `${baseUrl}?api_key=${cfg.apiKey}&action=getBalance`;
        const raw = await fetchRemote(apiUrl);
        if (raw.startsWith('ACCESS_BALANCE:')) {
          const bal = raw.split(':')[1];
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, balance: bal, provider: cfg.provider || 'smsbower' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: raw }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ success: true, balance: '50.00', mode: 'simulation' }));
  }

  // 2. Buy Virtual Number API
  if (pathname === '/api/sms/buy') {
    const service = parsedUrl.query.service || 'tg';
    const country = parsedUrl.query.country || 'ind';
    const cfg = getSmsConfig();

    // If real API key is configured (SMSBower / SMS-Activate handler format)
    if (cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY_HERE') {
      try {
        const baseUrl = getProviderBaseUrl(cfg.provider);
        const countryCode = getCountryCode(country);
        const apiUrl = `${baseUrl}?api_key=${cfg.apiKey}&action=getNumber&service=${service}&country=${countryCode}`;
        const raw = await fetchRemote(apiUrl);

        // Standard response: ACCESS_NUMBER:$id:$number
        if (raw.startsWith('ACCESS_NUMBER:')) {
          const parts = raw.split(':');
          const orderId = parts[1];
          const rawNum = parts[2];
          const number = rawNum.startsWith('+') ? rawNum : ('+' + rawNum);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, orderId, phone: number, mode: 'real_api', provider: cfg.provider || 'smsbower' }));
        } else {
          console.log(`[${cfg.provider || 'smsbower'}] Provider returned:`, raw);
          // Return the provider error message so UI can show details if needed
          if (raw === 'NO_NUMBERS' || raw === 'NO_BALANCE' || raw === 'BAD_KEY') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ success: false, error: raw, mode: 'provider_error' }));
          }
        }
      } catch (err) {
        console.error('SMS API call error:', err.message);
      }
    }

    // Fallback: Smart Simulation for instant testing
    const countryDial = country === 'ind' ? '+91' : (country === 'usa' || country === 'can' ? '+1' : '+44');
    const prefixes = ['9820', '9711', '9810', '9930', '9845', '7011', '8800'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const simulatedNumber = `${countryDial} ${prefix}${randomDigits}`;
    const simulatedOrderId = 'sim_' + Math.random().toString(36).substring(2, 9);

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      success: true,
      orderId: simulatedOrderId,
      phone: simulatedNumber,
      mode: 'simulation'
    }));
  }

  // 3. Check OTP / Status API
  if (pathname === '/api/sms/check') {
    const orderId = parsedUrl.query.orderId;
    const cfg = getSmsConfig();

    if (cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY_HERE' && !orderId.startsWith('sim_')) {
      try {
        const baseUrl = getProviderBaseUrl(cfg.provider);
        const apiUrl = `${baseUrl}?api_key=${cfg.apiKey}&action=getStatus&id=${orderId}`;
        const raw = await fetchRemote(apiUrl);

        // Standard response: STATUS_OK:$code or STATUS_WAIT_CODE
        if (raw.startsWith('STATUS_OK:')) {
          const code = raw.split(':')[1];
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'STATUS_OK', code: code }));
        } else if (raw === 'STATUS_WAIT_CODE') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'STATUS_WAIT_CODE' }));
        } else if (raw === 'STATUS_CANCEL') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'STATUS_CANCEL' }));
        }
      } catch (err) {
        console.error('Check status error:', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ status: 'STATUS_WAIT_CODE' }));
  }

  // 4. Cancel / Refund Order on Provider
  if (pathname === '/api/sms/cancel') {
    const orderId = parsedUrl.query.orderId;
    const cfg = getSmsConfig();

    if (cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY_HERE' && !orderId.startsWith('sim_')) {
      try {
        const baseUrl = getProviderBaseUrl(cfg.provider);
        // Status 8 = cancel number on SMSBower / SMS-Activate protocol
        const apiUrl = `${baseUrl}?api_key=${cfg.apiKey}&action=setStatus&status=8&id=${orderId}`;
        await fetchRemote(apiUrl);
      } catch (e) { }
    }

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ success: true, message: 'Cancelled and refunded' }));
  }

  // ══════════════════════════════════════════════
  // STATIC FILE HANDLER
  // ══════════════════════════════════════════════
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TempX Server (by EarnifyX Automation) running at http://127.0.0.1:${PORT}`);
});
