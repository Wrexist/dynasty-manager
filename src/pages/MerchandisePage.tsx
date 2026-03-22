import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/helpers';
import {
  ShoppingBag, Flag, Shirt, Gem, Globe, TrendingUp, TrendingDown,
  Zap, Clock, Lock, Tag, Star, ChevronRight, X,
} from 'lucide-react';
import {
  MERCH_PRODUCT_LINES, MERCH_PRICING_TIERS, MERCH_CAMPAIGNS,
} from '@/config/merchandise';
import {
  isProductLineUnlocked, getStarPlayerMerch, canLaunchCampaign,
  calculateWeeklyMerchRevenue, getMerchOperatingCost,
} from '@/utils/merchandise';
import type { MerchProductLine, MerchPricingTier, MerchCampaignType } from '@/types/game';

const PRODUCT_LINE_ICONS: Record<MerchProductLine, React.ElementType> = {
  matchday_essentials: Flag,
  replica_kits: Shirt,
  lifestyle_apparel: ShoppingBag,
  memorabilia: Gem,
  digital_global: Globe,
};

const MerchandisePage = () => {
  const store = useGameStore();
  const { clubs, playerClubId, merchandise, players, playerDivision, facilities, managerProgression, week, cup, leagueTable } = store;
  const club = clubs[playerClubId];
  if (!club) return null;

  const weeklyIncome = calculateWeeklyMerchRevenue(merchandise, club, players, playerDivision, managerProgression);
  const operatingCost = getMerchOperatingCost(merchandise.activeProductLines);
  const starPlayers = getStarPlayerMerch(club, players);

  const leaguePosition = (() => {
    const idx = leagueTable.findIndex(e => e.clubId === playerClubId);
    return idx >= 0 ? idx + 1 : leagueTable.length;
  })();

  const handleToggleLine = (line: MerchProductLine) => {
    store.toggleProductLine(line);
  };

  const handleSetPricing = (tier: MerchPricingTier) => {
    store.setMerchPricing(tier);
  };

  const handleLaunchCampaign = (type: MerchCampaignType) => {
    store.launchCampaign(type);
  };

  const seasonChange = merchandise.lastSeasonRevenue > 0
    ? ((merchandise.currentSeasonRevenue - merchandise.lastSeasonRevenue) / merchandise.lastSeasonRevenue) * 100
    : 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-display font-bold text-foreground">Merchandise</h1>
      </div>

      {/* Revenue Overview */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Weekly Revenue</span>
          <span className="text-xs text-muted-foreground">Operating: {formatMoney(operatingCost)}/wk</span>
        </div>
        <p className="text-2xl font-black text-primary font-display tabular-nums">
          {formatMoney(weeklyIncome)}
          <span className="text-sm font-normal text-muted-foreground">/week</span>
        </p>
        <div className="flex items-center gap-4 mt-2">
          <div>
            <span className="text-[10px] text-muted-foreground">Season Total</span>
            <p className="text-sm font-bold tabular-nums">{formatMoney(merchandise.currentSeasonRevenue)}</p>
          </div>
          {merchandise.lastSeasonRevenue > 0 && (
            <div>
              <span className="text-[10px] text-muted-foreground">vs Last Season</span>
              <div className="flex items-center gap-1">
                {seasonChange >= 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                  : <TrendingDown className="w-3 h-3 text-destructive" />
                }
                <span className={cn('text-sm font-bold', seasonChange >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                  {seasonChange >= 0 ? '+' : ''}{seasonChange.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Active campaign banner */}
        {merchandise.activeCampaign && (
          <div className="mt-3 bg-primary/10 border border-primary/30 rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {MERCH_CAMPAIGNS[merchandise.activeCampaign.type].label}
                </span>
              </div>
              <button
                onClick={() => store.cancelCampaign()}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${((merchandise.activeCampaign.totalWeeks - merchandise.activeCampaign.weeksRemaining) / merchandise.activeCampaign.totalWeeks) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {merchandise.activeCampaign.weeksRemaining}w left
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold">
              +{Math.round(merchandise.activeCampaign.revenueBoost * 100)}% revenue boost
            </span>
          </div>
        )}

        {/* Star player dip/buzz indicators */}
        {merchandise.starPlayerDip > 0 && (
          <div className="mt-2 bg-destructive/10 border border-destructive/30 rounded-lg p-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive font-medium">Star player sold — merch dip ({merchandise.starPlayerDip}w remaining)</span>
          </div>
        )}
        {merchandise.starSigningBuzz > 0 && (
          <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">New signing buzz! ({merchandise.starSigningBuzz}w remaining)</span>
          </div>
        )}
      </GlassPanel>

      {/* Product Lines */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Product Lines</span>
        </div>
        <div className="space-y-2">
          {(Object.keys(MERCH_PRODUCT_LINES) as MerchProductLine[]).map(line => {
            const def = MERCH_PRODUCT_LINES[line];
            const Icon = PRODUCT_LINE_ICONS[line];
            const unlocked = isProductLineUnlocked(line, club, playerDivision, facilities);
            const isActive = merchandise.activeProductLines.includes(line);

            return (
              <button
                key={line}
                onClick={() => unlocked && handleToggleLine(line)}
                disabled={!unlocked}
                className={cn(
                  'flex items-center gap-3 w-full p-3 rounded-xl transition-all',
                  unlocked ? 'hover:bg-muted/30 active:scale-[0.98]' : 'opacity-50 cursor-not-allowed',
                  isActive && 'bg-primary/10 border border-primary/30',
                  !isActive && unlocked && 'bg-muted/10 border border-transparent',
                  !unlocked && 'bg-muted/5 border border-transparent',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  isActive ? 'bg-primary/20' : 'bg-muted/30',
                )}>
                  {unlocked ? <Icon className={cn('w-4.5 h-4.5', isActive ? 'text-primary' : 'text-muted-foreground')} /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className={cn('text-sm font-semibold', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {def.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {unlocked
                      ? `${def.baseRevenueFactor}× revenue · ${formatMoney(def.weeklyOperatingCost)}/wk`
                      : getUnlockText(line)
                    }
                  </p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  isActive ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                )}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-background" />}
                </div>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Pricing Strategy */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Pricing Strategy</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MERCH_PRICING_TIERS) as MerchPricingTier[]).map(tier => {
            const def = MERCH_PRICING_TIERS[tier];
            const isSelected = merchandise.pricingTier === tier;
            return (
              <button
                key={tier}
                onClick={() => handleSetPricing(tier)}
                className={cn(
                  'p-3 rounded-xl border text-center transition-all active:scale-[0.97]',
                  isSelected ? 'bg-primary/15 border-primary/40' : 'bg-muted/10 border-border/30 hover:bg-muted/20',
                )}
              >
                <p className={cn('text-sm font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                  {def.label}
                </p>
                <p className="text-lg font-black tabular-nums mt-0.5">{def.revenueMultiplier}×</p>
                <p className={cn(
                  'text-[10px] font-semibold mt-1',
                  def.fanMoodImpact > 0 ? 'text-emerald-400' : def.fanMoodImpact < 0 ? 'text-amber-400' : 'text-muted-foreground',
                )}>
                  {def.fanMoodImpact > 0 ? `+${def.fanMoodImpact}` : def.fanMoodImpact} mood/wk
                </p>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Campaigns */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Campaigns</span>
          {merchandise.campaignCooldownWeeks > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <Clock className="w-3 h-3" /> Cooldown: {merchandise.campaignCooldownWeeks}w
            </span>
          )}
        </div>
        {merchandise.activeCampaign ? (
          <p className="text-xs text-muted-foreground">A campaign is currently running. Cancel it to launch a new one.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MERCH_CAMPAIGNS) as MerchCampaignType[]).map(type => {
              const def = MERCH_CAMPAIGNS[type];
              const check = canLaunchCampaign(type, {
                merch: merchandise,
                budget: club.budget,
                week,
                leaguePosition,
                cupEliminated: cup.eliminated,
                cupCurrentRound: cup.currentRound,
                hasRecentBigSigning: merchandise.starSigningBuzz > 0,
                kitLaunchUsedThisSeason: merchandise.kitLaunchUsedThisSeason ?? false,
              });

              return (
                <button
                  key={type}
                  onClick={() => check.eligible && handleLaunchCampaign(type)}
                  disabled={!check.eligible}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    check.eligible ? 'bg-muted/10 border-border/30 hover:bg-primary/10 hover:border-primary/30 active:scale-[0.97]' : 'opacity-40 cursor-not-allowed bg-muted/5 border-transparent',
                  )}
                >
                  <p className="text-xs font-bold text-foreground leading-tight">{def.label}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-emerald-400 font-semibold">+{Math.round(def.revenueBoost * 100)}%</span>
                    <span className="text-[10px] text-muted-foreground">{def.durationWeeks}w</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatMoney(def.setupCost)} setup</p>
                  {!check.eligible && check.reason && (
                    <p className="text-[9px] text-destructive/70 mt-1 leading-tight">{check.reason}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* Star Players */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Star className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Star Player Merch</span>
        </div>
        {starPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No players with enough appearances yet.</p>
        ) : (
          <div className="space-y-2">
            {starPlayers.map((sp, idx) => {
              const player = players[sp.playerId];
              if (!player) return null;
              return (
                <button
                  key={sp.playerId}
                  onClick={() => { store.selectPlayer(sp.playerId); store.setScreen('player-detail'); }}
                  className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-muted/10 hover:bg-muted/20 transition-all active:scale-[0.98]"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{sp.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {player.position} · OVR {player.overall} · {player.goals}G {player.assists}A
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-primary tabular-nums">{formatMoney(sp.merchBonus)}/wk</p>
                    <p className="text-[10px] text-muted-foreground">Score: {sp.marketability}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};

function getUnlockText(line: MerchProductLine): string {
  const req = MERCH_PRODUCT_LINES[line].unlockRequirement;
  const parts: string[] = [];
  if (req.minDivision) {
    const divNames: Record<string, string> = { 'div-1': 'Div 1', 'div-2': 'Div 2', 'div-3': 'Div 3', 'div-4': 'Div 4' };
    parts.push(divNames[req.minDivision] || req.minDivision);
  }
  if (req.minReputation) parts.push(`Rep ${req.minReputation}+`);
  if (req.minStadiumLevel) parts.push(`Stadium Lv${req.minStadiumLevel}+`);
  return parts.length > 0 ? `Requires: ${parts.join(' or ')}` : 'Locked';
}

export default MerchandisePage;
