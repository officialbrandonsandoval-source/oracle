# ORACLE

**Political Prediction Edge Engine for Kalshi Markets**

> *"See the outcome before the market does."*

---

## Project Overview

ORACLE is a decision-support system that identifies edge in political prediction markets on Kalshi. It synthesizes polling data, fundamentals, and sentiment signals to calculate probabilities, compare them against market prices, and deliver actionable trade recommendations with proper position sizing.

**Core Value Proposition:** Transform raw political data into calculated betting decisions with edge quantification and Kelly-optimal sizing.

---

## Brand Identity

### Name: ORACLE
- References prediction/foresight
- Clean, memorable, professional
- Works as both product name and verb ("Let me ORACLE this market")

### Color System

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Purple** | `#7C3AED` | Primary actions, highlights, edge indicators |
| **Deep Purple** | `#5B21B6` | Headers, strong emphasis |
| **Light Purple** | `#A78BFA` | Secondary elements, hover states |
| **Pure White** | `#FFFFFF` | Backgrounds, text on dark |
| **Off White** | `#F5F3FF` | Card backgrounds, subtle contrast |
| **Charcoal** | `#1F1F23` | Primary text, dark mode background |
| **Dark Gray** | `#27272A` | Secondary backgrounds, borders |
| **Medium Gray** | `#71717A` | Secondary text, disabled states |

### Typography
- **Headers:** Inter Bold / SF Pro Display Bold
- **Body:** Inter Regular / SF Pro Text
- **Monospace (data):** JetBrains Mono / SF Mono

### Visual Language
- Clean, data-forward aesthetic
- Minimal chrome, maximum information density
- Purple accents for actionable elements
- Green/Red only for profit/loss indicators

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORACLE SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   CHROME    │    │    API      │    │  WEBHOOK    │         │
│  │  EXTENSION  │◄──►│   BACKEND   │───►│   ALERTS    │         │
│  │    (UI)     │    │   (Brain)   │    │  (Notify)   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         │                  ▼                  │                 │
│         │          ┌─────────────┐            │                 │
│         │          │  POSTGRES   │            │                 │
│         │          │  DATABASE   │            │                 │
│         │          └─────────────┘            │                 │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                   DATA SOURCES                              │
│  ├─────────────────────────────────────────────────────────────┤
│  │  • Kalshi API (prices, order books, positions)              │
│  │  • Polling Aggregators (538, RCP, state polls)              │
│  │  • Economic Data (FRED, BLS)                                │
│  │  • Sentiment (Google Trends, social signals)                │
│  │  • News APIs (event detection)                              │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### Component 1: Chrome Extension (Phase 1 - MVP)

**Purpose:** Overlay on Kalshi UI providing real-time edge calculations and trade recommendations.

#### Features
1. **Market Detection** - Automatically detects when user is viewing a political market on Kalshi
2. **Price Extraction** - Scrapes current YES/NO prices from page
3. **Manual Probability Input** - User inputs their probability estimate
4. **Edge Calculation** - Model probability vs market implied probability
5. **Kelly Sizing** - Calculates optimal position size based on edge and bankroll
6. **Recommendation Display** - BUY/SELL/PASS with confidence level
7. **Portfolio Tracker** - Tracks open positions and P&L

#### File Structure
```
oracle-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── popup/
│   ├── popup.html          # Main popup interface
│   ├── popup.css           # Styles (purple/white/black theme)
│   └── popup.js            # Popup logic and state management
├── content/
│   ├── content.js          # Injected into Kalshi pages
│   └── content.css         # Overlay styles
├── background/
│   └── service-worker.js   # Background tasks, API calls
├── lib/
│   ├── kelly.js            # Kelly criterion calculations
│   ├── edge.js             # Edge detection logic
│   ├── storage.js          # Chrome storage wrapper
│   └── kalshi-api.js       # Kalshi API client (optional)
├── assets/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── options/
    ├── options.html        # Settings page
    ├── options.css
    └── options.js
```

#### Key Calculations

**Edge Calculation:**
```javascript
// Edge = Your probability - Market implied probability
// Market implied = Price of YES contract (e.g., $0.65 = 65%)
const edge = modelProbability - marketProbability;
const edgePercent = edge * 100;
// Positive edge = market underpricing, BUY YES
// Negative edge = market overpricing, BUY NO (or sell YES)
```

