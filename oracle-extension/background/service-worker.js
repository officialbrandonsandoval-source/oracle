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
       handleAggregatedAnalysis(message.marketTitle, message.currentPrice, message.options)
          .then(sendResponse)
          .catch(err => sendResponse({ success: false, error: err.message }));
       return true;

    case 'PING':
       sendResponse({ success: true, status: 'ALIVE' });
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

    // Add Timeout
    const analysis = await Promise.race([
      ORACLE_DATA.analyzeMarket(marketTitle, currentPrice, safeOptions),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis internal timeout')), 20000))
    ]);

    return { success: true, analysis };
  } catch (error) {
    console.error('Oracle analysis failed:', error);
    return { success: false, error: error.message };
  }
}

// Handle Aggregated Analysis V2 (Simplified & Robust)
async function handleAggregatedAnalysis(marketTitle, currentPrice, options) {
  // FAST PATH: Check settings first
  let settings = {};
  try {
     const data = await chrome.storage.local.get('settings');
     settings = data.settings || {};
  } catch(e) {}

  // 1. External Data (With strict 3s timeout to fallback fast)
  const fetchExternal = async () => {
     try {
       // Short timeout wrapper
       const withTimeout = (promise) => Promise.race([
          promise,
          new Promise(r => setTimeout(() => r(null), 3500)) 
       ]);

       const cleanQuery = marketTitle ? marketTitle.replace(/[^\w\s]/g, '').trim() : "market";
       
       const [poly, news, reddit] = await Promise.all([
          (typeof PolymarketConnector !== 'undefined') ? withTimeout(PolymarketConnector.findMatchingMarket(cleanQuery).catch(e=>null)) : null,
          (typeof NewsConnector !== 'undefined' && settings.newsApiKey) ? withTimeout(NewsConnector.searchNews(cleanQuery, settings.newsApiKey).catch(e=>null)) : null,
          (typeof RedditConnector !== 'undefined') ? withTimeout(RedditConnector.searchPosts(cleanQuery).catch(e=>null)) : null
       ]);
       
       return { polymarket: poly, news: news, reddit: reddit };
     } catch (e) {
       console.error("External fetch error:", e);
       return { polymarket: null, news: null, reddit: null };
     }
  };

  const contextData = await fetchExternal();
  const context = { ...contextData, options };

  // 2. AI Analysis (Claude or Fallback)
  let claudeResult;
  try {
    // Wrapper for AI timeout (20s max to beat the 25s content script timeout)
    // If AI fails/times out, we FALLBACK to simulation, we do NOT throw error to UI
    const runAi = async () => {
        if (!settings.anthropicApiKey) throw new Error("No API Key");
        
        const promise = ORACLE_DATA.analyzeMarketV2 
            ? ORACLE_DATA.analyzeMarketV2(settings.anthropicApiKey, marketTitle, currentPrice, options, context)
            : ORACLE_DATA._analyzeWithClaude(settings.anthropicApiKey, marketTitle, currentPrice, options);

        return await Promise.race([
            promise,
            new Promise((_, r) => setTimeout(() => r(null), 20000)) // Return null on timeout
        ]);
    };

    if (typeof ORACLE_DATA !== 'undefined') {
       const result = await runAi().catch(e => null);
       if (result) {
          claudeResult = result;
       } else {
          // If null (timeout) or error, use simulation
          console.warn("AI Analysis timed out or failed, using simulation");
          claudeResult = await ORACLE_DATA._analyzeSimulation(marketTitle, currentPrice);
          claudeResult.summary = "AI Service Timeout. " + claudeResult.summary;
       }
    } else {
       // Fallback to simulation if module missing
       if (typeof ORACLE_DATA !== 'undefined') {
          claudeResult = await ORACLE_DATA._analyzeSimulation(marketTitle, currentPrice);
       } else {
          claudeResult = {
             oracleProbability: 0.5,
             summary: "System initializing...",
             isAiGenerated: false
          };
       }
    }
  } catch (e) {
    console.error('AI Analysis failed:', e);
    // Ultimate fallback guarantees a result
    try {
      if (typeof ORACLE_DATA !== 'undefined') {
        claudeResult = await ORACLE_DATA._analyzeSimulation(marketTitle, currentPrice);
        if (!claudeResult) throw new Error("Simulation returned null");
      } else {
        throw new Error("No ORACLE_DATA");
      }
    } catch (err2) {
       claudeResult = { 
         oracleProbability: 0.5, 
         summary: "Service unavailable. " + err2.message, 
         isAiGenerated: false,
         bestOption: "None"
       };
    }
  }

  // 3. Aggregate
  let finalAnalysis = { probability: 0.5, sources: [] };
  
  try {
    const sourcesInput = {
      kalshiPrice: currentPrice,
      polymarketPrice: context.polymarket ? context.polymarket.yesPrice : undefined,
      claudeProb: claudeResult.oracleProbability || claudeResult.probability || 0.5,
      newsSentiment: context.news ? context.news.sentiment : undefined,
      socialSentiment: context.reddit ? context.reddit.sentiment : undefined
    };

    if (typeof ProbabilityAggregator !== 'undefined') {
      finalAnalysis = ProbabilityAggregator.aggregate(sourcesInput);
    } else {
      finalAnalysis.probability = sourcesInput.claudeProb;
      finalAnalysis.sources = [{ name: "Model", prob: sourcesInput.claudeProb, weight: 1 }];
    }
  } catch (e) {
     console.error("Aggregation failed", e);
     finalAnalysis.probability = 0.5;
     finalAnalysis.sources = [];
  }

  // Fill in text details
  finalAnalysis.summary = claudeResult.summary || "Analysis complete.";
  finalAnalysis.bestOption = claudeResult.bestOption;
  finalAnalysis.sourcesDetails = context;
  finalAnalysis.isAiGenerated = claudeResult.isAiGenerated;

  // 4. Track Stats (Fire and forget)
  if (typeof CalibrationTracker !== 'undefined') {
     CalibrationTracker.recordPrediction({ title: marketTitle, yesPrice: currentPrice }, finalAnalysis.probability).catch(e=>{});
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
