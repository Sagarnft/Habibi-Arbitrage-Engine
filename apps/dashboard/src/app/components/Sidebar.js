"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = Sidebar;
const react_1 = __importDefault(require("react"));
function Sidebar({ sections, onItemClick, activeLabel, profileName, profileAvatarDataUrl }) {
    const iconMap = {
        Dashboard: "📊",
        Opportunities: "🎯",
        Scanner: "🔍",
        Tokens: "🪙",
        Routes: "🛣️",
        Executions: "⚡",
        Chains: "⛓️",
        "RPC Health": "❤️",
        Blocks: "📦",
        Gas: "⛽",
        "DEX Overview": "🏪",
        Liquidity: "💧",
        Pools: "🌊",
        Quotes: "💬",
        Wallet: "👛",
        Transactions: "📋",
        "AI Engine": "🤖",
        Logs: "📝",
        Profile: "👤",
    };
    const normalizedName = profileName?.trim() || "Sagar Swami";
    const profileInitials = normalizedName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "SV";
    return (<aside className="flex h-full w-64 flex-col overflow-y-auto border-r border-slate-200/10 bg-gradient-to-b from-slate-950/92 via-slate-900/78 to-slate-950/92 p-4 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 text-sm font-bold text-slate-950 shadow-[0_0_18px_rgba(200,155,60,0.18)]">
          {profileAvatarDataUrl ? (<img src={profileAvatarDataUrl} alt="Profile logo" className="h-full w-full object-cover"/>) : (profileInitials)}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-slate-50">{normalizedName.toUpperCase()}</p>
          <p className="text-[10px] font-medium text-amber-300">AI Engine</p>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex-1 space-y-6">
        {sections.map((section, idx) => (<div key={idx}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item, itemIdx) => (<li key={itemIdx}>
                  <button onClick={() => onItemClick?.(item.label)} aria-current={activeLabel === item.label ? "page" : undefined} className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${activeLabel === item.label ? "border-amber-300/30 bg-amber-100/20 text-amber-100 shadow-[0_0_18px_rgba(200,155,60,0.12)]" : "border-transparent text-slate-300 hover:border-amber-300/20 hover:bg-white/5 hover:text-amber-200 active:bg-amber-300/10"}`}>
                    <span className="text-base">{iconMap[item.label] || "•"}</span>
                    <span>{item.label}</span>
                  </button>
                </li>))}
            </ul>
          </div>))}
      </nav>

      {/* Footer */}
      <div className="mt-6 border-t border-slate-200/10 bg-gradient-to-t from-slate-950/95 to-transparent p-4">
        <div className="space-y-2 text-[10px] text-slate-400">
          <p className="font-medium">Version 1.0.0</p>
          <p>Jai Shree Ram</p>
          <p className="text-slate-500">© 2026 Sagar Swami</p>
        </div>
      </div>
    </aside>);
}
