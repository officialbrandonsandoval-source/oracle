// ORACLE Popup Script
// Manages popup UI and settings

document.addEventListener('DOMContentLoaded', init);

// State
let state = {
  settings: null,
  positions: [],
  performance: null
};

// Default settings
const defaultSettings = {
  bankroll: 5000,
  kellyFraction: 0.25,
  minEdgeThreshold: 0.05,
  maxPositionPercent: 0.05,
  maxDailyLossPercent: 0.15,
  theme: 'dark'
};

// Initialize
async function init() {
  await loadData();
  renderUI();
  attachEventListeners();
}

// Load data from storage
async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      state.settings = { ...defaultSettings, ...data.settings };
      state.positions = data.positions || [];
      state.performance = data.performance || {
        totalTrades: 0,
        winRate: 0,
        totalPL: 0,
        roiPercent: 0
      };
      resolve();
    });
  });
}

// Render UI
function renderUI() {
  // Bankroll
  const bankrollValue = document.getElementById('bankroll-value');
  if (bankrollValue) {
    bankrollValue.textContent = formatCurrency(state.settings.bankroll);
  }

  // Settings selects
  const kellySelect = document.getElementById('kelly-fraction');
  const minEdgeSelect = document.getElementById('min-edge');
  const maxPositionSelect = document.getElementById('max-position');

  if (kellySelect) kellySelect.value = state.settings.kellyFraction.toString();
  if (minEdgeSelect) minEdgeSelect.value = state.settings.minEdgeThreshold.toString();
  if (maxPositionSelect) maxPositionSelect.value = state.settings.maxPositionPercent.toString();

  // Positions
  renderPositions();

  // Performance
  renderPerformance();
}

// Render positions list
function renderPositions() {
  const list = document.getElementById('positions-list');
  const count = document.getElementById('position-count');
  
  const openPositions = state.positions.filter(p => p.status === 'OPEN');
  
  if (count) count.textContent = openPositions.length;
  
  if (!list) return;

  if (openPositions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📊</span>
        <span>No open positions</span>
      </div>
    `;
    return;
  }

  list.innerHTML = openPositions.map(position => {
    const pnl = calculatePositionPnL(position);
    const pnlClass = pnl >= 0 ? 'positive' : 'negative';
    const pnlPrefix = pnl >= 0 ? '+' : '';
    
    return `
      <div class="position-item">
        <div class="position-info">
          <div class="position-title">${truncate(position.marketTitle, 30)}</div>
          <div class="position-details">${position.side} @ $${position.entryPrice.toFixed(2)} × ${position.contracts}</div>
        </div>
        <div class="position-pnl">
          <div class="pnl-value ${pnlClass}">${pnlPrefix}$${Math.abs(pnl).toFixed(2)}</div>
          <div class="pnl-percent">${pnlPrefix}${((pnl / position.costBasis) * 100).toFixed(1)}%</div>
        </div>
      </div>
    `;
  }).join('');
}

// Render performance metrics
function renderPerformance() {
  const totalPL = document.getElementById('total-pl');
  const roi = document.getElementById('roi');
  const winRate = document.getElementById('win-rate');
  const totalTrades = document.getElementById('total-trades');

  if (totalPL) {
    const pl = state.performance.totalPL || 0;
    totalPL.textContent = `${pl >= 0 ? '+' : ''}$${Math.abs(pl).toFixed(2)}`;
    totalPL.className = `perf-value ${pl >= 0 ? 'positive' : 'negative'}`;
  }

  if (roi) {
    const roiVal = state.performance.roiPercent || 0;
    roi.textContent = `${roiVal >= 0 ? '+' : ''}${roiVal.toFixed(1)}%`;
    roi.className = `perf-value ${roiVal >= 0 ? 'positive' : 'negative'}`;
  }

  if (winRate) {
    winRate.textContent = `${((state.performance.winRate || 0) * 100).toFixed(0)}%`;
  }

  if (totalTrades) {
    totalTrades.textContent = state.performance.totalTrades || 0;
  }
}

// Attach event listeners
function attachEventListeners() {
  // Edit bankroll button
  document.getElementById('edit-bankroll-btn')?.addEventListener('click', openBankrollModal);

  // Modal controls
  document.getElementById('close-modal')?.addEventListener('click', closeBankrollModal);
  document.getElementById('cancel-bankroll')?.addEventListener('click', closeBankrollModal);
  document.getElementById('save-bankroll')?.addEventListener('click', saveBankroll);

  // Settings selects
  document.getElementById('kelly-fraction')?.addEventListener('change', handleSettingChange);
  document.getElementById('min-edge')?.addEventListener('change', handleSettingChange);
  document.getElementById('max-position')?.addEventListener('change', handleSettingChange);

  // Footer buttons
  document.getElementById('export-btn')?.addEventListener('click', exportData);
  document.getElementById('clear-btn')?.addEventListener('click', clearData);

  // Settings button (opens options page)
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Click outside modal to close
  document.getElementById('bankroll-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bankroll-modal') {
      closeBankrollModal();
    }
  });

  // Enter key in bankroll input
  document.getElementById('bankroll-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBankroll();
    }
  });
}

// Open bankroll modal
function openBankrollModal() {
  const modal = document.getElementById('bankroll-modal');
  const input = document.getElementById('bankroll-input');
  if (modal) modal.classList.add('active');
  if (input) {
    input.value = state.settings.bankroll;
    input.focus();
    input.select();
  }
}

// Close bankroll modal
function closeBankrollModal() {
  const modal = document.getElementById('bankroll-modal');
  if (modal) modal.classList.remove('active');
}

// Save bankroll
async function saveBankroll() {
  const input = document.getElementById('bankroll-input');
  const value = parseFloat(input?.value);

  if (isNaN(value) || value < 100) {
    showToast('Please enter a valid amount (min $100)', 'error');
    return;
  }

  state.settings.bankroll = value;
  await saveSettings();
  closeBankrollModal();
  renderUI();
  notifyContentScript();
  showToast('Bankroll updated', 'success');
}

// Handle setting change
async function handleSettingChange(e) {
  const { id, value } = e.target;
  
  switch (id) {
    case 'kelly-fraction':
      state.settings.kellyFraction = parseFloat(value);
      break;
    case 'min-edge':
      state.settings.minEdgeThreshold = parseFloat(value);
      break;
    case 'max-position':
      state.settings.maxPositionPercent = parseFloat(value);
      break;
  }

  await saveSettings();
  notifyContentScript();
  showToast('Settings saved', 'success');
}

// Save settings to storage
async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings: state.settings }, resolve);
  });
}

// Notify content script of settings update
function notifyContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_SETTINGS',
        settings: state.settings
      }).catch(() => {
        // Tab might not have content script
      });
    }
  });
}

// Export data
async function exportData() {
  const data = {
    settings: state.settings,
    positions: state.positions,
    performance: state.performance,
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `oracle-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Data exported', 'success');
}

// Clear data
async function clearData() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    return;
  }

  await new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });

  state.settings = { ...defaultSettings };
  state.positions = [];
  state.performance = {
    totalTrades: 0,
    winRate: 0,
    totalPL: 0,
    roiPercent: 0
  };

  // Save defaults
  await saveSettings();
  
  renderUI();
  notifyContentScript();
  showToast('All data cleared', 'success');
}

// Calculate position P&L (simplified - would need current prices in production)
function calculatePositionPnL(position) {
  // For now, return unrealized P&L if stored, or 0
  return position.unrealizedPL || 0;
}

// Format currency
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Truncate string
function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}

// Show toast notification
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
