const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(obj) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(obj));
}

module.exports = { loadSettings, saveSettings };
