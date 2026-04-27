async function init() {
  const [settings, launchAtLogin] = await Promise.all([
    window.flex.getSettings(),
    window.flex.getLaunchAtLogin(),
  ]);

  document.getElementById('customIcon').value = settings.customIcon || '';
  document.getElementById('loggedInIcon').value = settings.loggedInIcon || '';
  document.getElementById('breakMinutes').value = settings.breakMinutes || 90;
  document.getElementById('targetWorkHours').value = settings.targetWorkHours || 7.5;
  document.getElementById('overtimeHours').value = settings.overtimeHours || 7.5;
  document.getElementById('breakStartTime').value = settings.breakStartTime || '11:30';
  document.getElementById('breakEndTime').value = settings.breakEndTime || '13:00';
  document.getElementById('launchAtLogin').checked = launchAtLogin;

  document.getElementById('saveBtn').onclick = () => {
    window.flex.setLaunchAtLogin(document.getElementById('launchAtLogin').checked);
    window.flex.saveSettings({
      customIcon: document.getElementById('customIcon').value,
      loggedInIcon: document.getElementById('loggedInIcon').value,
      breakMinutes: parseInt(document.getElementById('breakMinutes').value, 10),
      targetWorkHours: parseFloat(document.getElementById('targetWorkHours').value),
      overtimeHours: parseFloat(document.getElementById('overtimeHours').value),
      breakStartTime: document.getElementById('breakStartTime').value,
      breakEndTime: document.getElementById('breakEndTime').value,
    });
    window.close();
  };

  document.getElementById('closeBtn').onclick = () => window.close();
}

init().then(() => {
  const frameH = window.outerHeight - window.innerHeight;
  window.flex.resizeWindow(400, document.documentElement.scrollHeight + frameH);
});
