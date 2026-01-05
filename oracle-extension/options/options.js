// ORACLE Options Page Script

document.addEventListener('DOMContentLoaded', init);

// Default settings
const defaultSettings = {
  anthropicApiKey: '',
  bankroll: 5000,
  kellyFraction: 0.25,
  minEdgeThreshold: 0.05,
  maxPositionPercent: 0.05,
  maxDailyLossPercent: 0.15,
  maxOpenPositions: 20,
  theme: 'dark'
};

let currentSettings = { ...defaultSettings };

// Initialize
async function init() {
  await loadSettings();
  populateForm();
  attachEventListeners();
}

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (data) => {
      currentSettings = { ...defaultSettings, ...data.settings };
      resolve();
    });
  });
}

// Populate form with current settings
function populateForm() {
  document.getElementById('anthropicApiKey').value = currentSettings.anthropicApiKey || '';
  document.getElementById('bankroll').value = currentSettings.bankroll;
  document.getElementById('kellyFraction').value = currentSettings.kellyFraction.toString();
  document.getElementById('minEdgeThreshold').value = currentSettings.minEdgeThreshold.toString();
  document.getElementById('maxPositionPercent').value = currentSettings.maxPositionPercent.toString();
  document.getElementById('maxDailyLossPercent').value = currentSettings.maxDailyLossPercent.toString();
  document.getElementById('maxOpenPositions').value = currentSettings.maxOpenPositions;
  document.getElementById('theme').value = currentSettings.theme;
}

// Attach event listeners
function attachEventListeners() {
  // Save button
  document.getElementById('save-btn').addEventListener('click', saveSettings);

  // Export button
  document.getElementById('export-btn').addEventListener('click', exportData);

  // Import button
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  // Import file change
  document.getElementById('import-file').addEventListener('change', importData);

  // Clear button
  document.getElementById('clear-btn').addEventListener('click', clearAllData);

  // Reset to defaults
  document.getElementById('reset-defaults').addEventListener('click', (e) => {
    e.preventDefault();
    resetToDefaults();
  });

  // Auto-save on change (optional)
  const inputs = document.querySelectorAll('.form-input, .form-select');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      // Visual indicator that there are unsaved changes
      document.getElementById('save-status').textContent = 'Unsaved changes';
      document.getElementById('save-status').classList.add('show');
      document.getElementById('save-status').style.color = '#F59E0B';
    });
  });
}

// Save settings
async function saveSettings() {
  const settings = {
    anthropicApiKey: document.getElementById('anthropicApiKey').value.trim(),
    bankroll: parseFloat(document.getElementById('bankroll').value) || defaultSettings.bankroll,
    kellyFraction: parseFloat(document.getElementById('kellyFraction').value),
    minEdgeThreshold: parseFloat(document.getElementById('minEdgeThreshold').value),
    maxPositionPercent: parseFloat(document.getElementById('maxPositionPercent').value),
    maxDailyLossPercent: parseFloat(document.getElementById('maxDailyLossPercent').value),
    maxOpenPositions: parseInt(document.getElementById('maxOpenPositions').value) || 20,
    theme: document.getElementById('theme').value
  };

  // Validate
  if (settings.bankroll < 100) {
    showToast('Bankroll must be at least $100', 'error');
    return;
  }

  if (settings.maxOpenPositions < 1 || settings.maxOpenPositions > 100) {
    showToast('Max positions must be between 1 and 100', 'error');
    return;
  }

  // Save to storage
  await new Promise((resolve) => {
    chrome.storage.local.set({ settings }, resolve);
  });

  currentSettings = settings;

  // Notify all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_SETTINGS',
        settings: settings
      }).catch(() => {});
    });
  });

  // Show success
  const status = document.getElementById('save-status');
  status.textContent = '✓ Settings saved';
  status.style.color = '#10B981';
  status.classList.add('show');

  setTimeout(() => {
    status.classList.remove('show');
  }, 3000);

  showToast('Settings saved successfully', 'success');
}

// Export data
async function exportData() {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });

  const exportData = {
    ...data,
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `oracle-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Data exported successfully', 'success');
}

// Import data
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate data structure
    if (!data.settings) {
      throw new Error('Invalid backup file: missing settings');
    }

    // Confirm import
    if (!confirm('This will replace all current data. Continue?')) {
      return;
    }

    // Import data
    await new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });

    // Reload settings
    await loadSettings();
    populateForm();

    showToast('Data imported successfully', 'success');
  } catch (error) {
    showToast(`Import failed: ${error.message}`, 'error');
  }

  // Clear file input
  event.target.value = '';
}

// Clear all data
async function clearAllData() {
  if (!confirm('Are you sure you want to clear ALL data including positions and trade history? This cannot be undone.')) {
    return;
  }

  if (!confirm('This is your last chance to cancel. Proceed with data deletion?')) {
    return;
  }

  await new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });

  // Set defaults
  await new Promise((resolve) => {
    chrome.storage.local.set({ settings: defaultSettings }, resolve);
  });

  currentSettings = { ...defaultSettings };
  populateForm();

  showToast('All data cleared', 'success');
}

// Reset to defaults
async function resetToDefaults() {
  if (!confirm('Reset all settings to default values?')) {
    return;
  }

  currentSettings = { ...defaultSettings };
  populateForm();

  await new Promise((resolve) => {
    chrome.storage.local.set({ settings: defaultSettings }, resolve);
  });

  showToast('Settings reset to defaults', 'success');
}

// Show toast notification
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
