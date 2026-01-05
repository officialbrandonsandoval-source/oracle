const PolymarketConnector = {
  BASE_URL: 'https://clob.polymarket.com',
  GAMMA_URL: 'https://gamma-api.polymarket.com', // Clob often requires API keys for trading, Gamma is good for reading

  async searchMarkets(query) {
    try {
      // Using Gamma API for easier market searching
      const url = `${this.GAMMA_URL}/events?limit=5&active=true&closed=false&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Polymarket API Error: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[ORACLE] Polymarket search failed:', error);
      return [];
    }
  },

  async getMarketOdds(conditionId) {
    try {
      const url = `${this.BASE_URL}/markets/${conditionId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Polymarket Odds Error: ${response.status}`);
      const data = await response.json();
      
      // Calculate probability from mid price or best bid/ask
      // Clob format usually provides orderbook or last trade
      // Fallback to Gamma if CLOB is complex/auth-gated for basic data
      // For this implementation, we'll try to find "tokens" from the Gamma search result
      // But if we have a conditionId (token_id), we might need the specific market object.
      
      // Simplification: If we use the Gamma search result, it contains the 'markets' array with outcome prices.
      return data; 
    } catch (error) {
      console.error('[ORACLE] Polymarket odds failed:', error);
      return null;
    }
  },

  async findMatchingMarket(kalshiTitle) {
    try {
      if (!kalshiTitle) return null;
      
      // Clean title for better matching
      const cleanQuery = kalshiTitle
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\b(Will|Does|Is)\b/gi, '') // Remove common start words
        .trim();
        
      if (cleanQuery.length < 3) return null;

      const events = await this.searchMarkets(cleanQuery);
      
      if (!events || events.length === 0) return null;

      // Find best match
      // Gamma returns 'events' which contain 'markets'
      const bestEvent = events[0]; // Simplest approach: take top result
      
      if (!bestEvent || !bestEvent.markets || bestEvent.markets.length === 0) return null;

      // Find the binary market (Yes/No)
      const binaryMarket = bestEvent.markets.find(m => m.outcomePrices);
      
      if (!binaryMarket) return null;

      // Parse prices
      // JSON usually comes as ["0.45", "0.55"] for ["Yes", "No"] (or vice versa, index 0 is usually Yes/Long in some contexts, but depends on outcome mapping)
      // Polymarket conventions: usually outcomes are ["No", "Yes"] or specific names.
      // We need to check outcome names.
      
      // Let's assume a simplified normalized return for now
      const outcomes = JSON.parse(binaryMarket.outcomes);
      const prices = JSON.parse(binaryMarket.outcomePrices);
      
      let yesPrice = 0.5;
      let noPrice = 0.5;

      outcomes.forEach((outcome, index) => {
        if (typeof outcome === 'string' && outcome.toLowerCase() === 'yes') {
          yesPrice = parseFloat(prices[index]);
        }
        if (typeof outcome === 'string' && outcome.toLowerCase() === 'no') {
          noPrice = parseFloat(prices[index]);
        }
      });

      return {
        source: 'Polymarket',
        title: bestEvent.title,
        yesPrice: yesPrice,
        noPrice: noPrice,
        marketId: binaryMarket.id,
        volume: bestEvent.volume
      };

    } catch (error) {
      console.error('[ORACLE] Polymarket match failed:', error);
      return null;
    }
  }
};
