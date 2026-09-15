export const environment = {
  production: true,
  apiUrl: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:5057'
    : 'https://prestaflow-api.onrender.com'
};
