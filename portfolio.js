// Curated public portfolio — used by Smart Reply to share relevant past work links
// Each entry: { url, desc, kw: [lowercase keywords/phrases that trigger this repo] }
(function () {
  "use strict";

  const PORTFOLIO = [
    // ── IBKR / Interactive Brokers ─────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/ninabot",
      desc: "IBKR Algorithmic Trading Bot — EMA, RSI, MACD, Bollinger Bands, FastAPI + React dashboard, 6 trading modes",
      kw: ["ibkr","interactive brokers","tws","ib gateway","ib_insync","fastapi trading","react trading dashboard","ninabot","ema","rsi","macd","bollinger"] },
    { url: "https://github.com/NadirAliOfficial/ibkr-execution-engine",
      desc: "Modular IBKR execution engine with bracket orders, risk sizing, Flask UI",
      kw: ["ibkr","interactive brokers","execution engine","bracket order","flask","order management","risk sizing"] },
    { url: "https://github.com/NadirAliOfficial/tv-ibkr-v3",
      desc: "Production-hardened TradingView → Interactive Brokers execution bridge with institutional-grade safety",
      kw: ["tradingview ibkr","tv ibkr","tv-ibkr","ibkr bridge","tradingview bridge","tradingview webhook ibkr"] },
    { url: "https://github.com/NadirAliOfficial/ibkr-copytrade-engine",
      desc: "Trade replication engine for IBKR — master → multiple follower accounts, position sizing, risk controls",
      kw: ["ibkr copytrade","copy trading","trade replication","follower accounts","master account"] },
    { url: "https://github.com/NadirAliOfficial/stock-scanner-bot",
      desc: "Daily post-market technical analysis scanner — IBKR-powered, scores 100+ US stocks, CSV/Excel reports",
      kw: ["stock scanner","market scanner","technical analysis scanner","ibkr scanner","post-market"] },
    { url: "https://github.com/NadirAliOfficial/ibkr-risk-bot",
      desc: "Python bot that manages TP, SL, and trailing stop orders for manual IBKR positions via IB Gateway",
      kw: ["trailing stop","take profit","stop loss","risk bot","tp sl","ib gateway"] },
    { url: "https://github.com/NadirAliOfficial/ibkr_news_bot",
      desc: "Real-time IBKR trading bot with Benzinga news integration, Aho-Corasick keyword matching, SQLite",
      kw: ["benzinga","news bot","news trading","aho-corasick","headline"] },
    { url: "https://github.com/NadirAliOfficial/unusual-whales-to-ibkr-bot",
      desc: "Options flow alerts from Unusual Whales API → filtered → automated IBKR trades",
      kw: ["unusual whales","options flow","options alerts","whale alerts"] },
    { url: "https://github.com/NadirAliOfficial/tradingview-ibkr-auto-bridge",
      desc: "24/7 TradingView → IBKR bridge, multi-strategy, VPS-ready, fail-safe execution",
      kw: ["tradingview ibkr","vps trading","tradingview auto","24/7 bot"] },
    { url: "https://github.com/NadirAliOfficial/ibkr-longonly-strategy",
      desc: "Long-only IBKR strategy with indicator entries, TP/SL, backtesting framework + live execution",
      kw: ["long only","long-only","backtest","backtesting"] },
    { url: "https://github.com/NadirAliOfficial/ibkr-ai-trading-bot",
      desc: "IBKR + ib_insync live trading bot with optional OpenAI integration for advanced signals",
      kw: ["openai trading","ai trading","gpt trading","ai signals"] },
    { url: "https://github.com/NadirAliOfficial/optipulse-ibkr-discord-engine",
      desc: "IBKR-powered options chain scanner, multi-timeframe decision engine, Discord alerts",
      kw: ["options chain","options scanner","discord alerts","multi-timeframe"] },

    // ── MT4 / MT5 / Forex Expert Advisors ───────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/STAR-EA-v11.20",
      desc: "ICT-based MT5 Expert Advisor — Order Blocks, FVG, OTE, Liquidity, CRT, Judas Swing, Silver Bullet, AMD",
      kw: ["ict","order block","fvg","ote","liquidity","judas swing","silver bullet","smart money","mt5 ea","xauusd","gold trading"] },
    { url: "https://github.com/NadirAliOfficial/conservative-scalper-ea",
      desc: "MT4 conservative scalping EA for major FX pairs — no martingale, no grid, capital preservation",
      kw: ["mt4","mql4","scalping ea","conservative","no martingale","forex ea"] },
    { url: "https://github.com/NadirAliOfficial/eurusd-scalper-ea",
      desc: "EURUSD M5 scalper EA — EMA cross + RSI + ADX + H1 trend filter, auto lot sizing",
      kw: ["eurusd","scalper","m5 scalper","adx","trend filter","auto lot"] },
    { url: "https://github.com/NadirAliOfficial/monsterfx-reliable-trader",
      desc: "MT5 Expert Advisor + Discord bot for automated Forex signals with Gold VIP channel",
      kw: ["discord bot","forex signals","signal bot","vip channel"] },
    { url: "https://github.com/NadirAliOfficial/-MT5-LSTM-Trading-Bot-GBPUSD-",
      desc: "MT5 + LSTM neural network trading bot for GBPUSD — engulfing patterns, volume, pivots, trailing SL",
      kw: ["lstm","neural network","gbpusd","engulfing","deep learning"] },

    // ── TradingView Bridges ─────────────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/tradingview-capitalcom-bot",
      desc: "Webhook bridge: TradingView strategy alerts → auto-execute on Capital.com demo/live",
      kw: ["capital.com","capitalcom","tradingview webhook","webhook bridge"] },

    // ── QuantConnect / Backtesting ──────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/QuantConnnect",
      desc: "QuantConnect algorithmic strategies — straddle options, triangular arbitrage, crypto strategies, backtesting",
      kw: ["quantconnect","quant connect","lean","straddle","triangular arbitrage"] },
    { url: "https://github.com/NadirAliOfficial/kaizen-intraday-semis-backtest",
      desc: "Intraday backtest for SMH/SOXX with progressive entry, VIX-scaled leverage, end-of-day flat rules",
      kw: ["backtest","intraday backtest","vix","semis","smh","soxx"] },
    { url: "https://github.com/NadirAliOfficial/mt5-dash",
      desc: "Streamlit dashboard for analyzing MT4/MT5 backtest & forward trading data",
      kw: ["streamlit","mt5 dashboard","backtest analysis","trading dashboard"] },

    // ── Solana / Crypto / Web3 ──────────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/solana-dashboard",
      desc: "Real-time Solana token dashboard — top 20 by volume, live prices, one-click Jupiter buy",
      kw: ["solana dashboard","solana tokens","jupiter","dexscreener"] },
    { url: "https://github.com/NadirAliOfficial/solana-wallet-generator",
      desc: "Python script to generate Solana keypairs (public + secret)",
      kw: ["solana wallet","keypair","wallet generator"] },
    { url: "https://github.com/NadirAliOfficial/x-sniper-bot",
      desc: "Telegram crypto sniper — monitors X/Twitter posts, extracts contract addresses, auto-buys",
      kw: ["sniper bot","twitter sniper","contract sniper","telegram sniper"] },
    { url: "https://github.com/NadirAliOfficial/flash-loan-arbitrage-bot",
      desc: "Aave flash loan arbitrage smart contract (Solidity + Hardhat) — DEX price diff scanner",
      kw: ["flash loan","arbitrage","aave","solidity","hardhat","dex arbitrage"] },
    { url: "https://github.com/NadirAliOfficial/teller-solana-dapp",
      desc: "Solana wallet analytics & chain stats dApp for Solana Mobile dApp Store",
      kw: ["solana dapp","wallet analytics","solana mobile"] },
    { url: "https://github.com/NadirAliOfficial/ankr-token-swapper",
      desc: "Python token utility via Ankr RPC — check balances, buy/sell via Uniswap/PancakeSwap",
      kw: ["ankr","uniswap","pancakeswap","token swap"] },
    { url: "https://github.com/NadirAliOfficial/tron-usdt-wallet",
      desc: "Tron wallet + Shasta testnet USDT transactions (Tronpy)",
      kw: ["tron","tronpy","usdt","shasta"] },
    { url: "https://github.com/NadirAliOfficial/ethereum-usdt-wallet",
      desc: "Python tool to generate Ethereum wallet for USDT (ERC-20)",
      kw: ["ethereum wallet","erc-20","erc20","eth wallet"] },
    { url: "https://github.com/NadirAliOfficial/Presale-Program",
      desc: "Solana private sale program — Rust + Anchor",
      kw: ["presale","private sale","anchor","rust solana"] },

    // ── Chrome Extensions ──────────────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/text-enhancer",
      desc: "AI text improvement Chrome extension (Improve, Rewrite, Smart Reply, Translate) using Groq/Ollama",
      kw: ["chrome extension","text enhancer","ai writing","smart reply","browser extension"] },
    { url: "https://github.com/NadirAliOfficial/linkedin-ai-commenter",
      desc: "AI-powered LinkedIn comment assistant",
      kw: ["linkedin","linkedin comment","linkedin ai"] },
    { url: "https://github.com/NadirAliOfficial/Summarixer-Extension",
      desc: "Chrome extension to summarize web content with one click",
      kw: ["summarizer","summarize","web summary"] },

    // ── Android / Flutter / Mobile ─────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/NAK-Assist",
      desc: "AI Android assistant — Fiverr auto-reply, improve, summarize, translate (Kotlin)",
      kw: ["android app","kotlin","fiverr assistant","android ai"] },
    { url: "https://github.com/NadirAliOfficial/NAK-Quiz-AI",
      desc: "AI quiz assistant for Android (Kotlin + Llama)",
      kw: ["quiz app","android quiz","llama android"] },
    { url: "https://github.com/NadirAliOfficial/teamnak-app",
      desc: "TeamNAK Flutter mobile app",
      kw: ["flutter","flutter app","mobile app","dart"] },

    // ── Machine Learning / Data Science ────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/PodcastTimePredictor-AI",
      desc: "ML tool predicting podcast episode duration from title, description, transcript",
      kw: ["podcast","duration prediction","ml prediction"] },
    { url: "https://github.com/NadirAliOfficial/Stock-Price-Prediction",
      desc: "Stock price prediction (Jupyter)",
      kw: ["stock prediction","price prediction","jupyter"] },
    { url: "https://github.com/NadirAliOfficial/Stock-Market-Data-Analysis-Dashboard",
      desc: "Stock market data analysis dashboard",
      kw: ["stock dashboard","market analysis"] },
    { url: "https://github.com/NadirAliOfficial/Pakistan-Tourism",
      desc: "Pakistan Tourism data analysis (Jupyter)",
      kw: ["tourism","data analysis pakistan"] },

    // ── Telegram Bots ───────────────────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/telegram-weather-bot",
      desc: "Telegram bot that fetches real-time weather via OpenWeather",
      kw: ["weather bot","openweather","telegram weather"] },
    { url: "https://github.com/NadirAliOfficial/Josh-Bot-",
      desc: "Telegram → MT5 signal execution bot",
      kw: ["telegram mt5","signal execution","telegram to mt5"] },
    { url: "https://github.com/NadirAliOfficial/TWS-Telegram-Bot",
      desc: "Telegram bot connected to IBKR TWS",
      kw: ["tws telegram","telegram ibkr","tws bot"] },

    // ── Misc / Utilities ────────────────────────────────────────────────────
    { url: "https://github.com/NadirAliOfficial/badvf-tick-fetcher",
      desc: "Tick-by-tick market data fetcher — Polygon.io + IBKR TWS, CSV export, desktop app",
      kw: ["polygon.io","tick data","market data","csv export"] },
    { url: "https://github.com/NadirAliOfficial/ibgw-lean-runner",
      desc: "Windows service connecting LEAN to IB Gateway, pulls filtered option chains",
      kw: ["lean","ib gateway lean","option chain runner"] },
    { url: "https://github.com/NadirAliOfficial/Nasdaq-Stock-Screener",
      desc: "Tkinter GUI Nasdaq screener — 47 custom conditions on IBKR OHLC data",
      kw: ["nasdaq screener","tkinter","stock screener"] },
    { url: "https://github.com/NadirAliOfficial/contrarian-trading-strategy",
      desc: "Python contrarian trading backtest — yfinance, profit/drawdown/Sharpe",
      kw: ["contrarian","yfinance","sharpe ratio","drawdown"] },
  ];

  function normalize(s) { return (s || "").toLowerCase().replace(/[^\w\s.+\-]/g, " ").replace(/\s+/g, " ").trim(); }

  // Score each entry by how many of its keywords appear in the text; return top N matches
  window.TE_PORTFOLIO_MATCH = function matchPortfolio(text, maxResults = 3) {
    const t = normalize(text);
    if (!t || t.length < 6) return [];
    const scored = [];
    for (const entry of PORTFOLIO) {
      let score = 0;
      for (const k of entry.kw) {
        if (t.includes(k.toLowerCase())) score += (k.length > 6 ? 2 : 1);
      }
      if (score > 0) scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.entry);
  };
})();
