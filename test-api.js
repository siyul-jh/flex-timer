#!/usr/bin/env node
/**
 * flex.team API 테스트 스크립트
 * 사용법: FLEX_COOKIE="cookie_string" node test-api.js
 *
 * 쿠키 가져오는 법:
 * Chrome -> flex.team 접속 -> DevTools(F12) -> Network탭 -> 아무 요청 클릭
 * -> Headers -> Request Headers -> "cookie:" 값 전체 복사
 */
const https = require('https');

const BASE_URL = 'https://flex.team';
const cookieStr = process.env.FLEX_COOKIE;

if (!cookieStr) {
  console.error('❌ FLEX_COOKIE 환경변수가 필요합니다.');
  console.error('   사용법: FLEX_COOKIE="..." node test-api.js');
  process.exit(1);
}

// 쿠키에서 userId 추출
function extractUserId(cookies) {
  const match = cookies.match(/FlexTeam-logger_vendor_config=([^;]+)/);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded);
    return parsed.userId || null;
  } catch {
    return null;
  }
}

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + urlPath);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Cookie: cookieStr,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });
    req.on('error', reject);
    req.end();
  });
}

function printResult(label, res) {
  console.log('\n' + '='.repeat(60));
  console.log(`📡 ${label}`);
  console.log('='.repeat(60));
  console.log(`Status: ${res.status}`);
  console.log('Response Headers:');
  console.log(JSON.stringify(res.headers, null, 2));
  console.log('Response Body:');
  console.log(JSON.stringify(res.json ?? res.raw, null, 2));
}

async function main() {
  const userId = extractUserId(cookieStr);
  if (!userId) {
    console.error('❌ 쿠키에서 userId를 추출하지 못했습니다. 로그인 상태를 확인하세요.');
    process.exit(1);
  }
  console.log(`✅ userId: ${userId}`);

  const now = Date.now();

  // 1. 오늘 출퇴근 기록
  const clockRes = await request(
    `/api/v2/time-tracking/work-clock/users?userIdHashes=${userId}&timeStampFrom=${now - 86400000}&timeStampTo=${now + 86400000}`
  );
  printResult('GET /api/v2/time-tracking/work-clock/users (오늘 출퇴근 기록)', clockRes);

  // 2. 현재 실시간 근무 상태
  const statusRes = await request(
    `/api/v2/time-tracking/work-clock/users/${userId}/current-status`
  );
  printResult(
    'GET /api/v2/time-tracking/work-clock/users/{id}/current-status (실시간 상태)',
    statusRes
  );

  // 3. 서버 시간
  const timeRes = await request('/api/v2/time-tracking/current-time');
  printResult('GET /api/v2/time-tracking/current-time (서버 시간)', timeRes);
}

main().catch((e) => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
