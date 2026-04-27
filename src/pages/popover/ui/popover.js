let clockInTime = null;
let isClockedIn = false;
let breakMinutes = 90;

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtSec(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtBreak(min) {
  if (min === 0) return '없음';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function renderBreak() {
  document.getElementById('break-value').textContent = fmtBreak(breakMinutes);
}

function updateActionButtons() {
  const section = document.getElementById('action-section');
  const btnIn = document.getElementById('btn-clock-in');
  const btnOut = document.getElementById('btn-clock-out');
  if (isClockedIn) {
    section.style.display = 'block';
    btnIn.style.display = 'none';
    btnOut.style.display = 'block';
  } else if (clockInTime === null) {
    section.style.display = 'block';
    btnIn.style.display = 'block';
    btnOut.style.display = 'none';
  } else {
    section.style.display = 'none';
  }
}

function showError(msg) {
  document.getElementById('timer-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'block';
  document.getElementById('break-section').style.display = 'none';
  document.getElementById('action-section').style.display = 'none';
  document.getElementById('expected-out').style.display = 'none';

  const isNetworkError = msg && msg.includes('네트워크');
  document.getElementById('error-msg').textContent = msg || 'flex.team 로그인이 필요해요';

  const btnLogin = document.getElementById('btn-login');
  if (isNetworkError) {
    btnLogin.textContent = '다시 시도';
    btnLogin.onclick = () => {
      btnLogin.textContent = '로드 중...';
      window.flex.refresh();
    };
  } else {
    btnLogin.textContent = '로그인';
    btnLogin.onclick = () => window.flex.openLogin();
  }

  document.getElementById('status-dot').className = 'dot off';
  document.getElementById('status-label').textContent = isNetworkError
    ? '연결 오류'
    : '로그인 필요';
}

function showData(data) {
  document.getElementById('timer-section').style.display = 'block';
  document.getElementById('error-section').style.display = 'none';
  document.getElementById('break-section').style.display = 'flex';

  clockInTime = data.clockInTime;
  isClockedIn = data.isClockedIn ?? false;
  if (data.breakMinutes != null) {
    breakMinutes = data.breakMinutes;
    renderBreak();
  }
  updateActionButtons();

  const expectedOutEl = document.getElementById('expected-out');

  if (!clockInTime) {
    document.getElementById('elapsed').textContent = '--:--';
    document.getElementById('clock-in').textContent = '오늘 근무 기록 없음';
    document.getElementById('status-dot').className = 'dot off';
    document.getElementById('status-label').textContent = '미출근';
    expectedOutEl.style.display = 'none';
    return;
  }

  if (!isClockedIn && data.clockOutTime) {
    const total = data.totalWorkedSec != null ? fmtSec(data.totalWorkedSec) : '--:--';
    document.getElementById('elapsed').textContent = total;
    document.getElementById('clock-in').textContent =
      `${fmtTime(clockInTime)} 출근 → ${fmtTime(data.clockOutTime)} 퇴근`;
    document.getElementById('status-dot').className = 'dot off';
    document.getElementById('status-label').textContent = '퇴근';
    expectedOutEl.style.display = 'none';
  } else {
    document.getElementById('clock-in').textContent = `출근 ${fmtTime(clockInTime)} 부터`;
    document.getElementById('status-dot').className = 'dot';
    document.getElementById('status-label').textContent = '근무 중';
    if (data.expectedClockOutTime) {
      expectedOutEl.textContent = `퇴근 예정: ${fmtTime(data.expectedClockOutTime)}`;
      expectedOutEl.style.display = 'block';
    } else {
      expectedOutEl.style.display = 'none';
    }
  }
}

document.getElementById('btn-settings').onclick = () => window.flex.openSettings();

window.flex.onWorkData((data) => {
  if (data.error || !data.isLoggedIn) showError(data.error);
  else showData(data);
});

window.flex.onTick(({ elapsed }) => {
  if (isClockedIn && elapsed) document.getElementById('elapsed').textContent = elapsed;
});

document.getElementById('break-minus').onclick = () => {
  breakMinutes = Math.max(0, breakMinutes - 15);
  renderBreak();
  window.flex.setBreakMinutes(breakMinutes);
};
document.getElementById('break-plus').onclick = () => {
  breakMinutes = Math.min(480, breakMinutes + 15);
  renderBreak();
  window.flex.setBreakMinutes(breakMinutes);
};

async function handleClockAction(btn, action) {
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '처리 중...';
  try {
    await action();
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

document.getElementById('btn-clock-in').onclick = function () {
  handleClockAction(this, () => window.flex.clockIn());
};
document.getElementById('btn-clock-out').onclick = function () {
  handleClockAction(this, () => window.flex.clockOut());
};

document.getElementById('btn-refresh').onclick = () => window.flex.refresh();
document.getElementById('btn-login').onclick = () => window.flex.openLogin();
document.getElementById('btn-flex').onclick = () => window.open('https://flex.team');
document.getElementById('btn-quit').onclick = () => window.flex.quit();

window.flex.getBreakMinutes().then((min) => {
  breakMinutes = min;
  renderBreak();
});
window.flex.requestData();
