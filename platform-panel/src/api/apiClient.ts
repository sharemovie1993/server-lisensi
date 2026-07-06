import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // relative to the current host
});

apiClient.interceptors.request.use(
  (config) => {
    const adminSecret = localStorage.getItem('x-admin-secret');
    if (adminSecret) {
      config.headers['x-admin-secret'] = adminSecret;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // If unauthorized, clear the token and force login state
      localStorage.removeItem('x-admin-secret');
      // We can also trigger page reload to login screen
      if (!window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin'; // Redirect back to central control page
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
