# ALPHA·CAST | Polymarket Prediction Agent App

**ALPHA·CAST** is a full-stack, trading-desk style terminal dashboard that aggregates active Polymarket prediction contracts, merges them with real-time order book pricing, analyzes sentiment using Anthropic's Claude API with autonomous live web search, and enables direct interactive conversations with the prediction agent.

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Next.js 14+ (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Curated harmony colors, pulsing badges)
- **State Management:** SWR (with 24-hour client revalidation)
- **AI Core:** Anthropic Claude API (`claude-3-5-sonnet-20241022`)
- **Data Layer:** Polymarket Gamma API (discovery metadata) & Polymarket CLOB API (real-time order book)

---

## 📁 Repository Structure

```
PolyDict/
├── .env.local                         # Environment configuration (Anthropic API Key)
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, Google Fonts, and Tactile Grain texture overlay
│   │   ├── page.tsx                   # Main 3-panel dashboard client page
│   │   ├── globals.css                # Style overrides and custom scrollbar controls
│   │   └── api/
│   │       ├── markets/
│   │       │   └── route.ts           # Server-side proxy for Dual-API Polymarket data (Cached 24h)
│   │       ├── markets/
│   │       │   └── refresh/
│   │       │       └── route.ts       # Manual cache-bust handler
│   │       ├── analyze/
│   │       │   └── route.ts           # Claude Sonnet analyzer with integrated web search
│   │       └── chat/
│   │           └── route.ts           # Context-aware chat route under 120 words
│   ├── components/
│   │   ├── MarketScanner.tsx          # Panel 1: Left sidebar (Categories, keyword filter, scrolling list)
│   │   ├── CategoryTabs.tsx           # Category selection horizontally scrollable pills
│   │   ├── MarketItem.tsx             # Individual market card (Volume, dynamic countdown severity)
│   │   ├── PredictionCard.tsx         # Panel 2: Center prediction sheet (Verdict, reasoning, signals)
│   │   ├── ConfidenceBar.tsx          # Dual-bar forecast vs odds comparison graph
│   │   ├── SignalRow.tsx              # Bullet signal card with directional arrows
│   │   └── ChatPanel.tsx              # Panel 3: Right sidebar chat and question chips
│   └── utils/
│       ├── polymarket.ts              # Fetch/merge algorithms (Uses HTTP/1.1 strictly)
│       ├── search.ts                  # DuckDuckGo HTML web search scraper
│       └── helpers.ts                 # Currency abbreviation and countdown math
```

---

## 🚀 Setup & Installation

### 1. Clone & Install Dependencies
First, ensure you are using Node.js v18+. Install the required dependencies:
```bash
npm install
```

### 2. Configure Environment variables
Create a `.env.local` file in the root directory (a template has already been created for you):
```env
# Your Anthropic API Key (required for real-time Claude Sonnet analyses)
# If left blank, ALPHA·CAST runs in high-fidelity sandbox simulation mode automatically.
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 3. Run Development Server
Boot the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the terminal.

---

## 🔒 Polymarket CORS Limitations & Proxy Architecture

### The CORS Problem
Polymarket's public API endpoints (`gamma-api.polymarket.com` and `clob.polymarket.com`) reject direct client-side fetch requests initiated by web browsers due to strict Cross-Origin Resource Sharing (CORS) security restrictions. 

### ALPHA·CAST Solution
To bypass CORS seamlessly, **ALPHA·CAST uses server-side proxy route handlers** `/api/markets` and `/api/markets/refresh`. Since server-to-server HTTP requests bypass CORS entirely, the browser only speaks to your local Next.js server, which in turn queries Polymarket safely.

### 🌐 Cloudflare Worker Proxy Pattern (For standalone clients)
If you need to deploy a standalone client application (e.g. on IPFS, static hosting) without a Next.js server backend, you should route requests through a custom Cloudflare Worker proxy. 

Below is the recommended Cloudflare Worker script template to deploy as a proxy:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Set up standard CORS response headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  // Handle pre-flight options request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Determine target API endpoint
  let targetUrl = ''
  if (url.pathname.startsWith('/gamma')) {
    targetUrl = 'https://gamma-api.polymarket.com' + url.pathname.replace('/gamma', '') + url.search
  } else if (url.pathname.startsWith('/clob')) {
    targetUrl = 'https://clob.polymarket.com' + url.pathname.replace('/clob', '') + url.search
  } else {
    return new Response(JSON.stringify({ error: 'Invalid Proxy Path' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    })

    const responseData = await response.text()
    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy Request Failed', details: err.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
```

---

## ⚡ Caching Strategy

- **Server-Side Cache:** `/api/markets` fetches are cached in Next.js for 24 hours (`revalidate = 86400`) to guarantee high-performance responses and protect against rate-limiting.
- **Client-Side Polling:** SWR queries the proxy route with a 24-hour polling interval (`refreshInterval: 86400000`), allowing the interface to stay current dynamically.
- **Local Storage Cache:** Deep analytical calculations are cached in the browser's `localStorage` keyed by `alphacast_analysis_${marketId}` with a 24-hour TTL. Re-visiting a previously queried market displays details instantly, with a `Re-Analyze` button available to force-reload.
- **Manual Cache Busting:** Clicking the Manual Refresh icon makes a POST to `/api/markets/refresh`, purging Next.js cached segments, force-loading fresh markets, and purging browser local storage of analyses older than 24 hours.
