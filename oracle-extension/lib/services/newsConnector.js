const NewsConnector = {
  BASE_URL: 'https://newsapi.org/v2',

  async searchNews(query, apiKey) {
    if (!apiKey) return null;
    
    // Check cache
    const cacheKey = `news_${query}`;
    const cached = await this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.BASE_URL}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=relevancy&pageSize=10&apiKey=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`NewsAPI Error: ${response.status}`);
      
      const data = await response.json();
      
      const result = {
        articles: data.articles || [],
        sentiment: this.analyzeSentiment(data.articles || []),
        velocity: this._calculateVelocity(data.articles || [])
      };
      
      // Cache for 15 minutes
      await this._saveToCache(cacheKey, result, 15 * 60 * 1000);
      
      return result;
    } catch (error) {
      console.error('[ORACLE] News search failed:', error);
      return { articles: [], sentiment: 0, velocity: 0 };
    }
  },

  analyzeSentiment(articles) {
    if (!articles.length) return 0;

    let totalScore = 0;
    const positiveWords = ['surge', 'record', 'growth', 'win', 'positive', 'gain', 'high', 'success', 'lead', 'bullish', 'up'];
    const negativeWords = ['plunge', 'loss', 'crashe', 'drop', 'negative', 'fall', 'low', 'fail', 'trail', 'bearish', 'down', 'crisis'];

    let analyzedCount = 0;

    articles.forEach(article => {
      if (!article.title) return;
      const text = (article.title + ' ' + (article.description || '')).toLowerCase();
      
      let score = 0;
      positiveWords.forEach(word => { if (text.includes(word)) score += 1; });
      negativeWords.forEach(word => { if (text.includes(word)) score -= 1; });
      
      // Normalize per article (-1 to 1)
      score = Math.max(-1, Math.min(1, score / 3)); 
      
      totalScore += score;
      analyzedCount++;
    });

    return analyzedCount > 0 ? totalScore / analyzedCount : 0;
  },

  _calculateVelocity(articles) {
    if (!articles.length) return 0;
    // Simple verification of recent density
    // Assuming API returned sorted by relevancy, but we can check dates
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    const recentArticles = articles.filter(a => new Date(a.publishedAt) > oneDayAgo);
    return recentArticles.length / 24; // Avg per hour
  },

  async _getFromCache(key) {
    const data = await chrome.storage.local.get(key);
    if (data[key] && data[key].expiry > Date.now()) {
      return data[key].payload;
    }
    return null;
  },

  async _saveToCache(key, payload, ttl) {
    await chrome.storage.local.set({
      [key]: {
        payload,
        expiry: Date.now() + ttl
      }
    });
  }
};
