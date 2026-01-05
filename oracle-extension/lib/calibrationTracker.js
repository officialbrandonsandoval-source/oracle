const CalibrationTracker = {
  async recordPrediction(market, probability) {
    const { predictionHistory } = await chrome.storage.local.get('predictionHistory');
    const history = predictionHistory || [];
    
    const prediction = {
      id: crypto.randomUUID(),
      marketId: market.id || market.title, // Use title as ID if ID missing
      marketTitle: market.title,
      category: this._inferCategory(market.title),
      predictedProb: probability,
      marketProbAtPrediction: market.yesPrice,
      timestamp: new Date().toISOString(),
      resolved: false,
      outcome: null
    };

    history.push(prediction);
    await chrome.storage.local.set({ predictionHistory: history });
  },

  async recordResolution(marketId, outcome) {
    // Outcome should be 'YES' or 'NO'
    const { predictionHistory } = await chrome.storage.local.get('predictionHistory');
    if (!predictionHistory) return;

    const updatedHistory = predictionHistory.map(p => {
      // Crude match by ID or Title
      if (p.marketId === marketId || p.marketTitle === marketId) {
        return {
          ...p,
          resolved: true,
          outcome: outcome,
          resolutionDate: new Date().toISOString()
        };
      }
      return p;
    });

    await chrome.storage.local.set({ predictionHistory: updatedHistory });
  },

  async getStats() {
    const { predictionHistory } = await chrome.storage.local.get('predictionHistory');
    if (!predictionHistory) return { brierScore: 0, count: 0 };

    const resolved = predictionHistory.filter(p => p.resolved);
    if (resolved.length === 0) return { brierScore: 0, count: 0 };

    // Calculate Brier Score: (Probability - Outcome)^2
    // Outcome: YES = 1.0, NO = 0.0
    let totalSqError = 0;
    
    resolved.forEach(p => {
      const actual = p.outcome === 'YES' ? 1.0 : 0.0;
      totalSqError += Math.pow(p.predictedProb - actual, 2);
    });

    return {
      brierScore: totalSqError / resolved.length,
      count: resolved.length,
      accuracy: this._calculateAccuracy(resolved)
    };
  },

  _calculateAccuracy(resolved) {
    // If prob > 0.5 and outcome YES -> hit
    // If prob < 0.5 and outcome NO -> hit
    let hits = 0;
    resolved.forEach(p => {
      const isYes = p.outcome === 'YES';
      if ((p.predictedProb > 0.5 && isYes) || (p.predictedProb < 0.5 && !isYes)) {
        hits++;
      }
    });
    return (hits / resolved.length);
  },

  _inferCategory(title) {
    const t = title.toLowerCase();
    if (t.includes('ukraine') || t.includes('gaza') || t.includes('war') || t.includes('trump') || t.includes('biden') || t.includes('senate')) return 'politics';
    if (t.includes('fed') || t.includes('rate') || t.includes('gdp') || t.includes('inflation')) return 'economics';
    if (t.includes('temperature') || t.includes('rain') || t.includes('hurricane')) return 'weather';
    return 'other';
  }
};
