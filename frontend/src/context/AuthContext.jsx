import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("pulsecast_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("pulsecast_token") || "";
  });

  const [loading, setLoading] = useState(false);

  // Validate or fetch current user on mount if token exists
  useEffect(() => {
    if (token && !user) {
      const fetchCurrent = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/users/current-user`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.data) {
            setUser(json.data);
            localStorage.setItem("pulsecast_user", JSON.stringify(json.data));
          } else {
            logout();
          }
        } catch (e) {
          // offline or server error
        }
      };
      fetchCurrent();
    }
  }, [token]);

  const login = async (usernameOrEmail, password) => {
    setLoading(true);
    try {
      const isEmail = usernameOrEmail.includes("@");
      const body = isEmail
        ? { email: usernameOrEmail, password }
        : { username: usernameOrEmail, password };

      const res = await fetch(`${API_BASE_URL}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Invalid credentials. Please try again.");
      }

      const userData = json.data?.user;
      const accessToken = json.data?.accessToken;

      setUser(userData);
      setToken(accessToken);

      localStorage.setItem("pulsecast_user", JSON.stringify(userData));
      localStorage.setItem("pulsecast_token", accessToken);

      return { success: true, user: userData };
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ fullName, username, email, password }) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Registration failed. Please check your details.");
      }

      // Automatically log in after registration
      return await login(username, password);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/v1/users/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      setToken("");
      localStorage.removeItem("pulsecast_user");
      localStorage.removeItem("pulsecast_token");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
