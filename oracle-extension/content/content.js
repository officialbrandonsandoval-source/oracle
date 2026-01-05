// ORACLE Content Script
// Injected into Kalshi pages to provide real-time analysis

(function() {
  'use strict';

  // State
  let state = {
    settings: null,
    currentMarket: null,
    modelProbability: 0.5,
    oracleAnalysis: null,
    isMinimized: false,
    panelElement: null,
    observer: null,
    lastUrl: null,
    chatHistory: [] 
  };

  // Initialize
  async function init() {
    console.log('[ORACLE] Initializing...');
    
    try {
      // Load settings
      state.settings = await ORACLE_STORAGE.getSettings();
      console.log('[ORACLE] Settings loaded:', state.settings);
      
      // Create panel
      createPanel();
      
      // Start observing for market data
      observeMarketChanges();
      
      // Check for market data immediately
      detectMarket();
      
      // Listen for URL changes (SPA navigation)
      setInterval(checkUrlChange, 500);
      
      console.log('[ORACLE] Initialized successfully');
    } catch (error) {
      console.error('[ORACLE] Initialization failed:', error);
    }
  }

  // Check for URL changes
  function checkUrlChange() {
    if (window.location.href !== state.lastUrl) {
      state.lastUrl = window.location.href;
      setTimeout(detectMarket, 500);
    }
  }

  // Create the ORACLE panel
  function createPanel() {
    // Remove existing panel if any
    const existing = document.getElementById('oracle-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'oracle-panel';
    panel.innerHTML = getPanelHTML();
    document.body.appendChild(panel);
    
    // Set initial position explicitly to left/top to allow full dragging
    const rect = panel.getBoundingClientRect();
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    state.panelElement = panel;
    
    // Attach event listeners immediately
    attachEventListeners();
  }

  // Get panel HTML - Static Structure
  function getPanelHTML() {
    return `
      <div class="oracle-header">
        <div class="oracle-logo">
          <div class="oracle-logo-icon"></div>
          <span>ORACLE</span>
          <span class="oracle-live-badge" id="oracle-badge">LIVE</span>
        </div>
        <div class="oracle-controls">
          <button class="oracle-btn" id="oracle-refresh" title="Refresh">↻</button>
          <button class="oracle-btn" id="oracle-minimize" title="Minimize">−</button>
        </div>
      </div>
      <div class="oracle-body">
        <div id="oracle-analysis-content">
           <div class="oracle-loading">
            <div class="oracle-spinner"></div>
           </div>
        </div>
        
        <div class="oracle-divider"></div>

        <div class="oracle-section">
          <div class="oracle-section-title">Ask Oracle</div>
          <div id="oracle-chat-history" class="oracle-chat-history"></div>
          <div class="oracle-chat-input-container">
            <input type="text" id="oracle-chat-input" class="oracle-chat-input" placeholder="Ask to verify logic...">
            <button id="oracle-chat-send" class="oracle-chat-send">➤</button>
          </div>
        </div>
      </div>
    `;
  }
  
  function attachEventListeners() {
    if (!state.panelElement) return;

    // GLOBAL DELEGATION for standard buttons (Minimize, Refresh)
    // This is much safer than attaching listeners to specific elements
    state.panelElement.addEventListener('click', (e) => {
        // Handle Minimize
        if (e.target.id === 'oracle-minimize' || e.target.closest('#oracle-minimize')) {
            e.stopPropagation();
            toggleMinimize();
            return;
        }

        // Handle Refresh
        if (e.target.id === 'oracle-refresh' || e.target.closest('#oracle-refresh')) {
            e.stopPropagation();
            const btn = e.target.closest('button');
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => btn.style.transform = 'none', 500);
            state.oracleAnalysis = null; // Clear cache
            detectMarket();
            return;
        }

        // Handle Recommendations (Buy/Sell)
        const recBtn = e.target.closest('#oracle-rec-btn');
        if (recBtn && state.oracleAnalysis) {
             e.stopPropagation();
             handleRecommendationClick();
             return;
        }
    });

    // Make draggable (Header only)
    const header = state.panelElement.querySelector('.oracle-header');
    if (header) {
      makeDraggable(state.panelElement, header);
      header.style.cursor = 'grab';
    }
  }

  // Make element draggable
  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      // CRITICAL: Ignore clicks on buttons completely
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      
      e.preventDefault();
      // Get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // Call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
      handle.style.cursor = 'grabbing';
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // Calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // Set the element's new position:
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.right = 'auto'; // Clear right positioning
    }

    function closeDragElement() {
      // Stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
      handle.style.cursor = 'grab';
    }
  }

  // Get analysis content HTML
  function getAnalysisHTML(market, recommendation) {
    const display = ORACLE_EDGE.formatForDisplay(recommendation);
    const edgeWidth = Math.min(Math.abs(recommendation.edge.edgePercent) * 5, 100);
    
    return `
      <div class="oracle-section">
        <div class="oracle-section-title">Market</div>
        <div class="oracle-market-title">${market.title}</div>
        <div class="oracle-prices">
          <div class="oracle-price-item">
            <span class="oracle-price-label">YES</span>
            <span class="oracle-price-value yes">$${market.yesPrice.toFixed(2)}</span>
          </div>
          <div class="oracle-price-item">
            <span class="oracle-price-label">NO</span>
            <span class="oracle-price-value no">$${market.noPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div class="oracle-divider"></div>
      
      <div class="oracle-section">
        <div class="oracle-section-title">Your Probability</div>
        <div class="oracle-slider-container">
          <div class="oracle-slider-header">
            <span class="oracle-prob-value" id="oracle-prob-display">${(state.modelProbability * 100).toFixed(0)}%</span>
            <span class="oracle-confidence ${display.confidenceClass || 'none'}">${display.confidence || 'SET PROBABILITY'}</span>
          </div>
          <input type="range" 
                 class="oracle-slider" 
                 id="oracle-prob-slider" 
                 min="1" 
                 max="99" 
                 value="${state.modelProbability * 100}">
        </div>
      </div>
      
      <div class="oracle-divider"></div>

      ${state.oracleAnalysis ? `
      <div class="oracle-section">
        <div class="oracle-section-title">Oracle V2 Intelligence</div>

        <!-- Cross Reference -->
        ${state.oracleAnalysis.sourcesDetails?.polyData ? `
        <div class="oracle-crossref">
          <div class="oracle-crossref-item">
            <span class="oracle-crossref-label">Polymarket</span>
            <span class="oracle-crossref-value">$${state.oracleAnalysis.sourcesDetails.polyData.yesPrice.toFixed(2)}</span>
          </div>
          <div class="oracle-crossref-item">
            <span class="oracle-crossref-label">Delta</span>
            <span class="oracle-crossref-value ${state.oracleAnalysis.delta > 0 ? 'positive' : 'negative'}">
              ${state.oracleAnalysis.delta}%
            </span>
          </div>
        </div>
        ${state.oracleAnalysis.arbitrageAlert ? '<div class="oracle-arbitrage-alert">⚡ ARBITRAGE DETECTED</div>' : ''}
        ` : ''}

        <div class="oracle-insight-summary">${state.oracleAnalysis.summary}</div>
        
        <!-- Source Breakdown -->
        <div class="oracle-section-title" style="margin-top:8px">Source Confidence</div>
        <div class="oracle-sources-grid">
          ${state.oracleAnalysis.sources.map(source => `
            <div class="oracle-source-chip">
              <span class="oracle-source-name">${source.name}</span>
              <span class="oracle-source-prob">${(source.prob * 100).toFixed(0)}%</span>
              <span class="oracle-source-weight">Weight: ${(source.weight * 100).toFixed(0)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="oracle-divider"></div>
      ` : `
      <div class="oracle-section">
        <div class="oracle-section-title">Oracle Insights</div>
        <div class="oracle-loading-insights">
           <span class="oracle-pulse-dot"></span> Analyzing data sources...
        </div>
      </div>
      <div class="oracle-divider"></div>
      `}
      
      <div class="oracle-section">
        <div class="oracle-section-title">Analysis</div>
        <div class="oracle-analysis-grid">
          <div class="oracle-analysis-item">
            <div class="oracle-analysis-label">Edge</div>
            <div class="oracle-analysis-value ${recommendation.edge.edge > 0 ? 'positive' : recommendation.edge.edge < 0 ? 'negative' : ''}">${display.edgeText || '0.0%'}</div>
            <div class="oracle-edge-bar">
              <div class="oracle-edge-fill ${recommendation.confidence === 'HIGH' ? 'high' : ''}" style="width: ${edgeWidth}%"></div>
            </div>
          </div>
          <div class="oracle-analysis-item">
            <div class="oracle-analysis-label">Kelly Size</div>
            <div class="oracle-analysis-value purple">${display.cost || '$0.00'}</div>
            <div class="oracle-analysis-label" style="margin-top: 4px">${display.bankrollPercent || '0%'} of bankroll</div>
          </div>
          <div class="oracle-analysis-item">
            <div class="oracle-analysis-label">Expected Value</div>
            <div class="oracle-analysis-value ${recommendation.expectedValue?.expectedValue > 0 ? 'positive' : ''}">${display.expectedValue || '$0.00'}</div>
          </div>
          <div class="oracle-analysis-item">
            <div class="oracle-analysis-label">If Win</div>
            <div class="oracle-analysis-value positive">${display.potentialProfit || '$0.00'}</div>
          </div>
        </div>
      </div>
      
      <div class="oracle-divider"></div>
      
      <div class="oracle-section">
        <button class="oracle-recommendation ${getRecommendationClass(recommendation)}" id="oracle-rec-btn">
          ${recommendation.action !== 'PASS' ? `
            <span class="oracle-rec-icon">${getRecommendationIcon(recommendation)}</span>
            <span class="oracle-rec-action-text">${display.actionText}</span>
            <span class="oracle-rec-count-text">${display.contracts} CONTRACTS</span>
            ${display.price ? `<span class="oracle-rec-price-text">@ ${display.price}</span>` : ''}
          ` : `
            <span class="oracle-rec-icon">${getRecommendationIcon(recommendation)}</span>
            <span>${display.actionText}</span>
            ${display.reason ? `<span style="font-size: 11px; margin-left: 8px; text-transform: none; opacity: 0.7;">(${display.reason})</span>` : ''}
          `}
        </button>
        ${recommendation.action !== 'PASS' ? `<div style="text-align: center; font-size: 10px; margin-top: 4px; color: #71717A;">Click to auto-fill order form</div>` : ''}
      </div>
      
      <div class="oracle-quick-stats">
        <div class="oracle-quick-stat">
          <div class="oracle-quick-stat-value">$${state.settings.bankroll.toLocaleString()}</div>
          <div class="oracle-quick-stat-label">Bankroll</div>
        </div>
        <div class="oracle-quick-stat">
          <div class="oracle-quick-stat-value">${(state.settings.kellyFraction * 100).toFixed(0)}%</div>
          <div class="oracle-quick-stat-label">Kelly</div>
        </div>
        <div class="oracle-quick-stat">
          <div class="oracle-quick-stat-value">${(state.settings.minEdgeThreshold * 100).toFixed(0)}%</div>
          <div class="oracle-quick-stat-label">Min Edge</div>
        </div>
      </div>
    `;
  }

  // Get no market HTML
  function getNoMarketHTML() {
    return `
      <div class="oracle-no-market">
        <div class="oracle-no-market-icon">📊</div>
        <div>Navigate to a Kalshi market to analyze</div>
      </div>
    `;
  }

  // Get recommendation button class
  function getRecommendationClass(rec) {
    if (rec.action === 'PASS') return 'pass';
    if (rec.side === 'YES') return 'buy-yes';
    if (rec.side === 'NO') return 'buy-no';
    return 'pass';
  }

  // Get recommendation icon
  function getRecommendationIcon(rec) {
    if (rec.action === 'PASS') return '⏸';
    if (rec.side === 'YES') return '📈';
    if (rec.side === 'NO') return '📉';
    return '⏸';
  }

  // Attach event listeners
  function attachEventListeners() {
    // Minimize button
    document.getElementById('oracle-minimize')?.addEventListener('click', toggleMinimize);
    
    // Refresh button
    document.getElementById('oracle-refresh')?.addEventListener('click', () => {
      detectMarket();
    });

    // Make draggable
    const header = state.panelElement?.querySelector('.oracle-header');
    if (header && state.panelElement) {
      makeDraggable(state.panelElement, header);
      header.style.cursor = 'grab';
    }
    
    // Recommendation Button (Click to Autofill)
    document.addEventListener('click', (e) => {
      const recBtn = e.target.closest('#oracle-rec-btn');
      if (recBtn && state.oracleAnalysis) {
        handleRecommendationClick();
      }
    });
  }
  
  // Fill order form
  function handleRecommendationClick() {
    try {
      const settings = state.settings;
      if (!settings || !state.currentMarket) return;
      
      // Calculate recommendation again to get exact numbers
      const recommendation = ORACLE_EDGE.generateRecommendation(
        state.modelProbability,
        state.currentMarket.yesPrice,
        state.currentMarket.noPrice,
        settings
      );
      
      if (recommendation.action === 'PASS') return;
      
      const side = recommendation.side; // 'YES' or 'NO'
      const contracts = recommendation.kellyBet.contracts;
      const price = side === 'YES' ? state.currentMarket.yesPrice : state.currentMarket.noPrice;
      
      console.log('[ORACLE] Autofilling:', { side, contracts, price });
      
      // 1. Click the correct Side button (Yes/No)
      const yesBtn = document.querySelector('button[class*="yes"], [data-side="yes"], [class*="buy-yes"]');
      const noBtn = document.querySelector('button[class*="no"], [data-side="no"], [class*="buy-no"]');
      
      if (side === 'YES' && yesBtn) yesBtn.click();
      if (side === 'NO' && noBtn) noBtn.click();
      
      // Retry logic for finding inputs (up to 3s)
      let attempts = 0;
      const maxAttempts = 30; // Increased to 3s
      
      const findAndFill = () => {
        attempts++;
        const inputs = Array.from(document.querySelectorAll('input'));
        
        let amountInput = inputs.find(i => 
           (i.id && i.id.toLowerCase().includes('count')) ||
           (i.name && i.name.toLowerCase().includes('count')) ||
           (i.placeholder && (i.placeholder.includes('0') || i.placeholder === 'Shares')) || 
           (i.type === 'number') 
        );

        if (amountInput) {
           console.log('[ORACLE] Found contract input', amountInput);
           amountInput.focus();
           
           // React Setter Hack
           try {
             const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
             setter.call(amountInput, contracts);
           } catch (e) {
             amountInput.value = contracts;
           }
           
           amountInput.dispatchEvent(new Event('input', { bubbles: true }));
           amountInput.dispatchEvent(new Event('change', { bubbles: true }));
           
           // Visual confirmation
           const originalBorder = amountInput.style.border;
           amountInput.style.border = '2px solid #7C3AED';
           setTimeout(() => amountInput.style.border = originalBorder, 500);
        } else if (attempts < maxAttempts) {
           // Keep trying
           setTimeout(findAndFill, 100);
        } else {
           console.warn('[ORACLE] Could not find contract input after 3s');
        }
      };
      
      findAndFill(); // Start searching


    } catch (e) {
      console.error('[ORACLE] Autofill failed:', e);
    }
  }

  // Attach slider listener (called after analysis renders)
  function attachSliderListener() {
    const slider = document.getElementById('oracle-prob-slider');
    const display = document.getElementById('oracle-prob-display');
    
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.modelProbability = val / 100;
        display.textContent = `${val}%`;
        
        // Debounce update
        clearTimeout(state.sliderTimeout);
        state.sliderTimeout = setTimeout(() => {
          updateAnalysis();
        }, 50);
      });
    }
    
    // Re-attach refresh/minimize listeners if they were lost during re-render
    const refreshBtn = document.getElementById('oracle-refresh');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        state.oracleAnalysis = null;
        detectMarket();
      };
    }
    
    const minBtn = document.getElementById('oracle-minimize');
    if (minBtn) {
      minBtn.onclick = toggleMinimize;
    }

    // Attach Chat Listeners
    const chatInput = document.getElementById('oracle-chat-input');
    const chatSend = document.getElementById('oracle-chat-send');
    
    if (chatInput && chatSend) {
      const submitChat = async () => {
        const msg = chatInput.value.trim();
        if (!msg) return;
        
        // Add user message
        state.chatHistory = state.chatHistory || [];
        state.chatHistory.push({ role: 'user', content: msg });
        
        // Clear input & scroll
        chatInput.value = '';
        
        // Add temporary typing indicator
        state.chatHistory.push({ role: 'assistant', content: '<div class="oracle-chat-typing"><div class="oracle-typing-dot"></div><div class="oracle-typing-dot"></div><div class="oracle-typing-dot"></div></div>', isTyping: true });
        updateChatHistory(); 
        
        try {
          // Get page context for better answers
          let context = "";
          const main = document.querySelector('main');
          if (main) {
             context = main.innerText.substring(0, 2000); // Reduced to 2000 chars
          } else {
             context = document.body.innerText.substring(0, 2000);
          }
          
          // Clean context to remove huge blocks of whitespace/noise
          context = context.replace(/\s+/g, ' ').trim();

          // Send to background
          const response = await chrome.runtime.sendMessage({
            type: 'CHAT_WITH_ORACLE',
            marketTitle: state.currentMarket.title,
            marketContext: context,
            userMessage: msg
          });
          
          // Remove typing indicator
          state.chatHistory = state.chatHistory.filter(m => !m.isTyping);
          
          if (response && response.success) {
            state.chatHistory.push({ role: 'assistant', content: response.response });
          } else {
             state.chatHistory.push({ role: 'assistant', content: response.error || "Error connecting to Oracle." });
          }
        } catch (e) {
          // Remove typing indicator
          state.chatHistory = state.chatHistory.filter(m => !m.isTyping);
          state.chatHistory.push({ role: 'assistant', content: "Network error or timeout. Please check your connection." });
        }
        
        updateChatHistory();
      };

      chatSend.onclick = submitChat;
      chatInput.onkeydown = (e) => {
        e.stopPropagation(); // Prevent Kalshi from stealing the event
        if (e.key === 'Enter') submitChat();
      };
      
      // Prevent focus loss and drag interference
      chatInput.onmousedown = (e) => {
        e.stopPropagation(); // Don't trigger drag
      };
    }
  }

  // Toggle minimize
  function toggleMinimize() {
    state.isMinimized = !state.isMinimized;
    state.panelElement?.classList.toggle('minimized', state.isMinimized);
    const btn = document.getElementById('oracle-minimize');
    if (btn) btn.textContent = state.isMinimized ? '+' : '−';
  }

  // Detect market data from page
  async function detectMarket() {
    console.log('[ORACLE] Detecting market...');
    
    // Try multiple selectors for Kalshi's UI
    const market = extractMarketData();
    console.log('[ORACLE] Extracted market data:', market);
    
    if (market) {
      state.currentMarket = market;
      
      // Clear old analysis if it doesn't match
      if (state.oracleAnalysis && state.oracleAnalysis.market !== market.title) {
        state.oracleAnalysis = null;
        // Also clear chat history on new market
        state.chatHistory = []; 
        updateChatHistory();
      }
      
      // Render immediately so UI is responsive
      updateAnalysis();
      
      // Only fetch if we haven't already for this market
      if (!state.oracleAnalysis) {
        await fetchOracleAnalysis(market);
        updateAnalysis();
      }
    } else {
      console.log('[ORACLE] No market data found, calling showNoMarket');
      showNoMarket();
    }
  }

  // Fetch Oracle analysis from background (V2)
  async function fetchOracleAnalysis(market) {
    // Retry logic for connection issues
    const makeRequest = async (retries = 3) => {
      try {
          const fetchPromise = chrome.runtime.sendMessage({
            type: 'GET_AGGREGATED_ANALYSIS',
            marketTitle: market.title,
            currentPrice: market.yesPrice,
            options: market.options 
          });
          
          // 14s timeout (must be longer than SW timeout of 12s)
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timeout')), 14000));
          
          return await Promise.race([fetchPromise, timeoutPromise]);
      } catch (e) {
          if (retries > 0 && e.message && (e.message.includes('port closed') || e.message.includes('connection'))) {
              console.warn(`[ORACLE] Connection failed, retrying... (${retries} left)`);
              await new Promise(r => setTimeout(r, 1000)); // Wait 1s
              return makeRequest(retries - 1);
          }
          throw e;
      }
    };

    try {
      // Use the new Aggregated Analysis V2
      console.log('[ORACLE] Sending Analysis Request...');
      const response = await makeRequest();
      console.log('[ORACLE] Received Response:', response);
      
      if (response && response.success) {
        state.oracleAnalysis = response.analysis;
        state.modelProbability = response.analysis.probability; // Note: V2 returns .probability not .oracleProbability
        
        // Update badge if AI
        const badge = document.getElementById('oracle-badge');
        if (badge) {
          if (state.oracleAnalysis.isAiGenerated) {
            badge.textContent = 'ORACLE V2';
            badge.style.background = '#7C3AED'; 
          } else {
            badge.textContent = 'LIVE';
            badge.style.background = '#EF4444'; 
          }
        }
        
        // Update slider if it exists
        const slider = document.getElementById('oracle-prob-slider');
        if (slider) {
          slider.value = state.modelProbability * 100;
          slider.dispatchEvent(new Event('input'));
        }
      } else {
        throw new Error(response?.error || 'Analysis request failed');
      }
    } catch (e) {
      console.error('[ORACLE] Failed to fetch analysis:', e);
      
      // Fallback 
      state.oracleAnalysis = {
        market: market.title,
        probability: 0.5,
        oracleProbability: 0.5,
        summary: "Unable to reach Oracle V2 servers. " + e.message,
        sources: [],
        sourcesDetails: {},
        isAiGenerated: false
      };
      
      updateAnalysis();
    }
  }

  // Extract market data from page DOM
  function extractMarketData() {
    try {
      console.log('[ORACLE] Extracting market data...');
      // Get market title - try multiple selectors
      let title = null;
      
      // 1. Try document title first (often contains the market name)
      if (document.title && document.title.includes('| Kalshi')) {
        title = document.title.replace('| Kalshi', '').trim();
      }

      // 2. Try selectors
      if (!title) {
        const titleSelectors = [
          'h1',
          'h2',
          '[data-testid="market-title"]',
          '[class*="MarketTitle"]',
          '[class*="title"]'
        ];
        
        for (const selector of titleSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            // Filter out short titles or irrelevant ones
            if (el.textContent.trim().length > 10 && !el.textContent.includes('Kalshi')) {
              title = el.textContent.trim();
              break;
            }
          }
          if (title) break;
        }
      }

      // Get prices - look for price elements
      let yesPrice = null;
      let noPrice = null;
      
      // Try to find price from URL or page content
      const priceSelectors = [
        '[class*="price"]',
        '[class*="Price"]',
        '[class*="odds"]',
        '[class*="Odds"]',
        '[class*="yes"]',
        '[class*="Yes"]',
        '[class*="no"]',
        '[class*="No"]'
      ];

      // Look for text content with price patterns
      const allText = document.body.innerText;
      
      // Pattern: "Yes $0.XX" or "Yes 42¢" or "YES: 42%"
      const yesMatch = allText.match(/yes[:\s]*\$?(0?\.\d{2}|\d{1,2}[¢%]?)/i);
      const noMatch = allText.match(/no[:\s]*\$?(0?\.\d{2}|\d{1,2}[¢%]?)/i);
      
      if (yesMatch) {
        yesPrice = ORACLE_EDGE.parsePrice(yesMatch[1]);
      }
      if (noMatch) {
        noPrice = ORACLE_EDGE.parsePrice(noMatch[1]);
      }

      // Try specific Kalshi selectors
      const yesBtnSelectors = [
        '[class*="yes"] [class*="price"]',
        '[class*="Yes"] [class*="Price"]',
        'button[class*="yes"]',
        '[data-side="yes"]',
        '[class*="buy-yes"]'
      ];
      
      const noBtnSelectors = [
        '[class*="no"] [class*="price"]',
        '[class*="No"] [class*="Price"]',
        'button[class*="no"]',
        '[data-side="no"]',
        '[class*="buy-no"]'
      ];

      for (const selector of yesBtnSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const priceText = el.textContent.match(/\$?(0?\.\d{2}|\d{1,2})[¢%]?/);
          if (priceText) {
            yesPrice = ORACLE_EDGE.parsePrice(priceText[0]);
            break;
          }
        }
      }

      for (const selector of noBtnSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const priceText = el.textContent.match(/\$?(0?\.\d{2}|\d{1,2})[¢%]?/);
          if (priceText) {
            noPrice = ORACLE_EDGE.parsePrice(priceText[0]);
            break;
          }
        }
      }

      // If we only have one price, calculate the other
      if (yesPrice && !noPrice) {
        noPrice = 1 - yesPrice;
      } else if (noPrice && !yesPrice) {
        yesPrice = 1 - noPrice;
      }

      console.log('[ORACLE] Found prices:', { yesPrice, noPrice, title });

      // Fallback: look for any decimal numbers that could be prices
      if (!yesPrice || !noPrice) {
        const pricePattern = /\b(0\.\d{2})\b/g;
        const matches = [...allText.matchAll(pricePattern)].map(m => parseFloat(m[1]));
        const validPrices = matches.filter(p => p > 0.01 && p < 0.99);
        
        if (validPrices.length >= 2) {
          yesPrice = yesPrice || validPrices[0];
          noPrice = noPrice || validPrices[1];
        } else if (validPrices.length === 1) {
          yesPrice = yesPrice || validPrices[0];
          noPrice = noPrice || (1 - validPrices[0]);
        }
      }

      // Final fallback: default prices for testing
      if (!yesPrice) yesPrice = 0.50;
      if (!noPrice) noPrice = 1 - yesPrice;

      // Extract options (contracts) from the page
      let options = [];
      try {
        // Find visible rows with prices
        // Heuristic: Look for elements that contain "Yes" and a price
        const potentialRows = Array.from(document.querySelectorAll('div, tr, li')).filter(el => {
           // Basic filter to avoid grabbing the whole body
           return el.childElementCount > 0 && el.innerText.length < 300 && 
                  (el.innerText.includes('Yes') || el.innerText.includes('YES')) &&
                  /\$?(0?\.\d{2}|\d{1,2}[¢%]?)/.test(el.innerText);
        });
        
        // Deduplicate closest nested elements (keep the most specific row)
        const rows = potentialRows.filter(row => !potentialRows.some(other => other !== row && other.contains(row)));

        rows.forEach(row => {
           let text = row.innerText.split('\n')[0].trim(); // Name is usually first line
           // Clean up name
           text = text.replace(/Yes\s.*$/, '').replace(/\d+%$/, '').trim();
           
           const priceMatch = row.innerText.match(/Yes[:\s]*\$?(0?\.\d{2}|\d{1,2}[¢%]?)/i) || 
                              row.innerText.match(/\$?(0?\.\d{2}|\d{1,2}[¢%]?)/); // Just finding the price
                              
           if (text && priceMatch && text.length > 2 && text !== 'Yes' && text !== 'No') {
              const price = ORACLE_EDGE.parsePrice(priceMatch[1] || priceMatch[0]);
              
              if (!options.some(o => o.name === text)) {
                 options.push({ name: text, yesPrice: price });
              }
           }
        });
        
        if (options.length > 0) {
           console.log('[ORACLE] Extracted options:', options);
           // Sort by price high to low just for cleaner display in logs
           options.sort((a,b) => b.yesPrice - a.yesPrice);
        }
      } catch (e) {
        console.warn('Option extraction failed', e);
      }

      // Get market ID from URL
      const urlParts = window.location.pathname.split('/');
      const marketId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];

      // Only return if we have a title (indicates we're on a market page)
      if (!title || title.length < 5) {
        // Check if URL suggests we're on a market page
        if (!window.location.pathname.includes('/markets/') && 
            !window.location.pathname.includes('/event/')) {
          return null;
        }
        title = `Market: ${marketId}`;
      }

      return {
        id: marketId,
        title: title.substring(0, 100),
        yesPrice: yesPrice,
        noPrice: noPrice,
        options: options,
        url: window.location.href
      };
    } catch (error) {
      console.error('[ORACLE] Error extracting market data:', error);
      return null;
    }
  }

  // Update analysis display
  function updateAnalysis() {
    if (!state.currentMarket) {
      showNoMarket();
      return;
    }

    // Ensure settings are loaded
    if (!state.settings) {
      console.log('[ORACLE] Settings not loaded yet, skipping update');
      return;
    }

    if (typeof ORACLE_EDGE === 'undefined') {
      console.error('[ORACLE] ORACLE_EDGE library not loaded');
      return;
    }

    try {
      const recommendation = ORACLE_EDGE.generateRecommendation(
        state.modelProbability,
        state.currentMarket.yesPrice,
        state.currentMarket.noPrice,
        state.settings
      );

      // Only parse/update the Analysis Content, NOT the whole body
      const contentContainer = document.getElementById('oracle-analysis-content');
      if (contentContainer) {
        contentContainer.innerHTML = getAnalysisHTML(state.currentMarket, recommendation);
        attachSliderListener();
      }
    } catch (error) {
      console.error('[ORACLE] Error updating analysis:', error);
      const contentContainer = document.getElementById('oracle-analysis-content');
      if (contentContainer) {
         contentContainer.innerHTML = `<div class="oracle-error" style="padding: 20px; color: #EF4444;">Analysis Error: ${error.message}</div>`;
      }
    }
    
    // Update Chat History separately if needed (only if messages changed)
    updateChatHistory();
  }
  
  function updateChatHistory() {
     const historyContainer = document.getElementById('oracle-chat-history');
     if (!historyContainer) return;
     
     // Only update if child count differs to avoid scrolling during typing, 
     // or just append new ones. For simplicity, we'll re-render history only.
     
     // Note: This is simpler than diffing.
     historyContainer.innerHTML = (state.chatHistory || []).map(msg => `
        <div class="oracle-chat-msg ${msg.role}">
          <div class="oracle-chat-content">${msg.content}</div>
        </div>
      `).join('');
      
     // Scroll to bottom
     historyContainer.scrollTop = historyContainer.scrollHeight;
  }

  // Show no market state
  function showNoMarket() {
    console.log('[ORACLE] Showing no market state');
    const contentContainer = document.getElementById('oracle-analysis-content');
    if (contentContainer) {
      // Add debug info to the UI so the user can see why it failed
      const url = window.location.href;
      const isMarketUrl = url.includes('/markets/') || url.includes('/event/');
      
      contentContainer.innerHTML = `
        <div class="oracle-no-market">
          <div class="oracle-no-market-icon">📊</div>
          <div>Navigate to a Kalshi market to analyze</div>
          <div style="font-size: 10px; color: #666; margin-top: 10px; text-align: left;">
            Debug: ${isMarketUrl ? 'Market URL detected but data extraction failed.' : 'Not a market URL.'}
          </div>
        </div>
      `;
    }
  }

  // Observe for DOM changes (SPA updates)
  function observeMarketChanges() {
    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver((mutations) => {
      // Ignore mutations coming from our own panel to prevent infinite loops
      const shouldIgnore = mutations.every(mutation => {
        return mutation.target.closest && mutation.target.closest('#oracle-panel');
      });

      if (shouldIgnore) return;

      // Debounce updates
      clearTimeout(state.updateTimeout);
      state.updateTimeout = setTimeout(() => {
        detectMarket();
      }, 1000);
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_SETTINGS') {
      state.settings = message.settings;
      updateAnalysis();
      sendResponse({ success: true });
    }
    
    if (message.type === 'GET_MARKET_DATA') {
      sendResponse({ 
        market: state.currentMarket,
        probability: state.modelProbability
      });
    }

    if (message.type === 'SET_PROBABILITY') {
      state.modelProbability = message.probability;
      updateAnalysis();
      sendResponse({ success: true });
    }

    return true;
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
