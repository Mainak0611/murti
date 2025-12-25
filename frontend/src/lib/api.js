// frontend/src/lib/api.js

import axios from "axios";

// 1️⃣ Decide backend URL (Vercel → Render)
// Support both VITE_API_BASE_URL and VITE_API_URL for compatibility.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:10000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000, // 30s
});

// 2️⃣ Attach JWT token automatically on every request
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("userToken");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
    }

    return config;
  },
  (error) => Promise.reject(error)
);


function extractPath(url) {
  if (!url) return "";
  try {
    // if absolute URL, new URL() works
    const parsed = new URL(url, API_BASE_URL);
    return parsed.pathname;
  } catch (e) {
    return url;
  }
}


api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      const publicEndpoints = [
        "/api/users/login",
        "/api/users/register",
        "/api/users/forgot-password",
        "/api/users/reset-password",
      ];

      const requestUrl = error.config?.url || "";
      const path = extractPath(requestUrl);

      const isPublicEndpoint = publicEndpoints.some((endpoint) => path.includes(endpoint));

      if (!isPublicEndpoint) {
        console.warn("Session expired. Logging out…", {
          url: requestUrl,
          path: path,
          method: error.config?.method,
          message: error.response?.data?.message
        });

        try {
          localStorage.removeItem("userToken");
          localStorage.removeItem("userId");
          localStorage.removeItem("userName");
        } catch (e) {
          /* ignore */
        }

        // navigate to login route (client-side)
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
