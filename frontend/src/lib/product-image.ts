export function productImage(source?: string): string | undefined {
  if (source?.includes('photo-1590658268037')) return '/images/earbuds.jpg';
  if (source?.includes('photo-1583863788434')) return '/images/charger.jpg';
  if (source?.includes('photo-1602143407151')) return '/images/bottle.jpg';
  return source;
}
