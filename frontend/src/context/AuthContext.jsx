import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("pulsecast_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("pulsecast_token") || "";
  });

  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem("pulsecast_refresh_token") || "";
  });

  const [loading, setLoading] = useState(false);

  const logout = useCallback(async () => {
    try {
      const activeToken = localStorage.getItem("pulsecast_token");
      if (activeToken) {
        await fetch(`${API_BASE_URL}/api/v1/users/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      }
    } catch {
      // ignore
    } finally {
      setUser(null);
      setToken("");
      setRefreshToken("");
      localStorage.removeItem("pulsecast_user");
      localStorage.removeItem("pulsecast_token");
      localStorage.removeItem("pulsecast_refresh_token");
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    const activeRefreshToken =
      refreshToken || localStorage.getItem("pulsecast_refresh_token");
    if (!activeRefreshToken) {
      await logout();
      return null;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: activeRefreshToken }),
      });
      const json = await res.json();
      if (res.ok && json.data?.accessToken) {
        const newAccess = json.data.accessToken;
        const newRefresh = json.data.refreshToken || activeRefreshToken;
        setToken(newAccess);
        setRefreshToken(newRefresh);
        localStorage.setItem("pulsecast_token", newAccess);
        localStorage.setItem("pulsecast_refresh_token", newRefresh);
        return newAccess;
      }
      await logout();
      return null;
    } catch {
      await logout();
      return null;
    }
  }, [refreshToken, logout]);

  // Validate session on mount whenever token exists
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const validateSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/users/current-user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.data && isMounted) {
          setUser(json.data);
          localStorage.setItem("pulsecast_user", JSON.stringify(json.data));
        } else if (res.status === 401 && isMounted) {
          // Token may have expired; attempt silent refresh
          const newToken = await refreshTokens();
          if (newToken && isMounted) {
            const retryRes = await fetch(`${API_BASE_URL}/api/v1/users/current-user`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            const retryJson = await retryRes.json();
            if (retryRes.ok && retryJson.data) {
              setUser(retryJson.data);
              localStorage.setItem("pulsecast_user", JSON.stringify(retryJson.data));
              return;
            }
          }
          if (isMounted) logout();
        }
      } catch {
        // network error / offline: keep cached user
      }
    };

    validateSession();
    return () => {
      isMounted = false;
    };
  }, [token, refreshTokens, logout]);

  // Authenticated fetch wrapper with automatic JWT refresh on 401
  const authFetch = useCallback(
    async (url, options = {}) => {
      let activeToken = token || localStorage.getItem("pulsecast_token");
      const headers = {
        ...(options.headers || {}),
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      };

      let res = await fetch(url, { ...options, headers });

      if (res.status === 401) {
        const newToken = await refreshTokens();
        if (newToken) {
          const retryHeaders = {
            ...(options.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          res = await fetch(url, { ...options, headers: retryHeaders });
        } else {
          await logout();
        }
      }

      return res;
    },
    [token, refreshTokens, logout]
  );

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
      const newRefreshToken = json.data?.refreshToken;

      setUser(userData);
      setToken(accessToken);
      if (newRefreshToken) setRefreshToken(newRefreshToken);

      localStorage.setItem("pulsecast_user", JSON.stringify(userData));
      localStorage.setItem("pulsecast_token", accessToken);
      if (newRefreshToken) {
        localStorage.setItem("pulsecast_refresh_token", newRefreshToken);
      }

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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        loading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
        refreshTokens,
        authFetch,
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
