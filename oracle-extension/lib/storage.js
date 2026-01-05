// ORACLE Storage Module
// Wrapper for Chrome storage API with defaults

const ORACLE_STORAGE = {
  // Default settings
  defaults: {
    settings: {
      bankroll: 5000,
      kellyFraction: 0.25,
      minEdgeThreshold: 0.05,
      maxPositionPercent: 0.05,
      maxDailyLossPercent: 0.15,
      maxOpenPositions: 20,
      theme: 'dark'
    },
    positions: [],
    trades: [],
    performance: {
      totalTrades: 0,
      winRate: 0,
      avgEdge: 0,
      totalPL: 0,
      roiPercent: 0,
      maxDrawdown: 0,
      brierScore: 0
    }
  },

  // Get all data
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (data) => {
        resolve({
          settings: { ...this.defaults.settings, ...data.settings },
          positions: data.positions || this.defaults.positions,
          trades: data.trades || this.defaults.trades,
          performance: { ...this.defaults.performance, ...data.performance }
        });
      });
    });
  },

  // Get settings
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('settings', (data) => {
        resolve({ ...this.defaults.settings, ...data.settings });
      });
    });
  },

  // Save settings
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings }, resolve);
    });
  },

  // Get positions
  async getPositions() {
    return new Promise((resolve) => {
      chrome.storage.local.get('positions', (data) => {
        resolve(data.positions || []);
      });
    });
  },

  // Add position
  async addPosition(position) {
    const positions = await this.getPositions();
    const newPosition = {
      id: crypto.randomUUID(),
      ...position,
      entryDate: new Date().toISOString(),
      status: 'OPEN'
    };
    positions.push(newPosition);
    return new Promise((resolve) => {
      chrome.storage.local.set({ positions }, () => resolve(newPosition));
    });
  },

  // Update position
  async updatePosition(id, updates) {
    const positions = await this.getPositions();
    const index = positions.findIndex(p => p.id === id);
    if (index !== -1) {
      positions[index] = { ...positions[index], ...updates };
      return new Promise((resolve) => {
        chrome.storage.local.set({ positions }, () => resolve(positions[index]));
      });
    }
    return null;
  },

  // Close position
  async closePosition(id, exitPrice, outcome) {
    const positions = await this.getPositions();
    const index = positions.findIndex(p => p.id === id);
    if (index !== -1) {
      const position = positions[index];
      const payout = outcome === 'WIN' ? position.contracts : 0;
      const realizedPL = payout - position.costBasis;
      
      positions[index] = {
        ...position,
        status: 'CLOSED',
        exitPrice,
        exitDate: new Date().toISOString(),
        outcome,
        payout,
        realizedPL
      };

      // Add to trades history
      const trades = await this.getTrades();
      trades.push({
        id: crypto.randomUUID(),
        ...positions[index],
        action: 'CLOSE'
      });

      // Update performance
      await this.updatePerformance(positions[index]);

      return new Promise((resolve) => {
        chrome.storage.local.set({ positions, trades }, () => resolve(positions[index]));
      });
    }
    return null;
  },

  // Get trades history
  async getTrades() {
    return new Promise((resolve) => {
      chrome.storage.local.get('trades', (data) => {
        resolve(data.trades || []);
      });
    });
  },

  // Get performance metrics
  async getPerformance() {
    return new Promise((resolve) => {
      chrome.storage.local.get('performance', (data) => {
        resolve({ ...this.defaults.performance, ...data.performance });
      });
    });
  },

  // Update performance metrics
  async updatePerformance(closedPosition) {
    const performance = await this.getPerformance();
    const trades = await this.getTrades();
    
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    const wins = closedTrades.filter(t => t.outcome === 'WIN');
    
    performance.totalTrades = closedTrades.length;
    performance.winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;
    performance.totalPL = closedTrades.reduce((sum, t) => sum + (t.realizedPL || 0), 0);
    
    const settings = await this.getSettings();
    performance.roiPercent = settings.bankroll > 0 ? (performance.totalPL / settings.bankroll) * 100 : 0;

    return new Promise((resolve) => {
      chrome.storage.local.set({ performance }, () => resolve(performance));
    });
  },

  // Clear all data
  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  },

  // Export data
  async exportData() {
    const data = await this.getAll();
    return JSON.stringify(data, null, 2);
  },

  // Import data
  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return new Promise((resolve) => {
        chrome.storage.local.set(data, () => resolve(true));
      });
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ORACLE_STORAGE = ORACLE_STORAGE;
}
