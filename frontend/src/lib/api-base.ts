export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';
