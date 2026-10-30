import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Upload from "./pages/Upload";
import WatchParty from "./pages/WatchParty";
import Login from "./pages/Login";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:videoId" element={<Watch />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/watch-party" element={<WatchParty />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>

        {/* Global Engineering Footer */}
        <footer className="border-t border-white/5 bg-slate-950/80 backdrop-blur-md py-8 mt-12 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                P
              </div>
              <div>
                <span className="font-bold text-slate-200">PulseCast Media Engine</span>
                <span className="text-slate-500 ml-2">Distributed Video Streaming Pipeline</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">HLS RFC 8216</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">HTTP 206 Range</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">TUS v1.0 Resumable</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">WebSocket Sync</span>
            </div>

            <p className="text-slate-500">
              Engineered by <span className="text-slate-300 font-medium">Harsh Pratap Singh</span>
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
