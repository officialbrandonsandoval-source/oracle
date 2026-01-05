// ORACLE Service Worker
// Background tasks and API calls

// Import libraries
try {
  importScripts(
    '../lib/oracle_data.js',
    '../lib/services/polymarketConnector.js',
    '../lib/services/newsConnector.js',
    '../lib/services/redditConnector.js',
    '../lib/services/kalshiConnector.js',
    '../lib/probabilityAggregator.js',
    '../lib/calibrationTracker.js'
  );
} catch (e) {
  console.error(e);
}

// Install event
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ORACLE] Extension installed:', details.reason);
  
  // Initialize default settings
  if (details.reason === 'install') {
    initializeDefaults();
  }
});

// Initialize default settings
async function initializeDefaults() {
  const defaults = {
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
  };

  await chrome.storage.local.set(defaults);
  console.log('[ORACLE] Default settings initialized');
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ORACLE] Message received:', message.type);

  switch (message.type) {
    case 'ADD_POSITION':
      handleAddPosition(message.position).then(sendResponse);
      return true;

    case 'GET_ORACLE_ANALYSIS':
      handleOracleAnalysis(message.marketTitle, message.currentPrice, message.options).then(sendResponse);
      return true;

    case 'CHAT_WITH_ORACLE':
      handleOracleChat(message.marketTitle, message.marketContext, message.userMessage).then(sendResponse);
      return true;

    case 'CLOSE_POSITION':
      handleClosePosition(message.positionId, message.exitPrice, message.outcome).then(sendResponse);
      return true;

    case 'GET_SETTINGS':
      chrome.storage.local.get('settings', (data) => {
        sendResponse(data.settings);
      });
      return true;

    case 'SAVE_SETTINGS':
      chrome.storage.local.set({ settings: message.settings }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'FETCH_MARKET_DATA':
      fetchKalshiMarketData(message.marketId).then(sendResponse);
      return true;

    // --- NEW HANDLERS V2 ---
    case 'GET_CROSS_REFERENCE':
      handleCrossReference(message.marketTitle).then(sendResponse);
      return true;

    case 'GET_NEWS_SENTIMENT':
      handleNewsSentiment(message.query).then(sendResponse);
      return true;

    case 'GET_SOCIAL_SENTIMENT':
      handleSocialSentiment(message.query).then(sendResponse);
      return true;

    case 'GET_AGGREGATED_ANALYSIS':
       handleAggregatedAnalysis(message.marketTitle, message.currentPrice, message.options).then(sendResponse);
       return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// --- V2 HANDLERS ---

async function handleCrossReference(marketTitle) {
  if (typeof PolymarketConnector === 'undefined') return { error: 'Connector not loaded' };
  const data = await PolymarketConnector.findMatchingMarket(marketTitle);
  return { success: true, data };
}

async function handleNewsSentiment(query) {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.newsApiKey) return { error: 'No NewsAPI Key' };
  
  const data = await NewsConnector.searchNews(query, settings.newsApiKey);
  return { success: true, data };
}

async function handleSocialSentiment(query) {
  const data = await RedditConnector.searchPosts(query);
  return { success: true, data };
}

async function handleAggregatedAnalysis(marketTitle, currentPrice, options) {
  // 1. Gather Data in Parallel
  const { settings } = await chrome.storage.local.get('settings');
  const newsKey = settings?.newsApiKey;
  
  // Clean query for search
  const cleanQuery = marketTitle.replace(/[^\w\s]/g, '').trim();

  // Parallel Fetch (with extra robustness)
  // We wrap these in individual try/catches so one failure doesn't kill the whole request
  const [polyData, newsData, redditData] = await Promise.all([
     PolymarketConnector.findMatchingMarket(cleanQuery).catch(e => { console.warn('Poly fail', e); return null; }),
     newsKey ? NewsConnector.searchNews(cleanQuery, newsKey).catch(e => { console.warn('News fail', e); return null; }) : Promise.resolve(null),
     RedditConnector.searchPosts(cleanQuery).catch(e => { console.warn('Reddit fail', e); return null; })
  ]);

  // 2. Prepare context for Claude
  const context = {
    polymarket: polyData,
    news: newsData,
    reddit: redditData,
    options: options
  };
  
  // NOTE: If ORACLE_DATA is not defined, we need to handle that. 
  // It should be imported at the top.
  if (typeof ORACLE_DATA === 'undefined') {
     console.error('[ORACLE] ORACLE_DATA is undefined');
     return { success: false, error: 'Internal Error: Oracle Module not loaded' };
  }

  // 3. Ask Claude for its opinion observing this data
  let claudeResult;
  try {
     claudeResult = await ORACLE_DATA.analyzeMarketV2(marketTitle, currentPrice, options, context);
  } catch (e) {
     console.error('[ORACLE] Claude V2 Analysis Failed:', e);
     // Fallback to basic simulation if Claude fails
     claudeResult = await ORACLE_DATA._analyzeSimulation(marketTitle, currentPrice);
     claudeResult.probability = claudeResult.oracleProbability; // Normalize field name
  }

  // 4. Aggregate Final Probability
  const sources = {
    kalshiPrice: currentPrice,
    polymarketPrice: polyData ? polyData.yesPrice : undefined,
    claudeProb: claudeResult.oracleProbability || claudeResult.probability, // Handle potential inconsistent naming
    newsSentiment: newsData ? newsData.sentiment : undefined,
    socialSentiment: redditData ? redditData.sentiment : undefined
  };
  
  // Ensure ProbabilityAggregator handles cases where sources are missing gracefully
  const finalAnalysis = ProbabilityAggregator.aggregate(sources);
  
  // Merge Claude's text summary with our stats
  finalAnalysis.summary = claudeResult.summary || "Analysis synthesized from market data.";
  finalAnalysis.bestOption = claudeResult.bestOption || "N/A";
  finalAnalysis.sourcesDetails = { polyData, newsData, redditData }; 
  finalAnalysis.isAiGenerated = claudeResult.isAiGenerated !== false;

  return { success: true, analysis: finalAnalysis };
}

// Handle adding a new position
async function handleAddPosition(position) {
  const { positions } = await chrome.storage.local.get('positions');
  const currentPositions = positions || [];

  const newPosition = {
    id: crypto.randomUUID(),
    ...position,
    entryDate: new Date().toISOString(),
    status: 'OPEN'
  };

  currentPositions.push(newPosition);
  await chrome.storage.local.set({ positions: currentPositions });

  return { success: true, position: newPosition };
}

// Handle closing a position
async function handleClosePosition(positionId, exitPrice, outcome) {
  const { positions, trades, performance, settings } = await chrome.storage.local.get([
    'positions', 'trades', 'performance', 'settings'
  ]);

  const currentPositions = positions || [];
  const currentTrades = trades || [];
  const currentPerformance = performance || {};
  const currentSettings = settings || { bankroll: 5000 };

  const index = currentPositions.findIndex(p => p.id === positionId);
  if (index === -1) {
    return { success: false, error: 'Position not found' };
  }

  const position = currentPositions[index];
  const payout = outcome === 'WIN' ? position.contracts : 0;
  const realizedPL = payout - position.costBasis;

  // Update position
  currentPositions[index] = {
    ...position,
    status: 'CLOSED',
    exitPrice,
    exitDate: new Date().toISOString(),
    outcome,
    payout,
    realizedPL
  };

  // Add to trades
  currentTrades.push({
    id: crypto.randomUUID(),
    ...currentPositions[index],
    action: 'CLOSE'
  });

  // Update performance
  const closedTrades = currentTrades.filter(t => t.status === 'CLOSED');
  const wins = closedTrades.filter(t => t.outcome === 'WIN');
  const totalPL = closedTrades.reduce((sum, t) => sum + (t.realizedPL || 0), 0);

  const updatedPerformance = {
    ...currentPerformance,
    totalTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? wins.length / closedTrades.length : 0,
    totalPL: totalPL,
    roiPercent: currentSettings.bankroll > 0 ? (totalPL / currentSettings.bankroll) * 100 : 0
  };

  // Save all updates
  await chrome.storage.local.set({
    positions: currentPositions,
    trades: currentTrades,
    performance: updatedPerformance
  });

  return { success: true, position: currentPositions[index], performance: updatedPerformance };
}

// Fetch market data from Kalshi API (placeholder - would need API keys)
async function fetchKalshiMarketData(marketId) {
  // In production, this would call the Kalshi API
  // For now, return a placeholder
  console.log('[ORACLE] Fetching market data for:', marketId);
  
  return {
    success: false,
    error: 'API integration not yet implemented. Use manual price input.'
  };
}

// Create alarms for periodic tasks
chrome.alarms.create('updatePositions', { periodInMinutes: 5 });

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updatePositions') {
    updateOpenPositions();
  }
});

