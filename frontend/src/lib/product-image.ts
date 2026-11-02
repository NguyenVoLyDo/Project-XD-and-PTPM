import { API_BASE } from './api-base';

const API_HOST = API_BASE.replace(/\/api\/v1\/?$/, '');

export function productImage(source?: string): string | undefined {
  if (!source) return undefined;
  if (source.includes('photo-1590658268037')) return '/images/earbuds.jpg';
  if (source.includes('photo-1583863788434')) return '/images/charger.jpg';
  if (source.includes('photo-1602143407151')) return '/images/bottle.jpg';
  if (source.startsWith('/uploads/')) return `${API_HOST}${source}`;
  return source;
}