**Kelly Criterion:**
```javascript
// f* = (bp - q) / b
// Where:
//   f* = fraction of bankroll to bet
//   b = odds (payout ratio) = (1 - price) / price for YES bet
//   p = probability of winning (your model)
//   q = probability of losing (1 - p)

function kellyFraction(modelProb, marketPrice, side = 'YES') {
  const p = side === 'YES' ? modelProb : (1 - modelProb);
  const price = side === 'YES' ? marketPrice : (1 - marketPrice);
  const b = (1 - price) / price; // Payout odds
  const q = 1 - p;
  
  const kelly = (b * p - q) / b;
  return Math.max(0, kelly); // Never negative (don't bet)
}

// Apply fractional Kelly (recommended: 0.25)
const fractionKelly = 0.25;
const betFraction = kellyFraction(modelProb, marketPrice) * fractionKelly;
const betAmount = bankroll * betFraction;
```

**Expected Value:**
```javascript
// EV = (P(win) × Profit) - (P(lose) × Loss)
function expectedValue(modelProb, marketPrice, betAmount, side = 'YES') {
  const p = side === 'YES' ? modelProb : (1 - modelProb);
  const price = side === 'YES' ? marketPrice : (1 - marketPrice);
  
  const profitIfWin = betAmount * ((1 - price) / price);
  const lossIfLose = betAmount;
  
  return (p * profitIfWin) - ((1 - p) * lossIfLose);
}
```

#### UI Components

**Main Overlay Panel (injected on Kalshi market pages):**
```
┌──────────────────────────────────────┐
│  🟣 ORACLE                     [−]  │
├──────────────────────────────────────┤
│  Market: Trump wins 2028             │
│  Current Price: YES $0.42 | NO $0.58 │
├──────────────────────────────────────┤
│  YOUR PROBABILITY                    │
│  ┌────────────────────────────────┐  │
│  │  [========●=====] 55%          │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ANALYSIS                            │
│  ────────────────────────────────    │
│  Edge:        +13.0%  ██████████     │
│  Confidence:  HIGH                   │
│  Kelly Size:  $127.40 (2.5%)         │
│  Expected EV: +$16.56                │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │      🟢 BUY YES @ $0.42        │  │
│  └────────────────────────────────┘  │
│  Recommended: 127 contracts          │
└──────────────────────────────────────┘
```

**Popup Panel (click extension icon):**
```
┌──────────────────────────────────────┐
│  🟣 ORACLE              ⚙️  │
├──────────────────────────────────────┤
│  BANKROLL                            │
│  $5,000.00                    [Edit] │
├──────────────────────────────────────┤
│  SETTINGS                            │
│  Kelly Fraction:  [0.25 ▼]           │
│  Min Edge:        [5%   ▼]           │
│  Max Position:    [5%   ▼]           │
├──────────────────────────────────────┤
│  OPEN POSITIONS              3 total │
│  ────────────────────────────────    │
│  Trump 2028 YES    +$47.20   +12.3%  │
│  Fed Rate Cut NO   -$12.50    -8.1%  │
│  Senate GOP YES    +$22.00    +5.5%  │
├──────────────────────────────────────┤
│  TOTAL P&L         +$56.70   +1.1%   │
└──────────────────────────────────────┘
```

#### Data Storage (Chrome Storage)

```javascript
// Storage schema
const storageSchema = {
  // User settings
  settings: {
    bankroll: 5000,
    kellyFraction: 0.25,
    minEdgeThreshold: 0.05,
    maxPositionPercent: 0.05,
    maxDailyLossPercent: 0.15,
    theme: 'dark' // 'dark' | 'light'
  },
  
  // Position tracking
  positions: [
    {
      id: 'uuid',
      marketId: 'kalshi-market-id',
      marketTitle: 'Trump wins 2028',
      side: 'YES',
      entryPrice: 0.42,
      contracts: 127,
      costBasis: 53.34,
      entryDate: '2025-01-05T12:00:00Z',
      modelProbAtEntry: 0.55,
      currentPrice: null, // Updated live
      currentValue: null,
      unrealizedPL: null
    }
  ],
  
  // Trade history
  trades: [
    {
      id: 'uuid',
      marketId: 'kalshi-market-id',
      marketTitle: 'Fed Rate Cut March',
      side: 'NO',
      action: 'BUY', // BUY | SELL
      price: 0.62,
      contracts: 50,
      totalCost: 31.00,
      modelProbAtTrade: 0.35,
      marketProbAtTrade: 0.38,
      edgeAtTrade: -0.03,
      timestamp: '2025-01-04T15:30:00Z',
      resolved: true,
      outcome: 'WIN',
      payout: 50.00,
      profit: 19.00
    }
  ],
  
  // Performance metrics
  performance: {
    totalTrades: 47,
    winRate: 0.617,
    avgEdge: 0.082,
    totalPL: 1247.50,
    roiPercent: 24.95,
    sharpeRatio: 1.8,
    maxDrawdown: 0.12,
    brierScore: 0.21
  }
};
```

