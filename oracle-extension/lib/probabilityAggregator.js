const ProbabilityAggregator = {
  WEIGHTS: {
    kalshi: 0.30,      // Market price (baseline)
    polymarket: 0.25,  // Cross-reference
    claude: 0.25,      // AI analysis
    news: 0.10,        // News sentiment mechanism
    social: 0.10       // Reddit/social sentiment mechanism
  },

  aggregate(sources) {
    let weightedSum = 0;
    let totalWeight = 0;
    const breakdown = [];

    // 1. Kalshi (Base)
    if (sources.kalshiPrice !== undefined) {
      weightedSum += sources.kalshiPrice * this.WEIGHTS.kalshi;
      totalWeight += this.WEIGHTS.kalshi;
      breakdown.push({ name: 'Kalshi', prob: sources.kalshiPrice, weight: this.WEIGHTS.kalshi });
    }

    // 2. Polymarket
    if (sources.polymarketPrice !== undefined) {
      weightedSum += sources.polymarketPrice * this.WEIGHTS.polymarket;
      totalWeight += this.WEIGHTS.polymarket;
      breakdown.push({ name: 'Polymarket', prob: sources.polymarketPrice, weight: this.WEIGHTS.polymarket });
    }

    // 3. Claude AI
    if (sources.claudeProb !== undefined) {
      weightedSum += sources.claudeProb * this.WEIGHTS.claude;
      totalWeight += this.WEIGHTS.claude;
      breakdown.push({ name: 'Claude AI', prob: sources.claudeProb, weight: this.WEIGHTS.claude });
    }

    // 4. News Sentiment (Convert -1..1 to 0..1 probability impact centered on Kalshi price)
    // If news is positive, it pulls probability UP from the current market price
    if (sources.newsSentiment !== undefined && sources.kalshiPrice !== undefined) {
      const impact = sources.newsSentiment * 0.2; // Max 20% swing
      const derivedProb = Math.max(0.01, Math.min(0.99, sources.kalshiPrice + impact));
      
      weightedSum += derivedProb * this.WEIGHTS.news;
      totalWeight += this.WEIGHTS.news;
      breakdown.push({ name: 'News', prob: derivedProb, weight: this.WEIGHTS.news });
    }

    // 5. Social Sentiment (Same logic)
    if (sources.socialSentiment !== undefined && sources.kalshiPrice !== undefined) {
      const impact = sources.socialSentiment * 0.2;
      const derivedProb = Math.max(0.01, Math.min(0.99, sources.kalshiPrice + impact));
      
      weightedSum += derivedProb * this.WEIGHTS.social;
      totalWeight += this.WEIGHTS.social;
      breakdown.push({ name: 'Social', prob: derivedProb, weight: this.WEIGHTS.social });
    }

    if (totalWeight === 0) return { probability: 0.5, confidence: 'LOW', sources: [] };

    const finalProb = weightedSum / totalWeight;

    // Detect Arbitrage
    let arbitrageAlert = false;
    let delta = 0;
    
    if (sources.kalshiPrice && sources.polymarketPrice) {
      delta = (sources.polymarketPrice - sources.kalshiPrice);
      if (Math.abs(delta) > 0.05) {
        arbitrageAlert = true;
      }
    }

    // Calculate Confidence (Standard Deviation)
    const values = breakdown.map(b => b.prob);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    let confidence = 'HIGH';
    if (stdDev > 0.15) confidence = 'LOW';
    else if (stdDev > 0.08) confidence = 'MEDIUM';

    return {
      probability: finalProb,
      confidence,
      sources: breakdown,
      arbitrageAlert,
      delta: (delta * 100).toFixed(1)
    };
  }
};
