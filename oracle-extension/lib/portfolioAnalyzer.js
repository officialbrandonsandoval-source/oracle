const PortfolioAnalyzer = {
  analyze(positions, currentPrices) {
    if(!positions || positions.length === 0) return { riskLevel: 'LOW', warnings: [] };

    // 1. Calculate Exposure
    let totalExposure = 0;
    const categoryExposure = {};
    const warnings = [];

    positions.forEach(pos => {
      const exposure = pos.contracts * pos.avgPrice; // Cost basis approximation
      totalExposure += exposure;

      // Group by category (inferred from title if not stored)
      const cat = pos.category || 'misc';
      categoryExposure[cat] = (categoryExposure[cat] || 0) + exposure;
    });

    // 2. Concentration Check
    Object.entries(categoryExposure).forEach(([cat, amount]) => {
      if (totalExposure > 0 && (amount / totalExposure) > 0.4) {
        warnings.push(`High concentration in ${cat} (${Math.round((amount/totalExposure)*100)}%)`);
      }
    });

    // 3. Loss Thresholds
    positions.forEach(pos => {
      // Find current price (mocked or passed in)
      // If we don't have real-time price for every position, we skip
      const current = currentPrices[pos.marketId] || currentPrices[pos.marketTitle];
      if (current) {
        const pl = (current - pos.avgPrice) / pos.avgPrice;
        if (pl < -0.25) {
           warnings.push(`Stop-loss warning for ${pos.marketTitle.substring(0,20)}... (-${Math.abs(Math.round(pl*100))}%)`);
        }
      }
    });

    return {
      totalExposure,
      riskLevel: warnings.length > 2 ? 'HIGH' : warnings.length > 0 ? 'MEDIUM' : 'LOW',
      warnings
    };
  }
};
