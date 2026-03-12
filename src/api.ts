import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('app_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 (session expired / logged in elsewhere)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail || '';
      if (detail.includes('Session expired') || detail.includes('logged in from another device')) {
        alert('You have been logged out because your account was accessed from another device.');
      }
      localStorage.removeItem('app_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