// Update open positions with current prices (placeholder)
async function updateOpenPositions() {
  const { positions } = await chrome.storage.local.get('positions');
  const openPositions = (positions || []).filter(p => p.status === 'OPEN');

  if (openPositions.length === 0) return;

  console.log('[ORACLE] Updating', openPositions.length, 'open positions');
  
  // In production, fetch current prices and update unrealizedPL
  // For now, just log
}

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'oracle-analyze',
    title: 'Analyze with ORACLE',
    contexts: ['page'],
    documentUrlPatterns: ['https://kalshi.com/*', 'https://*.kalshi.com/*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'oracle-analyze') {
    // Send message to content script to refresh analysis
    chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_ANALYSIS' });
  }
});

console.log('[ORACLE] Service worker loaded');

// Handle Oracle Analysis request (Legacy or Simple)
async function handleOracleAnalysis(marketTitle, currentPrice, options) {
  try {
    // Check if ORACLE_DATA is loaded
    if (typeof ORACLE_DATA === 'undefined') {
      console.error('ORACLE_DATA not loaded');
      return { success: false, error: 'Oracle Data module not loaded' };
    }
    
    // Ensure options is an array
    const safeOptions = Array.isArray(options) ? options : [];

    const analysis = await ORACLE_DATA.analyzeMarket(marketTitle, currentPrice, safeOptions);
    return { success: true, analysis };
  } catch (error) {
    console.error('Oracle analysis failed:', error);
    return { success: false, error: error.message };
  }
}

