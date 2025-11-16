// frontend/src/lib/api.js

import axios from "axios";

// 1️⃣ Decide backend URL (Vercel → Render)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:10000";

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 2️⃣ Attach JWT token automatically on every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("userToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 3️⃣ Global 401 handler (except auth endpoints)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const publicEndpoints = [
        "/api/users/login",
        "/api/users/register",
        "/api/users/forgot-password",
        "/api/users/reset-password",
      ];

      const requestUrl = error.config?.url || "";
      const isPublicEndpoint = publicEndpoints.some((endpoint) =>
        requestUrl.includes(endpoint)
      );

      if (!isPublicEndpoint) {
        console.warn("Session expired. Logging out…");

        localStorage.removeItem("userToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");

        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export { API_BASE_URL };
export default api;
