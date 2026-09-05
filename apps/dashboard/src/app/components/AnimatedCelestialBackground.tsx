"use client";

import { useEffect, useMemo, useRef } from "react";

type UniverseBackgroundProps = {
  scannerCount?: number;
  isScanning?: boolean;
  hasOpportunity?: boolean;
  isTradeExecuting?: boolean;
  liveTokenPrices?: Record<string, number>;
  floatingWords?: string[];
};

const DEFAULT_FLOATING_WORDS = [
  "ARBITRAGE",
  "AI ENGINE",
  "BLOCKCHAIN",
  "CRYPTO",
  "DEX",
  "LIQUIDITY",
  "SMART ROUTE",
  "PRICE FLOW",
  "MARKET DATA",
  "ON-CHAIN",
  "CROSS-CHAIN",
  "REAL-TIME",
  "EXECUTION",
  "SCANNER",
  "OPPORTUNITY",
  "PROFIT",
  "SPREAD",
  "SLIPPAGE",
  "GAS",
  "MEMPOOL",
  "SWAP",
  "POOL",
  "QUOTE",
  "ROUTE",
  "TRADE",
  "TRANSACTION",
  "BLOCK",
  "VALIDATOR",
  "RPC",
  "NODE",
  "NETWORK",
  "TVL",
  "WBTC",
  "ETH",
  "BNB",
  "USDT",
  "USDC",
  "SOL",
  "ARB",
  "MATIC",
  "AVAX",
  "LINK",
  "WBTC $112,804",
  "ETH $3,421.82",
  "BNB $641.17",
  "USDT $1.0001",
  "PROFIT +$842.18",
  "SPREAD +0.42%",
  "GAS 1.8 GWEI",
  "LIQUIDITY $18.4M",
  "TVL $2.81B",
  "BLOCK 23,841,772",
  "RPC 42ms",
  "SLIPPAGE 0.10%",
  "QUOTE LIVE",
  "ROUTE FOUND",
  "OPPORTUNITY FOUND",
  "EXECUTION READY",
  "SCANNING...",
  "MARKET SCAN",
  "PRICE DETECTED",
  "PROFITABLE ROUTE",
  "LIQUIDITY FOUND",
  "TRADE SIGNAL",
  "DATA STREAM",
  "NETWORK ACTIVE",
  "UNISWAP → PANCAKESWAP",
  "PANCAKESWAP → SUSHISWAP",
  "ETH → USDT → ETH",
  "BNB → USDT → BNB",
  "DEX → DEX",
  "CHAIN → CHAIN",
  "SAGAR SWAMI",
  "AI ARBITRAGE ENGINE",
  "JAI SHREE RAM",
  "॥ जय श्री राम ॥",
];

const DEFAULT_TOKEN_PRICES: Record<string, number> = {
  WBTC: 112804,
  ETH: 3421.82,
  BNB: 641.17,
  USDT: 1.0001,
  USDC: 1,
  SOL: 182.21,
  ARB: 1.18,
  MATIC: 0.82,
  AVAX: 42.18,
  LINK: 18.4,
  OP: 2.34,
  UNI: 11.28,
  AAVE: 98.2,
  LTC: 76.2,
  BCH: 520.9,
  DOT: 7.91,
  ATOM: 9.14,
  FIL: 5.96,
  NEAR: 7.42,
  SUI: 1.38,
  APT: 8.75,
  SEI: 0.62,
  RNDR: 11.04,
  INJ: 31.4,
  FET: 1.02,
};

const TOKEN_SYMBOLS = new Set([
  "WBTC",
  "ETH",
  "BNB",
  "USDT",
  "USDC",
  "SOL",
  "ARB",
  "MATIC",
  "AVAX",
  "LINK",
  "OP",
  "UNI",
  "AAVE",
  "LTC",
  "BCH",
  "DOT",
  "ATOM",
  "FIL",
  "NEAR",
  "SUI",
  "APT",
  "SEI",
  "RNDR",
  "INJ",
  "FET",
]);
function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function formatLivePrice(symbol: string, price: number) {
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  }

  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }

  return `$${price.toFixed(8)}`;
}

