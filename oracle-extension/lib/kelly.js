// ORACLE Kelly Criterion Module
// Optimal position sizing calculations

const ORACLE_KELLY = {
  /**
   * Calculate Kelly fraction for optimal bet sizing
   * f* = (bp - q) / b
   * 
   * @param {number} modelProb - Your estimated probability (0-1)
   * @param {number} marketPrice - Current market price (0-1)
   * @param {string} side - 'YES' or 'NO'
   * @returns {number} - Optimal fraction of bankroll to bet (0-1)
   */
  kellyFraction(modelProb, marketPrice, side = 'YES') {
    // Adjust probability based on side
    const p = side === 'YES' ? modelProb : (1 - modelProb);
    const price = side === 'YES' ? marketPrice : (1 - marketPrice);
    
    // Calculate odds (payout ratio)
    // If you buy YES at $0.40, you pay $0.40 to win $1.00
    // Profit if win = $0.60, so odds = 0.60/0.40 = 1.5
    const b = (1 - price) / price;
    
    // Probability of losing
    const q = 1 - p;
    
    // Kelly formula: f* = (bp - q) / b
    const kelly = (b * p - q) / b;
    
    // Never return negative (means don't bet)
    return Math.max(0, kelly);
  },

  /**
   * Calculate fractional Kelly bet size
   * 
   * @param {number} modelProb - Your estimated probability (0-1)
   * @param {number} marketPrice - Current market price (0-1)
   * @param {number} bankroll - Total bankroll in dollars
   * @param {number} fraction - Kelly fraction to use (default 0.25 = quarter Kelly)
   * @param {string} side - 'YES' or 'NO'
   * @returns {object} - Bet sizing details
   */
  calculateBetSize(modelProb, marketPrice, bankroll, fraction = 0.25, side = 'YES') {
    const fullKelly = this.kellyFraction(modelProb, marketPrice, side);
    const adjustedKelly = fullKelly * fraction;
    
    const betAmount = bankroll * adjustedKelly;
    const price = side === 'YES' ? marketPrice : (1 - marketPrice);
    const contracts = Math.floor(betAmount / price);
    const actualCost = contracts * price;
    
    return {
      fullKellyPercent: fullKelly * 100,
      adjustedKellyPercent: adjustedKelly * 100,
      betAmount: betAmount,
      contracts: contracts,
      actualCost: actualCost,
      pricePerContract: price,
      bankrollPercent: (actualCost / bankroll) * 100
    };
  },

  /**
   * Calculate expected value of a bet
   * EV = (P(win) × Profit) - (P(lose) × Loss)
   * 
   * @param {number} modelProb - Your estimated probability (0-1)
   * @param {number} marketPrice - Current market price (0-1)
   * @param {number} betAmount - Amount to bet in dollars
   * @param {string} side - 'YES' or 'NO'
   * @returns {object} - Expected value details
   */
  expectedValue(modelProb, marketPrice, betAmount, side = 'YES') {
    const p = side === 'YES' ? modelProb : (1 - modelProb);
    const price = side === 'YES' ? marketPrice : (1 - marketPrice);
    
    // Profit if win: bet at price, receive $1 per contract
    // Contracts = betAmount / price
    // Payout = contracts * $1 = betAmount / price
    // Profit = Payout - betAmount = (betAmount / price) - betAmount = betAmount * ((1-price)/price)
    const profitIfWin = betAmount * ((1 - price) / price);
    const lossIfLose = betAmount;
    
    const ev = (p * profitIfWin) - ((1 - p) * lossIfLose);
    const evPercent = (ev / betAmount) * 100;
    
    return {
      expectedValue: ev,
      expectedValuePercent: evPercent,
      profitIfWin: profitIfWin,
      lossIfLose: lossIfLose,
      winProbability: p,
      loseProbability: 1 - p,
      returnOnInvestment: (profitIfWin / betAmount) * 100
    };
  },

  /**
   * Calculate break-even probability
   * The probability needed for EV = 0
   * 
   * @param {number} marketPrice - Current market price (0-1)
   * @param {string} side - 'YES' or 'NO'
   * @returns {number} - Break-even probability
   */
  breakEvenProbability(marketPrice, side = 'YES') {
    // Break-even is simply the market price (implied probability)
    return side === 'YES' ? marketPrice : (1 - marketPrice);
  },

  /**
   * Apply risk constraints to bet sizing
   * 
   * @param {object} betSize - Output from calculateBetSize
   * @param {object} constraints - Risk constraints
   * @returns {object} - Constrained bet sizing
   */
  applyConstraints(betSize, constraints) {
    const {
      maxPositionPercent = 0.05,
      maxBetAmount = Infinity,
      minBetAmount = 1
    } = constraints;

    let constrainedAmount = betSize.betAmount;
    let constraintApplied = null;

    // Apply max position constraint
    const maxFromPosition = betSize.actualCost; // Already calculated based on Kelly
    if (betSize.bankrollPercent > maxPositionPercent * 100) {
      constrainedAmount = betSize.actualCost * (maxPositionPercent * 100 / betSize.bankrollPercent);
      constraintApplied = 'MAX_POSITION';
    }

    // Apply max bet amount
    if (constrainedAmount > maxBetAmount) {
      constrainedAmount = maxBetAmount;
      constraintApplied = 'MAX_BET';
    }

    // Apply min bet amount
    if (constrainedAmount < minBetAmount && constrainedAmount > 0) {
      constrainedAmount = minBetAmount;
      constraintApplied = 'MIN_BET';
    }

    const contracts = Math.floor(constrainedAmount / betSize.pricePerContract);
    const actualCost = contracts * betSize.pricePerContract;

    return {
      ...betSize,
      constrainedAmount: constrainedAmount,
      constrainedContracts: contracts,
      constrainedCost: actualCost,
      constraintApplied: constraintApplied
    };
  },

  /**
   * Determine confidence level based on edge magnitude
   * 
   * @param {number} edge - Edge percentage (can be negative)
   * @returns {string} - Confidence level
   */
  confidenceLevel(edge) {
    const absEdge = Math.abs(edge);
    if (absEdge >= 0.15) return 'HIGH';
    if (absEdge >= 0.08) return 'MEDIUM';
    if (absEdge >= 0.05) return 'LOW';
    return 'NONE';
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ORACLE_KELLY = ORACLE_KELLY;
}
