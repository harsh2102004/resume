import React, { useState } from "react";
import { Link } from "react-router-dom";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Access Engine Console</h2>
          <p className="text-xs text-slate-400">
            Authenticate to manage ingest tokens and access private HLS streams.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@pulsecast.dev"
              required
              className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <button
            type="submit"
            className="glow-btn w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            Authenticate Session
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400">
          <span>Demo Account: </span>
          <span className="font-mono text-indigo-300 font-semibold">demo@pulsecast.dev / demo123</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
