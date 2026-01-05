// ORACLE Data Aggregation Module
// Fetches real-time analysis from Claude AI or falls back to simulation

const ORACLE_DATA = {
  // Simulated data sources (Fallback)
  sources: [
    { id: 'polls', name: 'Aggregated Polls', weight: 0.4, reliability: 'High' },
    { id: 'social', name: 'Social Sentiment (X/Reddit)', weight: 0.2, reliability: 'Medium' },
    { id: 'historical', name: 'Historical Trends', weight: 0.15, reliability: 'High' },
    { id: 'smart_money', name: 'Smart Money Flow', weight: 0.15, reliability: 'Medium' },
    { id: 'news', name: 'News Sentiment Analysis', weight: 0.1, reliability: 'Medium' }
  ],

  /**
   * Analyze a market based on its title and current price
   * Returns a calculated probability and source breakdown
   * 
   * @param {string} marketTitle - The title of the market
   * @param {number} currentPrice - Current market price (0-1)
   * @param {Array} options - List of available options (optional)
   * @returns {Promise<object>} - Analysis result
   */
  async analyzeMarket(marketTitle, currentPrice, options) {
    try {
      // 1. Try to get API Key
      const data = await chrome.storage.local.get('settings');
      const apiKey = data.settings?.anthropicApiKey;

      if (apiKey && apiKey.startsWith('sk-')) {
        return await this._analyzeWithClaude(apiKey, marketTitle, currentPrice, options);
      } else {
        console.log('[ORACLE] No API key found, using simulation');
        return await this._analyzeSimulation(marketTitle, currentPrice);
      }
    } catch (error) {
      console.error('[ORACLE] Analysis error:', error);
      return await this._analyzeSimulation(marketTitle, currentPrice);
    }
  },

  /**
   * V2 Analysis with External Context
   */
  async analyzeMarketV2(marketTitle, currentPrice, options, externalContext) {
    try {
      const data = await chrome.storage.local.get('settings');
      const apiKey = data.settings?.anthropicApiKey;

      if (apiKey && apiKey.startsWith('sk-')) {
        return await this._analyzeWithClaudeV2(apiKey, marketTitle, currentPrice, options, externalContext);
      } else {
        return await this._analyzeSimulation(marketTitle, currentPrice);
      }
    } catch (e) {
      console.error(e);
      return await this._analyzeSimulation(marketTitle, currentPrice);
    }
  },

  async _analyzeWithClaudeV2(apiKey, marketTitle, currentPrice, options, context) {
    const formattedOptions = options && options.length > 0 
      ? JSON.stringify(options.map(o => `${o.name} ($${o.yesPrice.toFixed(2)})`)) 
      : "No specific options list detected. Assume binary Yes/No.";

    // Format external data for prompt
    let externalDataStr = "REAL-TIME DATA (Use this to inform your probability):\n";
    if (context.polymarket) {
      externalDataStr += `- Polymarket (Competitor) Price: $${context.polymarket.yesPrice.toFixed(2)} (Title: ${context.polymarket.title})\n`;
    }
    if (context.news) {
      externalDataStr += `- News Sentiment: ${context.news.sentiment > 0.3 ? "Positive" : context.news.sentiment < -0.3 ? "Negative" : "Neutral"} (Based on ${context.news.articles.length} recent articles)\n`;
      context.news.articles.slice(0,3).forEach(a => externalDataStr += `  * Headline: ${a.title}\n`);
    }
    if (context.reddit) {
      externalDataStr += `- Social Sentiment: ${context.reddit.sentiment > 0 ? "Bullish" : "Bearish"}\n`;
      context.reddit.posts.slice(0,2).forEach(p => externalDataStr += `  * Post: ${p.title}\n`);
    }

    const systemPrompt = `You are ORACLE, an elite prediction market analyst.
Your goal is to find the "Smartest Option" for the user to trade.
You must analyze the market "${marketTitle}".

${externalDataStr}

Available Contracts/Options: ${formattedOptions}

Synthesize these data points. If Polymarket is significantly different from Kalshi ($${currentPrice}), investigate why (arbitrage?).
If News/Social sentiment contradicts the price, mention it.

Output MUST be valid JSON in this exact format:
{
  "oracleProbability": 0.75, 
  "bestOption": "Name of best option", 
  "summary": "Concise synthesis of data sources. Why is this the probability?"
}
Do not include any explanation outside the JSON.`;

    const userPrompt = `Analyze this market. Current Main Price: $${currentPrice.toFixed(2)}.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); 

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API Error: ${response.status}`);
      }
      
      clearTimeout(timeoutId);

      const result = await response.json();
      const content = result.content[0].text;
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON response from Claude");
      
      const analysis = JSON.parse(jsonMatch[0]);

      // Normalize return format to match what Aggregator expects roughly (though aggregator uses this output)
      // Actually aggregator uses .oracleProbability from this.
      return analysis;

    } catch (error) {
      console.error('[ORACLE] Claude API failed:', error);
      throw error; 
    }
  },

  /**
   * Call Claude API for analysis
   */
  async _analyzeWithClaude(apiKey, marketTitle, currentPrice, options) {
    const formattedOptions = options && options.length > 0 
      ? JSON.stringify(options.map(o => `${o.name} ($${o.yesPrice.toFixed(2)})`)) 
      : "No specific options list detected. Assume binary Yes/No.";

    const systemPrompt = `You are ORACLE, an elite prediction market analyst with access to vast knowledge.
Your goal is to find the "Smartest Option" for the user to trade.
You must analyze the market "${marketTitle}".

Access your internal database of "every internet source known to man" (political trends, historical data, polling, statutes, news sentiment up to your knowledge cutoff). 
Simulate a deep web search by cross-referencing multiple data points.

Available Contracts/Options: ${formattedOptions}

If one specific option offers significantly better value (EDGE) than the others, RECOMMEND IT.
If the main Yes price ($${currentPrice.toFixed(2)}) is the focus, analyze that.

Output MUST be valid JSON in this exact format:
{
  "oracleProbability": 0.75, // Your estimated true probability for the MAIN outcome (or best option)
  "bestOption": "Name of best option (or 'Yes')", 
  "summary": "Concise, data-heavy summary. Why is this specific option the smart play? Mention specific polls or precedents.",
  "sources": [
    { "name": "Aggregated Data", "probability": 0.78, "sentiment": "Bullish" },
    { "name": "Key Precedent", "probability": 0.72, "sentiment": "Neutral" }
  ]
}
Do not include any explanation outside the JSON.`;

    const userPrompt = `Analyze this market. Current Main Price: $${currentPrice.toFixed(2)}.
Which option is the mathematically superior play based on real-world data?`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for deep thought

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API Error: ${response.status}`);
      }
      
      clearTimeout(timeoutId);

      const result = await response.json();
      const content = result.content[0].text;
      
      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON response from Claude");
      
      const analysis = JSON.parse(jsonMatch[0]);

      return {
        market: marketTitle,
        oracleProbability: analysis.oracleProbability,
        marketPrice: currentPrice,
        edge: analysis.oracleProbability - currentPrice,
        timestamp: new Date().toISOString(),
        sources: analysis.sources,
        summary: analysis.bestOption && analysis.bestOption !== 'Yes' ? `Note: Best play is "${analysis.bestOption}". ${analysis.summary}` : analysis.summary,
        isAiGenerated: true
      };

    } catch (error) {
      console.error('[ORACLE] Claude API failed:', error);
      throw error; 
    }
  },

  /**
   * Chat with Claude about the market
   */
  async chatWithClaude(apiKey, marketTitle, marketContext, userMessage) {
    const systemPrompt = `You are ORACLE, an elite prediction market analyst. 
You are discussing a specific market: "${marketTitle}".
Your goal is to help the user "verify" information or dig deeper into the analysis.
Keep your answers concise (under 3 sentences unless asked for detail), fact-based, and focused on finding EDGE.

Current Page Context (Use this to understand available contracts/prices):
"""
${marketContext}
"""

If asked about sources, refer to polling aggregators (538, RCP), betting odds, or historical trends.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 300, 
          system: systemPrompt,
          messages: [
            { role: "user", content: userMessage }
          ]
        })
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`Claude API Error: ${response.status}`);
      }
      
      clearTimeout(timeoutId);
      const result = await response.json();
      return result.content[0].text;

    } catch (error) {
       if (error.name === 'AbortError') {
         return "Request timed out. The market context might be too large or the network is slow.";
       }
       console.error('[ORACLE] Chat failed:', error);
       return "I'm having trouble connecting to the network right now. Please try again.";
    }
  },

  /**
   * Fallback Simulation (Original Logic)
   */
  async _analyzeSimulation(marketTitle, currentPrice) {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));

    // Generate deterministic but realistic-looking data based on the market title hash
    const seed = this._hashString(marketTitle);
    const rng = this._seededRandom(seed);

    // Calculate a "true" probability that is somewhat correlated with price 
    // but offers an "edge" (deviation)
    
    // Base sentiment varies around the current price
    // We want to find cases where the market is "wrong"
    // Let's assume the "Oracle" finds a probability that is:
    // currentPrice + (random deviation between -0.15 and +0.15)
    const deviation = (rng() * 0.3) - 0.15;
    let oracleProb = currentPrice + deviation;
    
    // Clamp between 0.01 and 0.99
    oracleProb = Math.max(0.01, Math.min(0.99, oracleProb));

    // Generate source breakdowns that justify this probability
    const sourceData = this.sources.map(source => {
      // Individual source deviation
      const sourceDev = (rng() * 0.2) - 0.1;
      let sourceProb = oracleProb + sourceDev;
      sourceProb = Math.max(0.01, Math.min(0.99, sourceProb));
      
      return {
        id: source.id,
        name: source.name,
        probability: sourceProb,
        sentiment: sourceProb > 0.5 ? 'Bullish' : 'Bearish',
        confidence: 0.6 + (rng() * 0.35), // 0.6 to 0.95
        lastUpdated: new Date(Date.now() - Math.floor(rng() * 3600000)).toISOString()
      };
    });

    // Recalculate weighted average for consistency
    let weightedSum = 0;
    let totalWeight = 0;
    
    sourceData.forEach((data, index) => {
      const weight = this.sources[index].weight;
      weightedSum += data.probability * weight;
      totalWeight += weight;
    });
    
    const finalProb = weightedSum / totalWeight;

    return {
      market: marketTitle,
      oracleProbability: finalProb,
      marketPrice: currentPrice,
      edge: finalProb - currentPrice,
      timestamp: new Date().toISOString(),
      sources: sourceData,
      summary: this._generateSummary(finalProb, currentPrice, sourceData),
      isAiGenerated: false
    };
  },

  _generateSummary(prob, price, sources) {
    const diff = prob - price;
    const direction = diff > 0 ? "undervalued" : "overvalued";
    const significant = Math.abs(diff) > 0.05;
    
    const topSource = sources.reduce((prev, current) => 
      Math.abs(current.probability - prob) < Math.abs(prev.probability - prob) ? current : prev
    );

    if (significant) {
      return `Oracle detects this market is ${direction} by ${(Math.abs(diff) * 100).toFixed(1)}%. ${topSource.name} strongly supports this view.`;
    } else {
      return `Market appears efficiently priced. Oracle consensus aligns with current trading levels.`;
    }
  },

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  },

  _seededRandom(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }
};