// Handle Aggregated Analysis V2
async function handleAggregatedAnalysis(marketTitle, currentPrice, options) {
  if (typeof ORACLE_DATA === 'undefined' || typeof ProbabilityAggregator === 'undefined') {
     console.error('[ORACLE] Dependencies missing (ORACLE_DATA/ProbAggregator)');
     // Attempt re-import if missing? No, that's synchronous.
     return { success: false, error: 'Internal Error: Modules not loaded. Try reloading extension.' };
  }

  // 1. Gather Data in Parallel
  const { settings } = await chrome.storage.local.get('settings');
  const newsKey = settings?.newsApiKey;
  
  // Clean query for search
  const cleanQuery = marketTitle ? marketTitle.replace(/[^\w\s]/g, '').trim() : "market";

  const safeOptions = Array.isArray(options) ? options : [];

  // Parallel Fetch (with extra robustness)
  const [polyData, newsData, redditData] = await Promise.all([
     // Polymarket - requires valid query
     (typeof PolymarketConnector !== 'undefined' && cleanQuery.length > 2) 
        ? PolymarketConnector.findMatchingMarket(cleanQuery).catch(e => { console.warn('Poly fail', e); return null; })
        : Promise.resolve(null),
     
     // News - requires key
     (typeof NewsConnector !== 'undefined' && newsKey) 
        ? NewsConnector.searchNews(cleanQuery, newsKey).catch(e => { console.warn('News fail', e); return null; }) 
        : Promise.resolve(null),
     
     // Reddit
     (typeof RedditConnector !== 'undefined') 
        ? RedditConnector.searchPosts(cleanQuery).catch(e => { console.warn('Reddit fail', e); return null; })
        : Promise.resolve(null)
  ]);

  // 2. Prepare context for Claude
  const context = {
    polymarket: polyData,
    news: newsData,
    reddit: redditData,
    options: safeOptions
  };

  // 3. Ask Claude for its opinion observing this data
  let claudeResult;
  try {
     // Check if V2 method exists, else fallback to standard
     if (ORACLE_DATA.analyzeMarketV2) {
       claudeResult = await ORACLE_DATA.analyzeMarketV2(marketTitle, currentPrice, safeOptions, context);
     } else {
       claudeResult = await ORACLE_DATA.analyzeMarket(marketTitle, currentPrice, safeOptions);
     }
  } catch (e) {
     console.error('[ORACLE] Claude V2 Analysis Failed:', e);
     // Fallback to basic simulation if Claude fails
     claudeResult = await ORACLE_DATA._analyzeSimulation(marketTitle, currentPrice);
     claudeResult.probability = claudeResult.oracleProbability; 
  }

  // 4. Aggregate Final Probability
  const sources = {
    kalshiPrice: currentPrice,
    polymarketPrice: polyData ? polyData.yesPrice : undefined,
    claudeProb: claudeResult.oracleProbability || claudeResult.probability, 
    newsSentiment: newsData ? newsData.sentiment : undefined,
    socialSentiment: redditData ? redditData.sentiment : undefined
  };
  
  const finalAnalysis = ProbabilityAggregator.aggregate(sources);
  
  // Merge Claude's text summary with our stats
  finalAnalysis.summary = claudeResult.summary || "Analysis synthesized from market data.";
  finalAnalysis.bestOption = claudeResult.bestOption || "N/A";
  finalAnalysis.sourcesDetails = { polyData, newsData, redditData }; 
  finalAnalysis.isAiGenerated = claudeResult.isAiGenerated !== false;

  // Track calibration
  if (typeof CalibrationTracker !== 'undefined') {
     CalibrationTracker.recordPrediction({ title: marketTitle, yesPrice: currentPrice }, finalAnalysis.probability).catch(e => console.error(e));
  }

  return { success: true, analysis: finalAnalysis };
}

// Handle Oracle Chat request
async function handleOracleChat(marketTitle, marketContext, userMessage) {
  try {
    const data = await chrome.storage.local.get('settings');
    const apiKey = data.settings?.anthropicApiKey;
    
    if (!apiKey) {
      return { success: true, response: "Please set your Anthropic API Key in settings to enable chat." };
    }

    // Check if ORACLE_DATA is loaded
    if (typeof ORACLE_DATA === 'undefined') {
      return { success: false, error: 'Oracle Data module not loaded' };
    }
    
    // Fallback if context is missing from message (e.g. old content script)
    const safeContext = marketContext || "No page context available.";
    
    const response = await ORACLE_DATA.chatWithClaude(apiKey, marketTitle, safeContext, userMessage);
    return { success: true, response }; // Ensure we return a structured response object
  } catch (error) {
    console.error('Oracle chat failed:', error);
    return { success: false, error: error.message };
  }
}
