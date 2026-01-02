import axios from 'axios';

// Use relative paths - nginx in the frontend pod proxies /api to api-gateway:3000
// This works for both K8s ingress and port-forward scenarios
export const API_URL = '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  register: (userData) => api.post('/api/auth/register', userData),
  validate: () => api.get('/api/auth/validate'),
};

export const productsAPI = {
  getAll: (params) => api.get('/api/products', { params }),
  getById: (id) => api.get(`/api/products/${id}`),
  getByCategory: (category) => api.get(`/api/products/category/${category}`),
};

export const ordersAPI = {
  create: (orderData) => api.post('/api/orders', orderData),
  getMyOrders: () => api.get('/api/orders/my-orders'),
  getById: (id) => api.get(`/api/orders/${id}`),
  updateOrderStatus: (id, statusData) => api.patch(`/api/orders/${id}/status`, statusData),
  processPayment: (id, paymentData) => api.post(`/api/orders/${id}/pay`, paymentData),
};

export default api;
