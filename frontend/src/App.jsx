import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Upload from "./pages/Upload";
import WatchParty from "./pages/WatchParty";
import Login from "./pages/Login";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f0f0f] text-gray-100 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:videoId" element={<Watch />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/watch-party" element={<WatchParty />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
