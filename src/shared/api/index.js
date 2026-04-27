const https = require('https');
const { session: electronSession } = require('electron');
const { BASE_URL, API_TIMEOUT, MAX_RETRIES, RETRY_DELAY } = require('../constants');

/**
 * 전역 공통 API 요청 함수
 */
async function flexRequest(urlPath, method = 'GET', body = null, retries = MAX_RETRIES) {
  const cookies = await electronSession.defaultSession.cookies.get({ domain: 'flex.team' });
  const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const bodyStr = body ? JSON.stringify(body) : null;

  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + urlPath);
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method,
          headers: {
            Cookie: cookieStr,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
          },
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                json: JSON.parse(data),
                headers: res.headers, // 헤더 추가
              });
            } catch {
              resolve({
                status: res.statusCode,
                json: null,
                headers: res.headers, // 헤더 추가
              });
            }
          });
        });

        req.setTimeout(API_TIMEOUT, () => {
          req.destroy();
          reject(new Error('TIMEOUT'));
        });

        req.on('error', (e) => reject(e));
        if (bodyStr) req.write(bodyStr);
        req.end();
      });
    } catch (e) {
      console.error(`[flexRequest Attempt ${i + 1} Failed]`, e.message);
      if (i === retries - 1) {
        return { status: 500, error: e.message, json: null };
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }
}

module.exports = { flexRequest };