---

### Component 2: API Backend (Phase 2)

**Purpose:** Central intelligence layer that ingests data, runs probability models, and serves recommendations.

#### Tech Stack
- **Runtime:** Node.js or Python (FastAPI)
- **Database:** PostgreSQL
- **Cache:** Redis
- **Queue:** Bull (Node) or Celery (Python)
- **Hosting:** Railway, Render, or AWS

#### Endpoints

```
BASE URL: https://api.oracle-edge.com/v1

Authentication
POST   /auth/login              # Get JWT token
POST   /auth/refresh            # Refresh token

Markets
GET    /markets                 # List active political markets
GET    /markets/:id             # Get market details + ORACLE analysis
GET    /markets/:id/history     # Price history

Analysis
POST   /analyze                 # Submit probability + get recommendation
GET    /recommendations         # Get all current recommendations
GET    /recommendations/alerts  # Markets with edge > threshold

Portfolio
GET    /portfolio               # Current positions
POST   /portfolio/positions     # Add position
PUT    /portfolio/positions/:id # Update position
DELETE /portfolio/positions/:id # Close position
GET    /portfolio/performance   # Performance metrics

Data
GET    /data/polls/:race        # Polling data for race
GET    /data/fundamentals       # Economic fundamentals
GET    /data/sentiment/:topic   # Sentiment indicators

Webhooks
POST   /webhooks/subscribe      # Subscribe to alerts
DELETE /webhooks/:id            # Unsubscribe
```

#### Data Models

```typescript
// Market
interface Market {
  id: string;
  kalshiId: string;
  title: string;
  category: 'ELECTION' | 'POLICY' | 'ECONOMIC' | 'APPROVAL';
  subcategory: string;
  closeDate: Date;
  resolutionDate: Date;
  currentYesPrice: number;
  currentNoPrice: number;
  volume24h: number;
  openInterest: number;
  lastUpdated: Date;
}

// Analysis
interface Analysis {
  marketId: string;
  modelProbability: number;
  confidenceInterval: [number, number];
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  marketProbability: number;
  edge: number;
  recommendation: 'BUY_YES' | 'BUY_NO' | 'PASS';
  kellyFraction: number;
  expectedValue: number;
  dataInputs: {
    polls: PollData[];
    fundamentals: FundamentalsData;
    sentiment: SentimentData;
  };
  timestamp: Date;
}

// Position
interface Position {
  id: string;
  userId: string;
  marketId: string;
  side: 'YES' | 'NO';
  contracts: number;
  entryPrice: number;
  costBasis: number;
  entryDate: Date;
  modelProbAtEntry: number;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  exitPrice?: number;
  exitDate?: Date;
  payout?: number;
  realizedPL?: number;
}
```

#### Probability Model (Political Elections)

```python
# Ensemble model combining multiple signals

class PoliticalModel:
    def __init__(self):
        self.poll_weight = 0.50      # Polling average
        self.fundamental_weight = 0.25  # Economic fundamentals
        self.sentiment_weight = 0.15    # Social/search sentiment
        self.historical_weight = 0.10   # Base rates
    
    def predict(self, race: Race) -> Prediction:
        # 1. Polling component
        poll_prob = self.aggregate_polls(race)
        poll_confidence = self.calculate_poll_confidence(race)
        
        # 2. Fundamentals component (Time for Change model variant)
        fundamental_prob = self.fundamentals_model(race)
        
        # 3. Sentiment component
        sentiment_prob = self.sentiment_analysis(race)
        
        # 4. Historical base rate
        historical_prob = self.historical_baseline(race)
        
        # Weighted ensemble
        raw_prob = (
            poll_prob * self.poll_weight +
            fundamental_prob * self.fundamental_weight +
            sentiment_prob * self.sentiment_weight +
            historical_prob * self.historical_weight
        )
        
        # Apply uncertainty adjustment based on time to election
        days_out = (race.election_date - datetime.now()).days
        uncertainty = self.time_uncertainty_factor(days_out)
        
        # Regress toward 50% based on uncertainty
        adjusted_prob = raw_prob * (1 - uncertainty) + 0.5 * uncertainty
        
        return Prediction(
            probability=adjusted_prob,
            confidence_interval=self.calculate_ci(adjusted_prob, uncertainty),
            confidence_level=self.categorize_confidence(uncertainty),
            components={
                'polls': poll_prob,
                'fundamentals': fundamental_prob,
                'sentiment': sentiment_prob,
                'historical': historical_prob
            }
        )
    
    def aggregate_polls(self, race: Race) -> float:
        """
        Weight polls by:
        - Recency (exponential decay)
        - Sample size
        - Pollster quality rating
        - Methodology (live caller > online panel > IVR)
        """
        # Implementation details...
        pass
    
    def fundamentals_model(self, race: Race) -> float:
        """
        Time for Change model factors:
        - GDP growth (Q2 election year)
        - Incumbent approval rating
        - Incumbent party tenure
        - Incumbency advantage
        """
        # Implementation details...
        pass
```

