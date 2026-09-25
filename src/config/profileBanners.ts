/**
 * How each earned manager banner (`profile_banner` cosmetics — Manager Pass
 * and Legacy rewards) is drawn: Tailwind gradient stops layered over the hero
 * of the Manager Pass and Legacy pages. Written out in full so the JIT sees
 * every class. Purely presentational.
 *
 * Kept out of config/managerPass.ts on purpose: only the two (lazy) pages that
 * draw a banner import this, so it stays off the size-capped main chunk.
 */
export const PROFILE_BANNER_STYLES: Record<string, string> = {
  'banner-touchline': 'from-sky-500/25 via-sky-500/5 to-transparent',
  'banner-floodlights': 'from-slate-200/20 via-slate-300/5 to-transparent',
  'banner-matchday': 'from-emerald-500/25 via-emerald-500/5 to-transparent',
  'banner-pro-gold-rush': 'from-amber-400/35 via-amber-500/10 to-transparent',
  'banner-pro-emerald-night': 'from-emerald-400/30 via-teal-900/20 to-transparent',
  'banner-pro-midnight-blue': 'from-blue-600/35 via-indigo-900/20 to-transparent',
  'banner-pro-crimson-derby': 'from-rose-600/35 via-red-900/15 to-transparent',
  'banner-pro-royal-violet': 'from-violet-500/35 via-purple-900/15 to-transparent',
  'banner-pro-sunset': 'from-orange-500/35 via-pink-600/15 to-transparent',
  'banner-pro-arctic': 'from-cyan-300/30 via-sky-800/15 to-transparent',
  'banner-pro-obsidian': 'from-zinc-300/15 via-zinc-900/40 to-transparent',
  'banner-pro-champions': 'from-amber-300/40 via-primary/15 to-sky-500/10',
  // Legacy tier banners
  'banner-legacy-bronze': 'from-orange-700/35 via-amber-900/15 to-transparent',
  'banner-legacy-silver': 'from-slate-300/30 via-slate-500/10 to-transparent',
  'banner-legacy-gold': 'from-yellow-400/40 via-amber-600/15 to-transparent',
  'banner-legacy-immortal': 'from-fuchsia-500/30 via-amber-400/15 to-cyan-400/15',
};
