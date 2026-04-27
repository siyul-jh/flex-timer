const { getWorkClockData, getCurrentStatus, getUserId, resetUserId } = require('../api');

async function fetchWorkData() {
  try {
    const userId = await getUserId();
    if (!userId) return { isLoggedIn: false, error: '로그인이 필요합니다' };

    const [statusRes, clockRes] = await Promise.all([
      getCurrentStatus(userId),
      getWorkClockData(userId),
    ]);

    if (statusRes.error || clockRes.error) {
      return { isLoggedIn: false, error: '네트워크 연결을 확인해주세요' };
    }

    const currentStatus = statusRes.json;
    let serverNow = currentStatus?.requestedAt ?? Date.now();
    if (!currentStatus?.requestedAt && statusRes.headers?.date) {
      serverNow = new Date(statusRes.headers.date).getTime();
    }

    let clockInTime = null;
    let clockOutTime = null;
    let isClockedIn = false;

    if (currentStatus?.onGoingRecordPack) {
      isClockedIn = true;
      clockInTime = currentStatus.onGoingRecordPack.startRecord?.realTime;
    }

    try {
      const packs = clockRes.json?.records?.[0]?.records?.[0]?.workClockRecordPacks;
      const lastPack = packs?.at(-1);
      if (lastPack) {
        if (clockInTime === null && lastPack.startRecord?.realTime && !lastPack.endRecord) {
          clockInTime = lastPack.startRecord.realTime;
          isClockedIn = true;
        } else if (!isClockedIn && lastPack.startRecord?.realTime && lastPack.endRecord?.realTime) {
          clockInTime = lastPack.startRecord.realTime;
          clockOutTime = lastPack.endRecord.realTime;
        }
      }
    } catch (_) {}

    return {
      clockInTime,
      clockOutTime,
      isClockedIn,
      isLoggedIn: statusRes.status === 200,
      serverNow,
    };
  } catch (e) {
    return { isLoggedIn: false, error: e.message };
  }
}

module.exports = { fetchWorkData, resetUserId };
