import React from "react";
import { Link, useLocation } from "react-router-dom";

export const Navbar = () => {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 sm:px-8 py-3.5 flex justify-between items-center transition-all duration-200">
      {/* Brand & Left Navigation */}
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                PulseCast
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                ABR Core
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium tracking-tight -mt-0.5 hidden sm:block">
              Distributed Streaming Engine
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link
            to="/"
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              isActive("/")
                ? "bg-white/10 text-white shadow-inner font-semibold"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Explore
          </Link>
          <Link
            to="/upload"
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              isActive("/upload")
                ? "bg-white/10 text-white shadow-inner font-semibold"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 font-mono">TUS</span>
          </Link>
          <Link
            to="/watch-party"
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              isActive("/watch-party")
                ? "bg-white/10 text-white shadow-inner font-semibold"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Watch Party
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Sync</span>
          </Link>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Engine status indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
          <span>HTTP 206 / HLS Ready</span>
        </div>

        <Link
          to="/upload"
          className="glow-btn px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-transform active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Publish Stream</span>
          <span className="sm:hidden">Upload</span>
        </Link>

        <Link
          to="/login"
          className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
