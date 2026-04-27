const { flexRequest } = require('../../../shared/api');
const { session: electronSession } = require('electron');

let userId = null;

async function fetchCurrentUser() {
  try {
    const cookies = await electronSession.defaultSession.cookies.get({ domain: 'flex.team' });
    const loggerCookie = cookies.find((c) => c.name === 'FlexTeam-logger_vendor_config');
    if (loggerCookie) {
      const parsed = JSON.parse(loggerCookie.value);
      if (parsed.userId) return parsed.userId;
    }
  } catch (e) {
    console.error('[fetchCurrentUser Error]', e.message);
  }
  return null;
}

async function getWorkClockData(userIdHash) {
  const now = Date.now();
  return await flexRequest(
    `/api/v2/time-tracking/work-clock/users?userIdHashes=${userIdHash}&timeStampFrom=${now - 86400000}&timeStampTo=${now + 86400000}`
  );
}

async function getCurrentStatus(userIdHash) {
  return await flexRequest(`/api/v2/time-tracking/work-clock/users/${userIdHash}/current-status`);
}

function resetUserId() {
  userId = null;
}

async function getUserId() {
  if (!userId) userId = await fetchCurrentUser();
  return userId;
}

module.exports = { getWorkClockData, getCurrentStatus, getUserId, resetUserId };