export function AnimatedCelestialBackground({
  scannerCount = 5,
  isScanning = false,
  hasOpportunity = false,
  isTradeExecuting = false,
  liveTokenPrices = {},
  floatingWords = DEFAULT_FLOATING_WORDS,
}: UniverseBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wordsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ scannerCount, isScanning, hasOpportunity, isTradeExecuting });
  const interactionRef = useRef({ hoverX: 0.5, hoverY: 0.5, scroll: 0 });
  const marketHeatRef = useRef<Array<{ x: number; y: number; value: number; hue: string }>>([]);
  const floatingWordStateRef = useRef<Array<{
    label: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    phase: number;
    breathPhase: number;
    size: number;
    opacity: number;
    hue: string;
  }>>([]);
  const floatingItems = useMemo(() => {
    return floatingWords.map((word, index) => {
      const normalized = word.trim().toUpperCase();
      const fallbackPrice = DEFAULT_TOKEN_PRICES[normalized] ?? 0;
      const livePrice = liveTokenPrices[normalized] ?? fallbackPrice;
      const tokenPriceLabel = TOKEN_SYMBOLS.has(normalized) ? formatLivePrice(normalized, livePrice) : null;
      const label = tokenPriceLabel ? `${normalized} ${tokenPriceLabel}` : word;
      const seed = hashString(`${normalized}:${index}`);
      const left = 2 + (seed % 94);
      const top = 6 + ((seed >> 2) % 84);
      const duration = 14 + (seed % 11);
      const delay = -((seed >> 3) % duration);
      const size = normalized.length > 18 ? 11 : normalized.length > 10 ? 12 : 13;
      const opacity = 0.34 + ((seed >> 7) % 18) / 100;
      const hue = TOKEN_SYMBOLS.has(normalized)
        ? "rgba(134, 241, 255, 0.95)"
        : normalized.includes("$") || normalized.includes("%")
          ? "rgba(255, 215, 135, 0.92)"
          : "rgba(236, 244, 255, 0.84)";
      return { label, left, top, duration, delay, size, opacity, hue };
    });
  }, [floatingWords, liveTokenPrices]);

  useEffect(() => {
    stateRef.current = { scannerCount, isScanning, hasOpportunity, isTradeExecuting };
  }, [scannerCount, isScanning, hasOpportunity, isTradeExecuting]);

  useEffect(() => {
    floatingWordStateRef.current = floatingItems.map((item, index) => ({
      ...item,
      x: item.left,
      y: item.top,
      vx: ((index % 5) - 2) * 0.007,
      vy: (((index + 2) % 7) - 3) * 0.005,
      phase: hashString(`${item.label}:${index}`) % 628,
      breathPhase: (hashString(`${item.label}:breath:${index}`) % 628) / 100,
    }));
  }, [floatingItems]);

  useEffect(() => {
    const entries = Object.entries(liveTokenPrices).slice(0, 10);
    marketHeatRef.current = entries.map(([symbol, price], index) => {
      const seed = hashString(`${symbol}:${price}:${index}`);
      const normalizedPrice = Number.isFinite(price) && price > 0 ? price : 1;
      const x = 0.12 + ((seed % 720) / 1000) * 0.74;
      const y = 0.2 + (((seed >> 3) % 600) / 1000) * 0.62;
      const heat = Math.min(1, Math.max(0.18, Math.log10(Math.max(1, normalizedPrice)) / 4));
      const hue = index % 3 === 0 ? "rgba(120, 220, 255, 0.46)" : index % 3 === 1 ? "rgba(93, 255, 196, 0.42)" : "rgba(255, 195, 115, 0.4)";
      return { x, y, value: heat, hue };
    });
  }, [liveTokenPrices]);

  useEffect(() => {
    const updateHover = (event: MouseEvent) => {
      interactionRef.current.hoverX = event.clientX / Math.max(1, window.innerWidth);
      interactionRef.current.hoverY = event.clientY / Math.max(1, window.innerHeight);
      interactionRef.current.scroll = Math.min(1, Math.max(0, window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)));
    };

    const updateScroll = () => {
      interactionRef.current.scroll = Math.min(1, Math.max(0, window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)));
    };

    updateScroll();
    window.addEventListener("mousemove", updateHover);
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);

    return () => {
      window.removeEventListener("mousemove", updateHover);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    const TAU = Math.PI * 2;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const nodes: Array<{ x: number; y: number; z: number; driftX: number; driftY: number; pulse: number; size: number; square: boolean }> = [];
    const particles: Array<{ x: number; y: number; r: number; a: number; p: number; speed: number }> = [];
    const packets: Array<{ a: number; b: number; p: number; speed: number; green: boolean }> = [];
    const chartCandles: Array<{ open: number; high: number; low: number; close: number; width: number; kind: number; x: number }> = [];
    const statusDots = Array.from({ length: 12 }, (_, index) => ({
      x: 0.08 + (index % 6) * 0.16,
      y: 0.12 + Math.floor(index / 6) * 0.16,
      r: 3 + (index % 3),
      hue: index % 3 === 0 ? "#72f2c2" : index % 3 === 1 ? "#7ac9ff" : "#ffd27d",
      pulse: index * 0.7,
    }));
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nodeCount = Math.min(125, Math.floor((width * height) / 12000));
      nodes.length = 0;
      for (let i = 0; i < nodeCount; i += 1) {
        nodes.push({
          x: rand(-1, 1),
          y: rand(-1, 1),
          z: rand(0.15, 1),
          driftX: rand(-0.00013, 0.00013),
          driftY: rand(-0.00011, 0.00011),
          pulse: rand(0, TAU),
          size: rand(0.65, 2.0),
          square: Math.random() < 0.24,
        });
      }

      particles.length = 0;
      for (let i = 0; i < 260; i += 1) {
        particles.push({ x: rand(0, 1), y: rand(0, 1), r: rand(0.25, 1.6), a: rand(0.08, 0.4), p: rand(0, TAU), speed: rand(0.00004, 0.00018) });
      }

      packets.length = 0;
      for (let i = 0; i < 38; i += 1) {
        packets.push({ a: Math.floor(Math.random() * nodeCount), b: Math.floor(Math.random() * nodeCount), p: Math.random(), speed: rand(0.002, 0.007), green: Math.random() < 0.12 });
      }

      chartCandles.length = 0;
      const candleCount = Math.max(34, Math.min(48, Math.floor(width / 40)));
      const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
      const chartSeed = hashString(`candles:${Math.round(width)}:${Math.round(height)}`);
      let rngState = chartSeed || 1;
      const seededRandom = () => {
        rngState = (rngState * 1664525 + 1013904223) >>> 0;
        return rngState / 0x100000000;
      };
      const anchorPrice = 66000 + Math.sin(width * 0.0011) * 420;
      let trend = anchorPrice;
      let momentum = 0;
      let volatility = 18;
      for (let i = 0; i < candleCount; i += 1) {
        momentum = clampNumber(momentum * 0.82 + (seededRandom() - 0.5) * 0.9, -1.7, 1.7);
        const meanRevert = (anchorPrice - trend) * 0.035;
        const drift = momentum * volatility * 0.62 + Math.sin(i * 0.035) * 1.3;
        const impulse = (seededRandom() - 0.5) * volatility * 0.5;
        const shock = seededRandom() > 0.92 ? (seededRandom() - 0.5) * volatility * 2.2 : 0;
        const styleKind = hashString(`${chartSeed}:${i}`) % 8;
        const directionBias = styleKind === 0 ? 0.22 : styleKind === 1 ? 0.48 : styleKind === 2 ? -0.18 : styleKind === 3 ? -0.38 : styleKind === 4 ? 0.34 : styleKind === 5 ? -0.26 : styleKind === 6 ? 0.14 : -0.08;
        const open = trend;
        const close = open + meanRevert + drift + impulse + shock + directionBias * volatility * 0.34;
        const body = Math.abs(close - open);
        const wickBase = 5 + seededRandom() * 11;
        const high = Math.max(open, close) + wickBase + body * (close >= open ? 0.05 : 0.11);
        const low = Math.min(open, close) - wickBase - body * (close >= open ? 0.11 : 0.05);
        chartCandles.push({
          open,
          high,
          low,
          close,
          width: clampNumber(16 + body / 16, 16, 28),
          kind: styleKind,
          x: 0,
        });
        trend = close + meanRevert * 0.12 + (seededRandom() - 0.5) * 1.8;
        volatility = clampNumber(volatility * 0.98 + body * 0.02, 14, 28);
      }

      statusDots.length = 0;
      for (let i = 0; i < 12; i += 1) {
        statusDots.push({
          x: 0.08 + (i % 6) * 0.16,
          y: 0.12 + Math.floor(i / 6) * 0.16,
          r: 3 + (i % 3),
          hue: i % 3 === 0 ? "#72f2c2" : i % 3 === 1 ? "#7ac9ff" : "#ffd27d",
          pulse: i * 0.7,
        });
      }
    };

    const project = (node: { x: number; y: number; z: number }) => {
      const perspective = 0.64 + node.z * 0.52;
      return {
        x: width * 0.5 + node.x * (width * 0.52) / perspective,
        y: height * 0.5 + node.y * (height * 0.5) / perspective,
        s: 1 / perspective,
      };
    };

    const drawLine = (a: { x: number; y: number }, b: { x: number; y: number }, alpha: number, width: number, color: string) => {
      context.strokeStyle = color.startsWith("rgb(") ? color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`) : color;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    };

    const render = (t: number) => {
      context.fillStyle = "#030a10";
      context.fillRect(0, 0, width, height);

      const baseGlow = context.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        Math.min(width, height) * 1.08,
      );
      baseGlow.addColorStop(0, "rgba(12, 22, 38, 0.28)");
      baseGlow.addColorStop(0.22, "rgba(6, 10, 16, 0.48)");
      baseGlow.addColorStop(0.5, "rgba(3, 5, 8, 0.58)");
      baseGlow.addColorStop(1, "rgba(0, 0, 0, 0.96)");
      context.fillStyle = baseGlow;
      context.fillRect(0, 0, width, height);

      const champagneBeam = context.createRadialGradient(
        width * 0.62,
        height * 0.35,
        0,
        width * 0.62,
        height * 0.35,
        Math.min(width, height) * 0.46,
      );
      champagneBeam.addColorStop(0, "rgba(218, 171, 94, 0.05)");
      champagneBeam.addColorStop(0.38, "rgba(129, 158, 200, 0.03)");
      champagneBeam.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = champagneBeam;
      context.fillRect(0, 0, width, height);

      const sheen = context.createLinearGradient(0, 0, width, height);
      sheen.addColorStop(0, "rgba(255,255,255,0.004)");
      sheen.addColorStop(0.32, "rgba(132, 190, 255, 0.012)");
      sheen.addColorStop(0.58, "rgba(216, 180, 110, 0.015)");
      sheen.addColorStop(1, "rgba(255,255,255,0.004)");
      context.fillStyle = sheen;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = "rgba(140, 176, 207, 0.024)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 72) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 72) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.restore();

      const sweepA = context.createLinearGradient(0, 0, width, height);
      sweepA.addColorStop(0, "rgba(0,0,0,0)");
      sweepA.addColorStop(0.24, "rgba(104, 180, 255, 0.028)");
      sweepA.addColorStop(0.52, "rgba(216, 180, 110, 0.04)");
      sweepA.addColorStop(0.80, "rgba(104, 180, 255, 0.028)");
      sweepA.addColorStop(1, "rgba(0,0,0,0)");
      context.strokeStyle = sweepA;
      context.lineWidth = 1.1;
      context.beginPath();
      context.moveTo(width * 0.08, height * 0.80);
      context.bezierCurveTo(
        width * 0.32,
        height * 0.58,
        width * 0.56,
        height * 0.64,
        width * 0.96,
        height * 0.28,
      );
      context.stroke();

      const sweepB = context.createLinearGradient(width, 0, 0, height);
      sweepB.addColorStop(0, "rgba(0,0,0,0)");
      sweepB.addColorStop(0.28, "rgba(216, 180, 110, 0.025)");
      sweepB.addColorStop(0.5, "rgba(100, 200, 255, 0.035)");
      sweepB.addColorStop(0.72, "rgba(216, 180, 110, 0.025)");
      sweepB.addColorStop(1, "rgba(0,0,0,0)");
      context.strokeStyle = sweepB;
      context.lineWidth = 1.1;
      context.beginPath();
      context.moveTo(width * 0.08, height * 0.24);
      context.bezierCurveTo(
        width * 0.30,
        height * 0.54,
        width * 0.64,
        height * 0.42,
        width * 0.97,
        height * 0.70,
      );
      context.stroke();

      const finalGlow = context.createRadialGradient(
        width * 0.5,
        height * 0.5,
        30,
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.78,
      );
      finalGlow.addColorStop(0, "rgba(217, 178, 107, 0.045)");
      finalGlow.addColorStop(0.32, "rgba(88, 124, 204, 0.035)");
      finalGlow.addColorStop(0.70, "rgba(12, 18, 27, 0.03)");
      finalGlow.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = finalGlow;
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        particle.y -= particle.speed;
        if (particle.y < 0) {
          particle.y = 1;
        }
        const tw = 0.45 + 0.55 * Math.sin(t * 0.002 + particle.p);
        context.globalAlpha = particle.a * tw;
        context.fillStyle = "#8bb7c6";
        context.beginPath();
        context.arc(particle.x * width, particle.y * height, particle.r, 0, TAU);
        context.fill();
      }
      context.globalAlpha = 1;

      context.globalAlpha = 1;

      const interaction = interactionRef.current;
      for (const heat of marketHeatRef.current) {
        const x = width * heat.x;
        const y = height * heat.y;
        const heatPulse = 0.6 + 0.4 * Math.sin(t * 0.0016 + heat.x * 8 + heat.y * 5);
        const heatRadius = Math.min(width, height) * (0.06 + heat.value * 0.05 + heatPulse * 0.012);
        const heatGlow = context.createRadialGradient(x, y, 0, x, y, heatRadius);
        heatGlow.addColorStop(0, heat.hue);
        heatGlow.addColorStop(0.45, heat.hue.replace(/0\.[0-9]+\)$/, `${0.12 + heat.value * 0.08})`));
        heatGlow.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = heatGlow;
        context.globalAlpha = 0.28 + heat.value * 0.16 + heatPulse * 0.06;
        context.beginPath();
        context.arc(x, y, heatRadius, 0, TAU);
        context.fill();
        context.globalAlpha = 0.16 + heat.value * 0.08;
        context.strokeStyle = heat.hue;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(x, y, heatRadius * 0.62, 0, TAU);
        context.stroke();
      }
      context.globalAlpha = 1;

      const projected = nodes.map(project);
      const parallax = interactionRef.current;
      context.save();
      context.translate((parallax.hoverX - 0.5) * 20, (parallax.hoverY - 0.5) * 14 + parallax.scroll * 20);

      if (hasOpportunity) {
        const opportunityPulse = 0.36 + 0.24 * Math.sin(t * 0.0019);
        const opportunityGlow = context.createRadialGradient(width * 0.56, height * 0.42, 20, width * 0.56, height * 0.42, Math.min(width, height) * 0.42);
        opportunityGlow.addColorStop(0, `rgba(93, 255, 196, ${0.12 + opportunityPulse * 0.1})`);
        opportunityGlow.addColorStop(0.35, `rgba(93, 255, 196, ${0.05 + opportunityPulse * 0.04})`);
        opportunityGlow.addColorStop(1, "rgba(0,0,0,0)");
        context.globalAlpha = 1;
        context.fillStyle = opportunityGlow;
        context.fillRect(0, 0, width, height);
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const links: Array<[number, number]> = [];
        for (let j = 0; j < nodes.length; j += 1) {
          if (i === j) {
            continue;
          }
          const a = projected[i];
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < Math.min(width, height) * 0.17) {
            links.push([d, j]);
          }
        }
        links.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < Math.min(3, links.length); k += 1) {
          const j = links[k][1];
          const depth = (nodes[i].z + nodes[j].z) / 2;
          const alpha = 0.035 + 0.12 * depth;
          drawLine(projected[i], projected[j], alpha, 0.55, "rgb(45, 157, 211)");
        }
      }

      for (let i = 0; i < 18; i += 1) {
        const a = Math.floor((i * 17 + t * 0.002) % nodes.length);
        const b = (a + Math.floor(8 + Math.sin(i) * 12) + nodes.length) % nodes.length;
        drawLine(projected[a], projected[b], 0.08, 0.75, "rgb(54, 169, 224)");
      }

      nodes.forEach((node, index) => {
        node.x += node.driftX;
        node.y += node.driftY;
        if (node.x > 1.08) node.x = -1.08;
        if (node.x < -1.08) node.x = 1.08;
        if (node.y > 1.08) node.y = -1.08;
        if (node.y < -1.08) node.y = 1.08;

        const p = project(node);
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.003 + node.pulse);

        context.globalAlpha = 0.3 + 0.52 * pulse;
        context.fillStyle = "#8fe5ff";
        context.shadowBlur = 8;
        context.shadowColor = "rgba(61,193,241,.72)";

        if (node.square) {
          const size = (2.5 + 2.0 * pulse) * p.s;
          context.fillRect(p.x - size, p.y - size, size * 2, size * 2);
        } else {
          context.beginPath();
          context.arc(p.x, p.y, (1.1 + 0.9 * pulse) * p.s, 0, TAU);
          context.fill();
        }
        context.shadowBlur = 0;
      });
      context.globalAlpha = 1;

      const chartTop = height * 0.20;
      const chartBottom = height * 0.60;
      const chartHeight = chartBottom - chartTop;
      const chartLeft = width * 0.03;
      const chartWidth = width * 0.94;
      const chartStep = chartWidth / Math.max(1, chartCandles.length);
      const priceMin = Math.min(...chartCandles.map((candle) => candle.low));
      const priceMax = Math.max(...chartCandles.map((candle) => candle.high));
      const priceRange = Math.max(320, priceMax - priceMin);
      const chartPath: Array<{ x: number; y: number }> = [];
      const tradeMarkers: Array<{ x: number; y: number; bull: boolean; kind: "buy" | "sell" }> = [];
      const breakoutLabels: Array<{ x: number; y: number; text: string; color: string }> = [];
      const firstCandle = chartCandles[0];
      const lastCandle = chartCandles[chartCandles.length - 1];
      const chartDelta = firstCandle && lastCandle ? lastCandle.close - firstCandle.open : 0;
      const trendBias = chartDelta >= 0 ? 1 : -1;

      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = 1;
      const bandGlow = context.createLinearGradient(0, chartTop, 0, chartBottom);
      bandGlow.addColorStop(0, "rgba(8, 20, 30, 0)");
      bandGlow.addColorStop(0.16, "rgba(46, 98, 138, 0.08)");
      bandGlow.addColorStop(0.52, "rgba(52, 164, 154, 0.11)");
      bandGlow.addColorStop(0.80, "rgba(118, 220, 255, 0.06)");
      bandGlow.addColorStop(1, "rgba(2, 7, 12, 0.26)");
      context.fillStyle = bandGlow;
      context.fillRect(chartLeft, chartTop, chartWidth, chartHeight);

      const trendWash = context.createLinearGradient(chartLeft, chartTop, chartLeft, chartBottom);
      if (trendBias > 0) {
        trendWash.addColorStop(0, "rgba(58, 255, 179, 0)");
        trendWash.addColorStop(0.45, "rgba(58, 255, 179, 0.045)");
        trendWash.addColorStop(1, "rgba(58, 255, 179, 0.01)");
      } else {
        trendWash.addColorStop(0, "rgba(255, 99, 131, 0)");
        trendWash.addColorStop(0.45, "rgba(255, 99, 131, 0.045)");
        trendWash.addColorStop(1, "rgba(255, 99, 131, 0.01)");
      }
      context.fillStyle = trendWash;
      context.fillRect(chartLeft, chartTop, chartWidth, chartHeight);

      context.strokeStyle = "rgba(120, 220, 255, 0.12)";
      context.lineWidth = 1;
      for (let row = 0; row < 5; row += 1) {
        const y = chartTop + (chartHeight / 4) * row;
        context.beginPath();
        context.moveTo(chartLeft, y);
        context.lineTo(chartLeft + chartWidth, y);
        context.stroke();
      }
      for (let col = 0; col < Math.min(18, chartCandles.length); col += 1) {
        if (col % 3 !== 0) continue;
        const x = chartLeft + (col / Math.max(1, chartCandles.length)) * chartWidth;
        context.beginPath();
        context.moveTo(x, chartTop);
        context.lineTo(x, chartBottom);
        context.strokeStyle = "rgba(120, 220, 255, 0.035)";
        context.stroke();
      }
      context.restore();

      chartCandles.forEach((candle, index) => {
        const age = chartCandles.length > 1 ? index / (chartCandles.length - 1) : 1;
        const trailAlpha = 0.34 + age * 0.66;
        const x = chartLeft + index * chartStep + chartStep * 0.5;
        candle.x = x;
        const openY = chartBottom - ((candle.open - priceMin) / priceRange) * chartHeight;
        const closeY = chartBottom - ((candle.close - priceMin) / priceRange) * chartHeight;
        const highY = chartBottom - ((candle.high - priceMin) / priceRange) * chartHeight;
        const lowY = chartBottom - ((candle.low - priceMin) / priceRange) * chartHeight;
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);
        const bodyHeight = Math.max(8, Math.abs(closeY - openY));
        const styleKind = candle.kind ?? 0;
        const bodyWidth = Math.min(Math.max(20, candle.width * 2.0), chartStep * 0.72);
        const bodyMid = (bodyTop + bodyBottom) / 2;
        const bodyRatio = bodyHeight / Math.max(1, highY - lowY);
        const seed = hashString(`${index}:${candle.open.toFixed(2)}:${candle.close.toFixed(2)}`);
        const doji = styleKind === 0 || bodyRatio < 0.10;
        const marubozu = styleKind === 1;
        const hammer = styleKind === 2 || (styleKind === 4 && lowY < bodyMid - bodyHeight * 1.15);
        const shootingStar = styleKind === 3 || (styleKind === 5 && highY > bodyMid + bodyHeight * 1.15);
        const longWicks = styleKind === 6;
        const upperWick = doji
          ? Math.max(3, Math.min(8, bodyHeight * 0.24))
          : hammer
            ? Math.max(3, Math.min(9, bodyHeight * 0.18))
            : shootingStar
              ? Math.max(3, Math.min(8, bodyHeight * 0.16))
              : longWicks
                ? Math.max(6, Math.min(18, Math.abs(highY - bodyTop) * 0.42))
                : Math.max(3, Math.min(12, Math.abs(highY - bodyTop) * 0.12));
        const lowerWick = doji
          ? Math.max(3, Math.min(8, bodyHeight * 0.24))
          : hammer
            ? Math.max(6, Math.min(18, Math.abs(bodyBottom - lowY) * 0.42))
            : shootingStar
              ? Math.max(3, Math.min(8, bodyHeight * 0.16))
              : longWicks
                ? Math.max(6, Math.min(18, Math.abs(bodyBottom - lowY) * 0.42))
                : Math.max(3, Math.min(12, Math.abs(bodyBottom - lowY) * 0.12));
        const lift = Math.sin(t * 0.0009 + index * 0.09) * 2.2;
        const bull = candle.close >= candle.open;
        const wickColor = bull ? "rgba(130, 239, 193, 0.98)" : "rgba(255, 102, 132, 0.98)";
        const bodyColor = styleKind === 7
          ? bull ? "rgba(83, 249, 191, 0.95)" : "rgba(255, 108, 138, 0.94)"
          : styleKind === 6
            ? bull ? "rgba(96, 226, 255, 0.88)" : "rgba(255, 182, 106, 0.88)"
            : marubozu
              ? bull ? "rgba(70, 255, 186, 0.95)" : "rgba(255, 94, 130, 0.94)"
              : bull ? "rgba(38, 220, 150, 0.90)" : "rgba(218, 62, 88, 0.88)";
        const innerColor = styleKind === 7
          ? bull ? "rgba(170, 255, 226, 0.72)" : "rgba(255, 150, 175, 0.72)"
          : styleKind === 6
            ? bull ? "rgba(174, 240, 255, 0.62)" : "rgba(255, 220, 158, 0.62)"
            : bull ? "rgba(102, 240, 180, 0.88)" : "rgba(240, 96, 132, 0.86)";

        context.save();
        context.translate(0, lift);
        context.globalAlpha = trailAlpha;
        context.shadowBlur = 0;
        context.shadowColor = "rgba(0, 0, 0, 0)";

        context.strokeStyle = wickColor;
        context.lineWidth = 1.25;
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, Math.max(highY, bodyTop - upperWick));
        context.stroke();
        context.beginPath();
        context.moveTo(x, Math.min(lowY, bodyBottom + lowerWick));
        context.lineTo(x, lowY);
        context.stroke();

        context.fillStyle = bodyColor;
        context.fillRect(x - bodyWidth / 2 - 1, bodyTop, bodyWidth + 2, Math.max(7, bodyHeight));
        context.fillStyle = innerColor;
        context.fillRect(x - bodyWidth / 2 + 1, bodyTop + 1, Math.max(3, bodyWidth - 2), Math.max(4, Math.max(5, bodyHeight - 2)));

        if (doji) {
          context.fillStyle = bull ? "rgba(92, 255, 192, 0.94)" : "rgba(255, 118, 145, 0.94)";
          context.fillRect(x - bodyWidth * 0.34, bodyMid - 1, bodyWidth * 0.68, 2);
        } else if (marubozu) {
          context.fillStyle = bodyColor;
          context.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, Math.max(8, bodyHeight));
        } else if (hammer) {
          context.fillStyle = bull ? "rgba(120, 255, 201, 0.93)" : "rgba(255, 126, 153, 0.93)";
          context.fillRect(x - bodyWidth / 2 + 1, bodyBottom - Math.min(4, bodyHeight * 0.22), bodyWidth - 2, Math.max(4, bodyHeight * 0.4));
        } else if (shootingStar) {
          context.fillStyle = bull ? "rgba(120, 255, 201, 0.93)" : "rgba(255, 126, 153, 0.93)";
          context.fillRect(x - bodyWidth / 2 + 1, bodyTop, bodyWidth - 2, Math.max(4, bodyHeight * 0.4));
        } else if (styleKind === 7) {
          context.fillStyle = bodyColor;
          context.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, Math.max(8, bodyHeight));
          context.fillStyle = innerColor;
          context.fillRect(x - bodyWidth / 2 + 2, bodyTop + 2, Math.max(4, bodyWidth - 4), Math.max(4, bodyHeight - 4));
        } else if (styleKind === 6) {
          context.fillStyle = bodyColor;
          context.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, Math.max(8, bodyHeight));
          context.fillStyle = innerColor;
          context.fillRect(x - bodyWidth / 2 + 3, bodyTop + 2, Math.max(4, bodyWidth - 6), Math.max(4, bodyHeight - 4));
        }
        chartPath.push({ x, y: bodyMid });
        if (index % 4 === 0 || styleKind === 2 || styleKind === 3 || styleKind === 6) {
          tradeMarkers.push({
            x,
            y: bull ? bodyTop - upperWick * 0.5 : bodyBottom + lowerWick * 0.5,
            bull,
            kind: bull ? "buy" : "sell",
          });
        }
        if (index % 7 === 2 || styleKind === 4 || styleKind === 5) {
          const labelSeed = seed ^ styleKind ^ index;
          const labelText = labelSeed % 3 === 0 ? "BREAKOUT" : labelSeed % 3 === 1 ? "REVERSAL" : "LIQUIDITY GRAB";
          breakoutLabels.push({
            x,
            y: bull ? bodyTop - upperWick - 11 : bodyBottom + lowerWick + 11,
            text: labelText,
            color: bull ? "rgba(82, 255, 188, 0.92)" : "rgba(255, 122, 146, 0.92)",
          });
        }
        context.restore();
      });

      if (chartPath.length > 2) {
        context.save();
        const lineGradient = context.createLinearGradient(chartLeft, chartTop, chartLeft + chartWidth, chartTop);
        lineGradient.addColorStop(0, "rgba(120, 220, 255, 0.08)");
        lineGradient.addColorStop(0.5, trendBias > 0 ? "rgba(88, 255, 191, 0.18)" : "rgba(255, 102, 132, 0.18)");
        lineGradient.addColorStop(1, "rgba(120, 220, 255, 0.08)");
        context.beginPath();
        context.moveTo(chartPath[0].x, chartPath[0].y);
        for (let i = 1; i < chartPath.length; i += 1) {
          const prev = chartPath[i - 1];
          const curr = chartPath[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          context.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        const lastPoint = chartPath[chartPath.length - 1];
        context.lineTo(lastPoint.x, lastPoint.y);
        context.strokeStyle = lineGradient;
        context.lineWidth = 1.1;
        context.shadowBlur = 8;
        context.shadowColor = trendBias > 0 ? "rgba(88, 255, 191, 0.18)" : "rgba(255, 102, 132, 0.16)";
        context.stroke();
        context.restore();
      }

      tradeMarkers.forEach((marker, index) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.0013 + index * 0.7);
        const markerColor = marker.kind === "buy" ? "rgba(82, 255, 188, 0.92)" : "rgba(255, 116, 143, 0.92)";
        context.save();
        context.globalAlpha = 0.55 + pulse * 0.35;
        context.shadowBlur = 10 + pulse * 4;
        context.shadowColor = markerColor;
        context.fillStyle = markerColor;
        context.beginPath();
        context.arc(marker.x, marker.y, 2.5 + pulse * 0.8, 0, TAU);
        context.fill();
        context.beginPath();
        if (marker.kind === "buy") {
          context.moveTo(marker.x, marker.y - 5);
          context.lineTo(marker.x - 3.5, marker.y + 1.5);
          context.lineTo(marker.x + 3.5, marker.y + 1.5);
        } else {
          context.moveTo(marker.x, marker.y + 5);
          context.lineTo(marker.x - 3.5, marker.y - 1.5);
          context.lineTo(marker.x + 3.5, marker.y - 1.5);
        }
        context.closePath();
        context.fill();
        context.restore();
      });

      breakoutLabels.forEach((label, index) => {
        const wobble = 0.5 + 0.5 * Math.sin(t * 0.0009 + index * 1.2);
        context.save();
        context.globalAlpha = 0.36 + wobble * 0.38;
        context.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = label.color;
        context.shadowBlur = 8;
        context.shadowColor = label.color;
        context.fillText(label.text, label.x, label.y);
        context.restore();
      });

      statusDots.forEach((dot, index) => {
        const x = width * dot.x;
        const y = height * dot.y;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.001 + dot.pulse + index);
        context.beginPath();
        context.fillStyle = dot.hue;
        context.globalAlpha = 0.5 + pulse * 0.35;
        context.arc(x, y, dot.r + pulse * 2, 0, TAU);
        context.fill();
      });
      context.globalAlpha = 1;

      packets.forEach((packet) => {
        const a = projected[packet.a];
        const b = projected[packet.b];
        packet.p += packet.speed;
        if (packet.p > 1) {
          packet.p = 0;
          packet.a = Math.floor(Math.random() * nodes.length);
          packet.b = Math.floor(Math.random() * nodes.length);
        }
        const q = packet.p;
        const px = a.x + (b.x - a.x) * q;
        const py = a.y + (b.y - a.y) * q;
        const color = packet.green ? "#83e6ac" : "#75dcff";
        context.fillStyle = color;
        context.shadowBlur = 13;
        context.shadowColor = color;
        context.beginPath();
        context.arc(px, py, 1.5, 0, TAU);
        context.fill();
        context.shadowBlur = 0;
      });
      context.restore();

    };

    const tick = (timestamp: number) => {
      render(timestamp);
      animationFrame = window.requestAnimationFrame(tick);
    };

    resize();
    animationFrame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const canvas = wordsCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (floatingWordStateRef.current.length === 0) {
        floatingWordStateRef.current = floatingItems.map((item, index) => ({
          ...item,
          x: 2 + ((index * 9) % 92),
          y: 8 + ((index * 7) % 82),
          vx: ((index % 5) - 2) * 0.007,
          vy: (((index + 2) % 7) - 3) * 0.005,
          phase: hashString(`${item.label}:${index}`) % 628,
          breathPhase: (hashString(`${item.label}:breath:${index}`) % 628) / 100,
        }));
      }
    };

    const draw = (t: number) => {
      context.clearRect(0, 0, width, height);
      context.save();
      context.textBaseline = "middle";
      context.textAlign = "center";

      floatingWordStateRef.current.forEach((word, index) => {
        const x = (word.x / 100) * width;
        const y = (word.y / 100) * height;
        const phase = t * 0.00008 + word.phase * 0.01 + index * 0.23;
        const breath = 0.5 + 0.5 * Math.sin(t * 0.0011 + word.breathPhase);
        const interaction = interactionRef.current;
        const interactionBoost = 0.45 + interaction.scroll * 0.4;
        const fade = Math.max(0.24, 0.45 + Math.sin(phase) * 0.12 + Math.cos(phase * 0.7) * 0.04 + (breath - 0.5) * 0.16);
        const driftX = Math.sin(phase * 0.5 + interaction.hoverX * Math.PI) * 0.18 * interactionBoost;
        const driftY = Math.cos(phase * 0.42 + interaction.hoverY * Math.PI) * 0.12 * interactionBoost;
        const wanderX = Math.sin(phase * 0.18 + index + interaction.hoverX * 3) * 0.0022 * (0.8 + interactionBoost);
        const wanderY = Math.cos(phase * 0.17 + index * 0.5 + interaction.scroll * 4) * 0.0022 * (0.8 + interactionBoost);
        const scale = 0.94 + breath * 0.08 + interactionBoost * 0.02;

        context.globalAlpha = Math.min(0.78, word.opacity * fade + 0.05 + interactionBoost * 0.04);
        context.font = `700 ${Math.max(10, word.size * scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.fillStyle = word.hue;
        context.shadowBlur = 14 + interactionBoost * 6;
        context.shadowColor = TOKEN_SYMBOLS.has(word.label.split(" ")[0] ?? "")
          ? "rgba(96, 211, 255, 0.28)"
          : "rgba(255, 215, 135, 0.18)";
        context.fillText(word.label, x + driftX, y);

        word.vx = Math.max(-0.03, Math.min(0.03, word.vx + wanderX));
        word.vy = Math.max(-0.025, Math.min(0.025, word.vy + wanderY));
        word.x += word.vx;
        word.y += word.vy;

        if (word.x < -8) {
          word.x = 108;
        } else if (word.x > 108) {
          word.x = -8;
        }

        if (word.y < -8) {
          word.y = 108;
        } else if (word.y > 108) {
          word.y = -8;
        }
      });

      context.shadowBlur = 0;
      context.globalAlpha = 1;
      context.restore();
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [floatingItems]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full opacity-100" style={{ zIndex: 0 }} />
      <canvas ref={wordsCanvasRef} className="absolute inset-0 block h-full w-full opacity-100" style={{ zIndex: 2 }} />
      <style>{`
        @keyframes habibi-float-word {
          0% {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.98);
          }
          12% {
            opacity: 1;
          }
          78% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -28px, 0) scale(1.02);
          }
        }
        @keyframes habibi-breathe {
          0%, 100% {
            transform: translateZ(0) scale(1);
            box-shadow: 0 0 0 1px rgba(137, 255, 229, 0.08), 0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 18px rgba(93,255,196,0.06);
          }
          50% {
            transform: translateZ(0) scale(1.012);
            box-shadow: 0 0 0 1px rgba(137, 255, 229, 0.12), 0 18px 36px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 26px rgba(93,255,196,0.12);
          }
        }
        @keyframes habibi-breathe-text {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
        @keyframes route-packet {
          0% { transform: translateX(-30px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(30px); opacity: 0; }
        }
        @keyframes rpc-pulse {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(1.45); opacity: 1; }
        }
        @keyframes scanner-arc {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          left: "0",
          bottom: "0",
          width: "34vw",
          height: "32vh",
          pointerEvents: "none",
          zIndex: 3,
          background:
            "radial-gradient(circle at 18% 82%, rgba(22, 52, 70, 0.18), transparent 34%), linear-gradient(90deg, rgba(0,0,0,0.08), transparent 30%, transparent 100%)",
        }}
      />
    </div>
  );
}
