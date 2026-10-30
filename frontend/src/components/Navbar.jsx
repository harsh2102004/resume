import React from "react";
import { Link, useLocation } from "react-router-dom";

export const Navbar = () => {
  const location = useLocation();

  const navLinkClass = (path) =>
    location.pathname === path
      ? "text-orange-400 font-bold text-sm transition-colors"
      : "text-gray-300 hover:text-white font-medium text-sm transition-colors";

  return (
    <nav className="sticky top-0 z-50 bg-[#121212]/90 backdrop-blur-md border-b border-gray-800 px-6 py-3.5 flex justify-between items-center shadow-md">
      {/* Brand */}
      <div className="flex items-center gap-8">
        <Link
          to="/"
          className="text-2xl font-black bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 bg-clip-text text-transparent tracking-tight"
        >
          PulseCast
        </Link>

        {/* Navigation Items */}
        <div className="hidden sm:flex items-center space-x-6">
          <Link to="/" className={navLinkClass("/")}>
            Explore
          </Link>
          <Link to="/upload" className={navLinkClass("/upload")}>
            Upload (TUS)
          </Link>
          <Link to="/watch-party" className={navLinkClass("/watch-party")}>
            🍿 Watch Party
          </Link>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-4">
        <Link
          to="/upload"
          className="sm:hidden text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold px-3 py-1.5 rounded-lg"
        >
          Upload
        </Link>
        <Link
          to="/login"
          className="text-gray-300 hover:text-white font-medium text-sm transition-colors"
        >
          Log In
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
