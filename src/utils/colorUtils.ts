/** Darken a hex color by a fraction (0–1). */
export function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - amount)) | 0;
  const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - amount)) | 0;
  const b = Math.max(0, (num & 0xFF) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Lighten a hex color by a fraction (0–1). */
export function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + (255 - ((num >> 16) & 0xFF)) * amount) | 0;
  const g = Math.min(255, ((num >> 8) & 0xFF) + (255 - ((num >> 8) & 0xFF)) * amount) | 0;
  const b = Math.min(255, (num & 0xFF) + (255 - (num & 0xFF)) * amount) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
