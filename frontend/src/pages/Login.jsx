import React from 'react';

const Login = () => {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-[#1a1a1a] p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Log in to your account</h2>
        <form className="flex flex-col space-y-4">
          <input type="email" placeholder="Email" className="p-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 border border-transparent" />
          <input type="password" placeholder="Password" className="p-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 border border-transparent" />
          <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold transition-colors">Log In</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
