import axios from 'axios';

const portalClient = axios.create({
  baseURL: '',
});

portalClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('portal_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

portalClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('portal_token');
      localStorage.removeItem('portal_user');
      if (window.location.pathname.startsWith('/d')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default portalClient;
