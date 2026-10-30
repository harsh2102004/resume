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

        {/* Clean, Professional Footer */}
        <footer className="border-t border-white/5 bg-slate-950/60 backdrop-blur-md py-8 mt-12 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="font-extrabold text-sm text-white tracking-tight">PulseCast</span>
              </Link>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Next-generation video streaming & real-time watch rooms</span>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-400">
              <Link to="/" className="hover:text-white transition-colors">Explore</Link>
              <Link to="/upload" className="hover:text-white transition-colors">Upload</Link>
              <Link to="/watch-party" className="hover:text-white transition-colors">Watch Party</Link>
              <span className="text-slate-500">© 2026 PulseCast, Inc.</span>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
