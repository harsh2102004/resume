import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-2xl font-bold text-white">VideoTube</Link>
      <div className="flex space-x-4">
        <Link to="/login" className="text-gray-300 hover:text-white font-medium transition-colors">Log In</Link>
        <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">Sign Up</Link>
      </div>
    </nav>
  );
};

export default Navbar;