---

### Component 3: Webhook Alerts (Phase 3)

**Purpose:** Push notifications when edge opportunities appear.

#### Alert Types

```javascript
const alertTypes = {
  EDGE_DETECTED: {
    trigger: 'edge > minEdgeThreshold',
    template: '🟣 EDGE ALERT: {market} showing {edge}% edge. {side} @ ${price}',
    channels: ['push', 'email', 'slack']
  },
  
  PRICE_MOVEMENT: {
    trigger: 'priceChange > 5% in 1h',
    template: '📊 {market} moved {direction} {change}% to ${price}',
    channels: ['push']
  },
  
  POSITION_UPDATE: {
    trigger: 'openPosition && priceChange > 3%',
    template: '💰 Position Update: {market} now {pnl} ({pnlPercent}%)',
    channels: ['push']
  },
  
  RESOLUTION: {
    trigger: 'marketResolved',
    template: '✅ RESOLVED: {market} = {outcome}. P&L: {pnl}',
    channels: ['push', 'email']
  },
  
  RISK_ALERT: {
    trigger: 'dailyLoss > maxDailyLoss || positionSize > maxPosition',
    template: '⚠️ RISK: {alertType}. Current: {current}, Limit: {limit}',
    channels: ['push', 'email', 'slack']
  }
};
```

#### Integration Options
- **Push Notifications:** Web push API + service worker
- **Slack:** Incoming webhook to channel
- **Discord:** Bot webhook
- **Email:** SendGrid/Resend
- **SMS:** Twilio (high-priority only)

---

## Build Phases

### Phase 1: Chrome Extension MVP (Week 1-2)

**Goal:** Working extension that calculates edge and Kelly sizing on any Kalshi political market.

**Deliverables:**
- [ ] Extension manifest and structure
- [ ] Content script that detects Kalshi market pages
- [ ] Price scraper for YES/NO prices
- [ ] Popup with bankroll input and settings
- [ ] Manual probability slider input
- [ ] Edge calculation display
- [ ] Kelly sizing calculation
- [ ] BUY/SELL/PASS recommendation
- [ ] Basic position tracking (local storage)
- [ ] Purple/white/black theme implemented

**Success Criteria:**
- Can open any Kalshi political market and get a recommendation
- Calculations match manual verification
- UI is clean and usable

### Phase 2: Data Integration (Week 3-4)

**Goal:** Connect to real data sources for automated probability estimates.

**Deliverables:**
- [ ] Polling data ingestion (538, RCP)
- [ ] Basic probability model
- [ ] Auto-populate model probability for supported races
- [ ] Price history tracking
- [ ] Performance metrics calculation
- [ ] Export trade history

**Success Criteria:**
- Model probabilities update automatically
- Can track and review historical accuracy

### Phase 3: API Backend (Week 5-8)

**Goal:** Central server for data processing and multi-device sync.

**Deliverables:**
- [ ] API server deployed
- [ ] Database schema implemented
- [ ] Kalshi API integration
- [ ] Polling aggregator integration
- [ ] User authentication
- [ ] Portfolio sync across devices
- [ ] Webhook infrastructure

**Success Criteria:**
- Extension connects to backend
- Data persists across devices
- Webhooks fire correctly

### Phase 4: Advanced Features (Week 9-12)

**Goal:** Sophisticated modeling and automation.

**Deliverables:**
- [ ] Advanced ensemble model
- [ ] Sentiment analysis integration
- [ ] Correlation tracking (avoid clustered bets)
- [ ] Auto-trade capability (optional)
- [ ] Backtesting framework
- [ ] Performance dashboard

**Success Criteria:**
- Model outperforms naive polling average
- System is paper-trading profitably

---

## Risk Controls

### Position Limits
```javascript
const riskLimits = {
  maxPositionPercent: 0.05,      // No single position > 5% of bankroll
  maxDailyLossPercent: 0.15,     // Stop trading if down 15% in a day
  maxOpenPositions: 20,          // Diversification floor
  maxCorrelatedExposure: 0.25,   // No more than 25% in correlated outcomes
  minEdgeToTrade: 0.05,          // Don't trade < 5% edge
  maxKellyMultiple: 0.25,        // Never more than quarter Kelly
};
```

