// frontend/src/lib/api.js

import axios from 'axios';

// 1. Create an Axios instance with a base URL
const api = axios.create({
  // This is the URL of your backend server
  baseURL: 'http://localhost:10000', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🛑 2. ADD A REQUEST INTERCEPTOR TO ATTACH THE JWT TOKEN 🛑
api.interceptors.request.use(
  (config) => {
    // Get the user token from local storage
    const token = localStorage.getItem('userToken');

    // If the token exists, add it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

// 3. Add a response interceptor to handle 401 errors globally (but NOT on login/auth pages)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // If the server returns a 401 Unauthorized error (token expired/invalid)
        if (error.response && error.response.status === 401) {
            // Check if the request was to a public auth endpoint (login, register, forgot-password)
            const publicEndpoints = ['/api/users/login', '/api/users/register', '/api/users/forgot-password', '/api/users/reset-password'];
            const requestUrl = error.config?.url || '';
            
            const isPublicEndpoint = publicEndpoints.some(endpoint => requestUrl.includes(endpoint));
            
            // Only redirect and clear credentials if it's NOT a public endpoint
            // (i.e., user is trying to access protected routes with expired/invalid token)
            if (!isPublicEndpoint) {
                console.warn("Session expired or token is invalid. Clearing credentials and redirecting to login.");
                
                // Clear credentials and force a logout/redirect to login
                localStorage.removeItem('userToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('userName');
                
                // Redirect to login page with a full page refresh
                window.location.href = '/login'; 
            }
        }
        return Promise.reject(error);
    }
);


// 4. Export the configured instance
export default api;