const RedditConnector = {
  // Subreddits to scan for political/news content
  SUBREDDITS: ['politics', 'news', 'worldnews', 'economics'],

  async searchPosts(query) {
    try {
      // Search across all subreddits
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=week&limit=25`;
      const response = await fetch(url);
      
      if (!response.ok) {
         // Fallback if generic search fails, try specific subreddit
         const fallbackUrl = `https://www.reddit.com/r/politics/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=10`;
         const fallbackResponse = await fetch(fallbackUrl);
         if(!fallbackResponse.ok) throw new Error("Reddit API failed");
         const data = await fallbackResponse.json();
         return this._processRedditData(data);
      }
      
      const data = await response.json();
      return this._processRedditData(data);
    } catch (error) {
      console.error('[ORACLE] Reddit search failed:', error);
      return { posts: [], sentiment: 0, volume: 0 };
    }
  },

  _processRedditData(data) {
    const posts = data.data?.children?.map(child => child.data) || [];
    
    if (posts.length === 0) return { posts: [], sentiment: 0, volume: 0 };

    // Calculate basic sentiment based on upvote ratios and generic keywords
    // Real sentiment analysis on Reddit needs NLP, but we'll use heuristics
    let weightedSentiment = 0;
    let totalWeight = 0;
    
    const positiveWords = ['agree', 'good', 'great', 'win', 'correct', 'yes', 'finally'];
    const negativeWords = ['disagree', 'bad', 'terrible', 'lose', 'wrong', 'no', 'never'];

    posts.forEach(post => {
      const text = (post.title + ' ' + (post.selftext || '')).toLowerCase();
      
      // Base score from upvote ratio (0.5 is neutral)
      let score = (post.upvote_ratio - 0.5) * 2; // Map 0..1 to -1..1
      
      // Adjust by keyword match
      let keywordScore = 0;
      positiveWords.forEach(w => { if(text.includes(w)) keywordScore += 0.2; });
      negativeWords.forEach(w => { if(text.includes(w)) keywordScore -= 0.2; });
      
      // Cap keyword score
      keywordScore = Math.max(-0.5, Math.min(0.5, keywordScore));
      
      score += keywordScore;
      
      // Weight by score/comments to prioritize high-engagement posts
      const weight = Math.log10(post.score + 1) + Math.log10(post.num_comments + 1);
      
      weightedSentiment += score * weight;
      totalWeight += weight;
    });

    const finalSentiment = totalWeight > 0 ? Math.max(-1, Math.min(1, weightedSentiment / totalWeight)) : 0;

    return {
      posts: posts.slice(0, 5).map(p => ({ title: p.title, url: p.url, score: p.score })),
      sentiment: finalSentiment,
      volume: posts.length
    };
  }
};
