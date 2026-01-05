// ORACLE Edge Detection Module
// Identifies and analyzes edge opportunities

const ORACLE_EDGE = {
  /**
   * Calculate edge between model probability and market price
   * 
   * @param {number} modelProb - Your estimated probability (0-1)
   * @param {number} marketPrice - Current market YES price (0-1)
   * @returns {object} - Edge analysis
   */
  calculateEdge(modelProb, marketPrice) {
    // Market implied probability is the YES price
    const marketImplied = marketPrice;
    
    // Edge = Model - Market
    // Positive edge = market underpricing YES (buy YES)
    // Negative edge = market overpricing YES (buy NO)
    const edge = modelProb - marketImplied;
    const edgePercent = edge * 100;
    
    // Determine recommended side
    let recommendedSide = 'PASS';
    if (edge > 0) {
      recommendedSide = 'YES';
    } else if (edge < 0) {
      recommendedSide = 'NO';
    }
    
    return {
      edge: edge,
      edgePercent: edgePercent,
      absEdge: Math.abs(edge),
      absEdgePercent: Math.abs(edgePercent),
      modelProbability: modelProb,
      marketImplied: marketImplied,
      recommendedSide: recommendedSide,
      direction: edge > 0 ? 'UNDERPRICED' : edge < 0 ? 'OVERPRICED' : 'FAIR'
    };
  },

  /**
   * Generate full trade recommendation
   * 
   * @param {number} modelProb - Your estimated probability (0-1)
   * @param {number} yesPrice - Current YES price (0-1)
   * @param {number} noPrice - Current NO price (0-1)
   * @param {object} settings - User settings from storage
   * @returns {object} - Complete recommendation
   */
  generateRecommendation(modelProb, yesPrice, noPrice, settings) {
    const {
      bankroll,
      kellyFraction,
      minEdgeThreshold,
      maxPositionPercent
    } = settings;

    // Calculate edge
    const edgeAnalysis = this.calculateEdge(modelProb, yesPrice);
    
    // Determine if edge meets threshold
    const meetsThreshold = edgeAnalysis.absEdge >= minEdgeThreshold;
    
    // Determine action
    let action = 'PASS';
    let side = null;
    let price = null;
    
    if (meetsThreshold) {
      if (edgeAnalysis.edge > 0) {
        action = 'BUY';
        side = 'YES';
        price = yesPrice;
      } else {
        action = 'BUY';
        side = 'NO';
        price = noPrice;
      }
    }
    
    // Calculate position sizing if action is BUY
    let sizing = null;
    let ev = null;
    
    if (action === 'BUY') {
      sizing = ORACLE_KELLY.calculateBetSize(
        modelProb,
        yesPrice,
        bankroll,
        kellyFraction,
        side
      );
      
      // Apply constraints
      sizing = ORACLE_KELLY.applyConstraints(sizing, {
        maxPositionPercent: maxPositionPercent
      });
      
      // Calculate expected value
      ev = ORACLE_KELLY.expectedValue(
        modelProb,
        yesPrice,
        sizing.constrainedCost || sizing.actualCost,
        side
      );
    }
    
    // Confidence level
    const confidence = ORACLE_KELLY.confidenceLevel(edgeAnalysis.edge);
    
    return {
      action: action,
      side: side,
      price: price,
      edge: edgeAnalysis,
      sizing: sizing,
      expectedValue: ev,
      confidence: confidence,
      meetsThreshold: meetsThreshold,
      thresholdRequired: minEdgeThreshold,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Format recommendation for display
   * 
   * @param {object} recommendation - Output from generateRecommendation
   * @returns {object} - Formatted for UI
   */
  formatForDisplay(recommendation) {
    const { action, side, price, edge, sizing, expectedValue, confidence } = recommendation;
    
    if (action === 'PASS') {
      return {
        actionText: 'PASS',
        actionClass: 'pass',
        reason: `Edge ${edge.absEdgePercent.toFixed(1)}% below ${(recommendation.thresholdRequired * 100).toFixed(0)}% threshold`,
        details: null
      };
    }
    
    const contracts = sizing?.constrainedContracts || sizing?.contracts || 0;
    const cost = sizing?.constrainedCost || sizing?.actualCost || 0;
    
    return {
      actionText: `${action} ${side}`,
      actionClass: side.toLowerCase(),
      price: `$${price.toFixed(2)}`,
      edgeText: `${edge.edgePercent > 0 ? '+' : ''}${edge.edgePercent.toFixed(1)}%`,
      edgeClass: edge.edge > 0 ? 'positive' : 'negative',
      confidence: confidence,
      confidenceClass: confidence.toLowerCase(),
      contracts: contracts,
      cost: `$${cost.toFixed(2)}`,
      bankrollPercent: `${sizing?.bankrollPercent?.toFixed(1) || 0}%`,
      expectedValue: expectedValue ? `$${expectedValue.expectedValue.toFixed(2)}` : null,
      evPercent: expectedValue ? `${expectedValue.expectedValuePercent.toFixed(1)}%` : null,
      potentialProfit: expectedValue ? `$${expectedValue.profitIfWin.toFixed(2)}` : null
    };
  },

  /**
   * Validate probability input
   * 
   * @param {number} prob - Probability value
   * @returns {object} - Validation result
   */
  validateProbability(prob) {
    if (typeof prob !== 'number' || isNaN(prob)) {
      return { valid: false, error: 'Probability must be a number' };
    }
    if (prob < 0 || prob > 1) {
      return { valid: false, error: 'Probability must be between 0 and 1' };
    }
    if (prob === 0 || prob === 1) {
      return { valid: false, error: 'Probability cannot be exactly 0 or 1' };
    }
    return { valid: true, error: null };
  },

  /**
   * Parse price from various formats
   * 
   * @param {string|number} priceInput - Price in various formats
   * @returns {number|null} - Normalized price (0-1) or null if invalid
   */
  parsePrice(priceInput) {
    if (typeof priceInput === 'number') {
      if (priceInput > 1 && priceInput <= 100) {
        return priceInput / 100; // Assume percentage
      }
      if (priceInput >= 0 && priceInput <= 1) {
        return priceInput;
      }
      return null;
    }
    
    if (typeof priceInput === 'string') {
      // Remove currency symbols and whitespace
      const cleaned = priceInput.replace(/[$¢%\s]/g, '');
      const num = parseFloat(cleaned);
      
      if (isNaN(num)) return null;
      
      // Determine format
      if (priceInput.includes('¢') || num > 1) {
        return num / 100; // Cents or percentage
      }
      return num;
    }
    
    return null;
  },

  /**
   * Calculate correlation risk between positions
   * 
   * @param {array} positions - Current open positions
   * @param {object} newPosition - Proposed new position
   * @returns {object} - Correlation risk assessment
   */
  assessCorrelationRisk(positions, newPosition) {
    // Simple correlation check based on market category
    // In production, this would use actual correlation data
    
    const categories = positions.map(p => p.category);
    const newCategory = newPosition.category;
    
    const sameCategory = positions.filter(p => p.category === newCategory);
    const sameCategoryExposure = sameCategory.reduce((sum, p) => sum + p.costBasis, 0);
    
    return {
      sameCategory: sameCategory.length,
      sameCategoryExposure: sameCategoryExposure,
      warning: sameCategory.length >= 3 ? 'HIGH_CONCENTRATION' : null
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ORACLE_EDGE = ORACLE_EDGE;
}
