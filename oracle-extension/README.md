# ORACLE - Political Prediction Edge Engine

> *"See the outcome before the market does."*

Chrome extension for calculating edge and optimal position sizing on Kalshi political prediction markets.

## Features

- **Real-time Edge Calculation** - Compare your probability estimate against market prices
- **Kelly Criterion Sizing** - Optimal position sizing with configurable fractional Kelly
- **BUY/SELL/PASS Recommendations** - Clear actionable signals based on edge thresholds
- **Position Tracking** - Track open positions and P&L
- **Risk Controls** - Configurable max position size, daily loss limits, and edge thresholds

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `oracle-extension` folder
6. The ORACLE icon should appear in your extensions bar

### Pin the Extension

1. Click the puzzle piece icon in Chrome toolbar
2. Find ORACLE and click the pin icon

## Usage

### On Kalshi Pages

1. Navigate to any political market on [Kalshi](https://kalshi.com)
2. The ORACLE panel will appear in the top-right corner
3. Use the slider to set your probability estimate
4. View the edge calculation, Kelly size, and recommendation
5. Panel shows:
   - Current market YES/NO prices
   - Your probability input
   - Edge percentage
   - Recommended position size (Kelly-optimal)
   - Expected value
   - BUY YES / BUY NO / PASS recommendation

### Popup Panel

Click the ORACLE icon in your toolbar to:
- View/edit your bankroll
- Adjust settings (Kelly fraction, min edge, max position)
- See open positions
- Track performance metrics
- Export/import data

### Settings

Access full settings via the gear icon or right-click > Options:

| Setting | Description | Recommended |
|---------|-------------|-------------|
| Bankroll | Total trading capital | Your actual amount |
| Kelly Fraction | % of full Kelly to use | 25% (quarter Kelly) |
| Min Edge | Minimum edge to trade | 5% |
| Max Position | Max per-trade risk | 5% of bankroll |
| Max Daily Loss | Stop-loss threshold | 15% of bankroll |

## How It Works

### Edge Calculation

```
Edge = Your Probability - Market Implied Probability

Example:
- You estimate Trump wins at 55%
- Market YES price is $0.42 (implies 42%)
- Edge = 55% - 42% = +13%
- Positive edge → BUY YES
```

### Kelly Criterion

```
Kelly Fraction = (bp - q) / b

Where:
- b = odds (payout ratio)
- p = your probability of winning
- q = 1 - p (probability of losing)

We recommend using 25% of full Kelly to reduce volatility.
```

### Position Sizing

```
Position = Bankroll × Kelly Fraction × 0.25

Example:
- Bankroll: $5,000
- Full Kelly: 10%
- Fractional Kelly (25%): 2.5%
- Position Size: $125
```

## File Structure

```
oracle-extension/
├── manifest.json           # Extension configuration
├── popup/
│   ├── popup.html         # Popup interface
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── content/
│   ├── content.js         # Injected into Kalshi pages
│   └── content.css        # Overlay styles
├── background/
│   └── service-worker.js  # Background tasks
├── lib/
│   ├── kelly.js           # Kelly calculations
│   ├── edge.js            # Edge detection
│   └── storage.js         # Storage wrapper
├── options/
│   ├── options.html       # Settings page
│   ├── options.css
│   └── options.js
└── assets/
    └── icon-*.png         # Extension icons
```

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Purple | `#7C3AED` | Actions, highlights |
| Deep Purple | `#5B21B6` | Headers |
| Light Purple | `#A78BFA` | Secondary elements |
| White | `#FFFFFF` | Backgrounds |
| Charcoal | `#1F1F23` | Dark backgrounds |
| Green | `#10B981` | Profit / BUY YES |
| Red | `#EF4444` | Loss / BUY NO |

## Keyboard Shortcuts

- Panel is always visible on Kalshi market pages
- Use slider or type probability directly
- Click minimize (−) to collapse panel

## Data Storage

All data is stored locally in Chrome's storage:
- Settings persist across sessions
- Position data is stored locally
- Export feature for backup
- No data sent to external servers

## Troubleshooting

### Panel not appearing
1. Ensure you're on a Kalshi market page (not homepage)
2. Refresh the page
3. Check that the extension is enabled

### Prices not detected
- The extension scrapes prices from the page DOM
- If Kalshi updates their UI, detection may need updates
- You can manually reference prices shown on Kalshi

### Settings not saving
1. Check Chrome storage permissions
2. Try clearing extension data and reconfiguring

## Development

### Making Changes

1. Edit source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the ORACLE extension
4. Reload any Kalshi pages

### Building for Production

The extension is ready to use as-is. For distribution:
1. Remove any development files
2. Zip the `oracle-extension` folder
3. Upload to Chrome Web Store (requires developer account)

## Disclaimer

This tool is for informational purposes only. It does not constitute financial advice. Prediction market trading involves risk of loss. Past performance does not guarantee future results. Use at your own risk.

## License

MIT License - See LICENSE file

## Version History

- **1.0.0** - Initial release
  - Edge calculation
  - Kelly sizing
  - Position tracking
  - Settings management

---

Built for edge. Built for execution. Built for ORACLE.
