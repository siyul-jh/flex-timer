const { flexRequest } = require('../../shared/api');
const { getUserId } = require('../../entities/work-data/api');

async function clockIn() {
  const userId = await getUserId();
  if (!userId) return { status: 401, error: 'User ID not found' };

  const now = Date.now();
  // 최신 패턴: /api/v2/time-tracking/work-clock/users/{userIdHash}/start
  const res = await flexRequest(`/api/v2/time-tracking/work-clock/users/${userId}/start`, 'POST', {
    targetWorkStartTimeStamp: now,
    realWorkStartTimeStamp: now,
    zoneId: 'Asia/Seoul',
  });
  console.log('[clockIn]', res.status, JSON.stringify(res.json));
  return res;
}

async function clockOut() {
  const userId = await getUserId();
  if (!userId) return { status: 401, error: 'User ID not found' };

  const now = Date.now();
  // 최신 패턴: /api/v2/time-tracking/work-clock/users/${userIdHash}/stop
  // 실제 브라우저 캡처 결과 반영
  const res = await flexRequest(`/api/v2/time-tracking/work-clock/users/${userId}/stop`, 'POST', {
    targetWorkStopTimeStamp: now,
    realWorkStopTimeStamp: now,
    zoneId: 'Asia/Seoul',
    onTime: false,
    restTimeBlocks: [], // 필요 시 추가 데이터 연동 가능
    approvalProcess: null,
  });
  console.log('[clockOut]', res.status, JSON.stringify(res.json));
  return res;
}

module.exports = { clockIn, clockOut };
