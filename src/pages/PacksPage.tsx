import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Package, Coins, Flame, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PageHint } from '@/components/game/PageHint';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { PAGE_HINTS, PLAYER_TIER_THRESHOLDS } from '@/config/ui';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { PACK_TIERS, PACK_TIER_MAP, PACK_PITY_THRESHOLD, RECENT_PULLS_LIMIT, getFeaturedPackTier } from '@/config/packs';
import type { PackPlayerPlacement, PackTierKey } from '@/types/game';
import { PackShopCard } from '@/components/game/pack/PackShopCard';
import { PackOpeningOverlay } from '@/components/game/pack/PackOpeningOverlay';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { errorToast } from '@/utils/gameToast';
import type { Player } from '@/types/game';

function tierBadgeClass(ovr: number): string {
  for (const t of PLAYER_TIER_THRESHOLDS) if (ovr >= t.min) return t.badgeClass;
  return PLAYER_TIER_THRESHOLDS[PLAYER_TIER_THRESHOLDS.length - 1].badgeClass;
}

const PacksPage = () => {
  const { club, players, openedPacks, packPityCounter, lastPackWeek, lastPackSeason, season, week } = useGameStore(useShallow((s) => ({
    club: s.clubs[s.playerClubId],
    players: s.players,
    openedPacks: s.openedPacks || [],
    packPityCounter: s.packPityCounter || 0,
    lastPackWeek: s.lastPackWeek || 0,
    lastPackSeason: s.lastPackSeason || 0,
    season: s.season,
    week: s.week,
  })));
  const openPack = useGameStore(s => s.openPack);
  const releasePackedPlayer = useGameStore(s => s.releasePackedPlayer);

  const [opening, setOpening] = useState<{ tier: PackTierKey; players: Player[]; pityTriggered?: boolean; placement?: Record<string, PackPlayerPlacement> } | null>(null);
  const [replay, setReplay] = useState<{ tier: PackTierKey; players: Player[] } | null>(null);

  const handleDismiss = (playerId: string) => {
    const result = releasePackedPlayer(playerId);
    if (!result.success) {
      errorToast('Cannot release', result.message);
      return;
    }
    // Drop this player from the live overlay view
    setOpening(prev => prev ? { ...prev, players: prev.players.filter(p => p.id !== playerId) } : prev);
  };

  useEffect(() => {
    PACK_TIERS.forEach((t) => { if (t.artSrc) { const img = new Image(); img.src = t.artSrc; } });
  }, []);

  const budget = club?.budget ?? 0;
  const squadSize = club?.playerIds.length ?? 0;
  // Drive cooldown state purely from the tracked (season, week) pair so the
  // UI stays correct even if openedPacks history gets pruned or migrated.
  const weekCooldownActive = lastPackSeason > 0 && lastPackWeek > 0
    && lastPackSeason === season && lastPackWeek === week;

  const pityRemaining = Math.max(0, PACK_PITY_THRESHOLD - packPityCounter);
  const pityProgressPct = Math.min(100, (packPityCounter / PACK_PITY_THRESHOLD) * 100);

  const featuredKey = useMemo(() => getFeaturedPackTier(season, week), [season, week]);
  const featured = PACK_TIER_MAP[featuredKey];
  const nonFeatured = useMemo(() => PACK_TIERS.filter(t => t.key !== featuredKey), [featuredKey]);

  const handleOpen = (tierKey: PackTierKey) => {
    // Guard against rapid double-taps while an overlay is already up or
    // a pack was just opened this frame. openPack() is synchronous so
    // this is enough — no timers needed.
    if (opening || replay) return;
    if (weekCooldownActive) {
      errorToast('Only one pack per week', 'Advance a week to open another.');
      return;
    }
    const tier = PACK_TIER_MAP[tierKey];
    if (!club || club.budget < tier.price) {
      errorToast('Insufficient funds', `This pack costs ${formatMoney(tier.price)}.`);
      return;
    }
    if (squadSize + tier.cards > MAX_SQUAD_SIZE) {
      errorToast('Squad full', `Release players — pack delivers ${tier.cards} player(s).`);
      return;
    }
    const result = openPack(tierKey);
    if (!result.success || !result.players) {
      errorToast('Could not open pack', result.message);
      return;
    }
    setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered, placement: result.placement });
  };

  const recentPacks = openedPacks.slice(0, RECENT_PULLS_LIMIT);

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="packs" title={PAGE_HINTS.packs.title} body={PAGE_HINTS.packs.body} />

      <div className="px-4 pb-6 space-y-4">
        {/* Header + budget chip */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Player Packs
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Spend budget, sign players instantly.</p>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur text-xs font-semibold tabular-nums',
              budget <= 0 ? 'text-destructive border-destructive/40 bg-destructive/10' : 'text-primary border-primary/30 bg-primary/10',
            )}
            aria-live="polite"
            aria-label={`Budget ${formatMoney(budget)}`}
          >
            <Coins className="w-3.5 h-3.5" />
            <AnimatedNumber value={budget} duration={450} formatFn={formatMoney} />
          </div>
        </div>

        {/* Squad cap + weekly throttle chips */}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
          <span className={cn(
            'px-2 py-1 rounded-md border',
            squadSize >= MAX_SQUAD_SIZE
              ? 'border-destructive/40 text-destructive bg-destructive/10'
              : 'border-border/60 text-muted-foreground bg-muted/20',
          )}>
            Squad {squadSize}/{MAX_SQUAD_SIZE}
          </span>
          {weekCooldownActive && (
            <span className="px-2 py-1 rounded-md border border-amber-400/40 text-amber-400 bg-amber-400/10 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> One per week
            </span>
          )}
        </div>

        {/* Featured hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Featured Pack</h3>
          </div>
          <PackShopCard
            featured
            tier={featured}
            affordable={budget >= featured.price}
            squadOk={squadSize + featured.cards <= MAX_SQUAD_SIZE}
            onSelect={() => handleOpen(featured.key)}
          />
        </div>

        {/* Standard pack grid */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">All Packs</h3>
          <div className="grid grid-cols-2 gap-3">
            {nonFeatured.map(tier => (
              <PackShopCard
                key={tier.key}
                tier={tier}
                affordable={budget >= tier.price}
                squadOk={squadSize + tier.cards <= MAX_SQUAD_SIZE}
                onSelect={() => handleOpen(tier.key)}
              />
            ))}
          </div>
        </div>

        {/* Pity meter */}
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-foreground">Guarantee Tracker</span>
            <span className="text-muted-foreground">
              {pityRemaining === 0 ? 'Next gold guaranteed!' : `${pityRemaining} dry pack${pityRemaining === 1 ? '' : 's'} to guaranteed gold`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-500"
              style={{ width: `${pityProgressPct}%` }}
            />
          </div>
        </GlassPanel>

        {/* Recent pulls */}
        {recentPacks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Recent Pulls</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {recentPacks.map(rec => {
                const tier = PACK_TIER_MAP[rec.tier];
                const pulled = rec.playerIds.map(id => players[id]).filter(Boolean) as Player[];
                if (pulled.length === 0) return null;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setReplay({ tier: rec.tier, players: pulled })}
                    className="shrink-0 w-28 text-left rounded-xl border border-white/10 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    style={{ background: `linear-gradient(135deg, ${tier.gradientFrom}, ${tier.gradientTo})` }}
                  >
                    <div className="flex gap-2 p-2 text-white">
                      {tier.artSrc && (
                        <img
                          src={tier.artSrc}
                          alt=""
                          aria-hidden
                          className="w-6 h-8 rounded-sm object-cover shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-widest opacity-80 truncate">{tier.label}</p>
                        <p className="text-2xl font-display font-black leading-none mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{rec.topOvr}</p>
                        <p className={cn(
                          'text-[9px] uppercase tracking-widest mt-1 inline-block px-1.5 py-0.5 rounded',
                          tierBadgeClass(rec.topOvr),
                        )}>
                          Top Pull
                        </p>
                        <p className="text-[9px] opacity-80 mt-1">S{rec.season} · W{rec.week}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {openedPacks.length === 0 && (
          <GlassPanel className="p-6 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No packs opened yet</p>
            <p className="text-xs text-muted-foreground mt-1">Pick a pack above — revealed players join your squad instantly.</p>
          </GlassPanel>
        )}
      </div>

      {/* Pack Opening Overlay */}
      <AnimatePresence>
        {opening && (
          <PackOpeningOverlay
            tier={opening.tier}
            players={opening.players}
            pityTriggered={opening.pityTriggered}
            onClose={() => setOpening(null)}
            onDismiss={handleDismiss}
            placement={opening.placement}
          />
        )}
      </AnimatePresence>

      {/* Replay recent pull (summary state only) */}
      <AnimatePresence>
        {replay && (
          <PackOpeningOverlay
            tier={replay.tier}
            players={replay.players}
            onClose={() => setReplay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PacksPage;