### Correlation Matrix (Political)
```
Events that move together (high correlation):
- Presidential + Senate (same party)
- Swing state outcomes (PA, MI, WI)
- Approval rating + reelection probability

Events that hedge each other (negative correlation):
- Candidate A wins + Candidate B wins (same race)
- Policy X passes + Opposition party wins
```

---

## Data Source APIs

### Kalshi API
```
Docs: https://trading-api.readme.kalshi.com
Auth: API Key + Private Key
Rate Limits: Tiered by account level
Endpoints:
  GET /exchange/markets - List markets
  GET /exchange/markets/{ticker} - Market details
  POST /exchange/orders - Place order
  GET /portfolio/positions - Current positions
```

### Polling Data
```
538 / Silver Bulletin:
  - No official API
  - Scrape from https://projects.fivethirtyeight.com/polls/
  - Or use GitHub data dumps

RealClearPolitics:
  - No official API  
  - Scrape average tables

The Economist:
  - GitHub data available
  - https://github.com/TheEconomist/
```

### Economic Data
```
FRED (Federal Reserve):
  API: https://fred.stlouisfed.org/docs/api/
  Key series: GDP, UNRATE, CPIAUCSL, FEDFUNDS
  
BLS (Bureau of Labor Statistics):
  API: https://www.bls.gov/developers/
```

### Sentiment
```
Google Trends:
  Library: pytrends (Python)
  
Twitter/X:
  API v2 with Academic Research access
  
Reddit:
  PRAW library for r/politics, r/conservative, etc.
```

---

## Performance Metrics

### Track These

```javascript
const metrics = {
  // Accuracy
  brierScore: 'Mean squared error of probability forecasts',
  calibration: 'Are 70% predictions right 70% of the time?',
  resolution: 'How much do predictions deviate from base rate?',
  
  // Profitability  
  roi: 'Total P&L / Total capital deployed',
  sharpeRatio: 'Risk-adjusted returns',
  maxDrawdown: 'Worst peak-to-trough decline',
  winRate: 'Percent of trades that profit',
  avgWin: 'Average profit on winning trades',
  avgLoss: 'Average loss on losing trades',
  profitFactor: 'Gross profits / Gross losses',
  
  // Edge Quality
  avgEdge: 'Average edge on trades taken',
  edgeRealized: 'Did actual edge match predicted edge?',
  kellyEfficiency: 'How close to optimal Kelly sizing?'
};
```

### Benchmarks
- **Brier Score:** < 0.25 is good, < 0.20 is excellent
- **Calibration:** Predictions should match reality within 5%
- **ROI:** Target 20%+ annualized
- **Sharpe:** > 1.5 is strong for event trading
- **Win Rate:** 55%+ at reasonable edge thresholds

---

## Security Considerations

### Extension
- No API keys stored in code
- Use Chrome's secure storage API
- Content Security Policy configured
- No external script injection

### Backend  
- JWT authentication with refresh tokens
- Rate limiting on all endpoints
- Input validation and sanitization
- Encrypted database connections
- Audit logging for all trades

### API Keys
- Kalshi keys: Store in environment variables
- Never commit to version control
- Rotate quarterly

---

## Future Roadmap

### v1.0 - MVP
- Chrome extension with manual probability input
- Basic edge and Kelly calculations
- Local position tracking

### v1.5 - Data Integration
- Auto-populated polling probabilities
- Price alerts
- Performance tracking

### v2.0 - Full Platform
- API backend
- Multi-device sync
- Advanced modeling
- Webhook alerts

### v3.0 - Automation
- Auto-trading capability
- Portfolio rebalancing
- Multi-market arbitrage detection
- Institutional-grade reporting

---

## Development Commands

```bash
# Extension development
cd oracle-extension
npm install
npm run dev          # Build with watch mode
npm run build        # Production build
npm run lint         # ESLint check

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select oracle-extension/dist folder

# Backend development
cd oracle-api
npm install
npm run dev          # Start dev server
npm run test         # Run tests
npm run migrate      # Run DB migrations

# Deploy
npm run build
npm run deploy       # Deploy to Railway/Render
```

---

## Contact & Resources

- **Kalshi API Docs:** https://trading-api.readme.kalshi.com
- **Kalshi Demo Environment:** For testing without real money
- **Chrome Extension Docs:** https://developer.chrome.com/docs/extensions/mv3/

---

*Built for edge. Built for execution. Built for ORACLE.*
