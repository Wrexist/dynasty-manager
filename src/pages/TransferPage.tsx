import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShoppingCart, Bookmark, BookmarkCheck, Tag, ArrowDownLeft, ArrowUpRight, Repeat2, Clock, Users, Search, Calendar, Newspaper, X, ArrowUpDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticLight, hapticMedium, hapticHeavy } from '@/utils/haptics';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { TransferListing, IncomingOffer } from '@/types/game';
import { successToast, errorToast, infoToast } from '@/utils/gameToast';
import { getRatingColor } from '@/utils/uiHelpers';
import { POSITION_FILTERS, PAGE_HINTS, MARKET_SUB_NAV, SIGNIFICANT_OFFER_OVERALL, SIGNIFICANT_OFFER_FEE, BUDGET_WARNING_THRESHOLD, HOT_FORM_THRESHOLD, GOOD_FORM_THRESHOLD, OFFER_EXPIRY_WARNING_WEEKS } from '@/config/ui';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { IncomingOfferNegotiation } from '@/components/game/IncomingOfferNegotiation';
import { PageHint } from '@/components/game/PageHint';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END, OFFER_EXPIRY_WEEKS, FREE_AGENT_DEFAULT_CONTRACT_YEARS, FREE_AGENT_MIN_WAGE_RATIO, FREE_AGENT_MAX_WAGE_RATIO, LOAN_BUY_FEE_MULTIPLIER, PRE_SEASON_END } from '@/config/transfers';
import { MAX_SQUAD_SIZE, LOAN_MIN_WEEKS_BEFORE_RECALL } from '@/config/gameBalance';
import { formatMoney } from '@/utils/helpers';
import { getPerformanceMultiplier, getMaxFreeAgentOverall, calculateSigningBonus } from '@/utils/transferOffers';
import { TransferPlayerCard } from '@/components/game/TransferPlayerCard';
import { LEAGUES } from '@/data/league';
import { EmptyState } from '@/components/game/EmptyState';
import { EMPTY_STATES } from '@/assets/manifest';
import { playSfxTransferAccepted, playSfxWarning } from '@/utils/audio';

const TransferPage = () => {
  const {
    transferMarket, players, clubs, playerClubId, shortlist, transferWindowOpen,
    incomingOffers, activeLoans, incomingLoanOffers, outgoingLoanRequests,
    week, season, totalWeeks,
    freeAgents, scouting, transferNews, playerDivision, transferFilters,
  } = useGameStore(useShallow(s => ({
    transferMarket: s.transferMarket,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    shortlist: s.shortlist,
    transferWindowOpen: s.transferWindowOpen,
    incomingOffers: s.incomingOffers,
    activeLoans: s.activeLoans,
    incomingLoanOffers: s.incomingLoanOffers,
    outgoingLoanRequests: s.outgoingLoanRequests,
    week: s.week,
    season: s.season,
    totalWeeks: s.totalWeeks,
    freeAgents: s.freeAgents,
    scouting: s.scouting,
    transferNews: s.transferNews,
    playerDivision: s.playerDivision,
    transferFilters: s.transferFilters,
  })));

  const addToShortlist = useGameStore(s => s.addToShortlist);
  const removeFromShortlist = useGameStore(s => s.removeFromShortlist);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const respondToOffer = useGameStore(s => s.respondToOffer);
  const unlistPlayer = useGameStore(s => s.unlistPlayer);
  const recallLoan = useGameStore(s => s.recallLoan);
  const buyLoanedPlayer = useGameStore(s => s.buyLoanedPlayer);
  const respondToLoanOffer = useGameStore(s => s.respondToLoanOffer);
  const signFreeAgent = useGameStore(s => s.signFreeAgent);
  const setScreen = useGameStore(s => s.setScreen);
  const setTransferFilter = useGameStore(s => s.setTransferFilter);

  // Persistent filters (survive navigation)
  const { tab, posFilter, searchQuery, sortBy, faSortBy, divFilter, newsTypeFilter, hideUnaffordable, showShortlistOnly, clauseReady } = transferFilters;
  const setTab = (v: typeof tab) => setTransferFilter({ tab: v, searchQuery: '' });
  const setPosFilter = (v: number) => setTransferFilter({ posFilter: v });
  const setSearchQuery = (v: string) => setTransferFilter({ searchQuery: v });
  const setSortBy = (v: typeof sortBy) => setTransferFilter({ sortBy: v });
  const setFaSortBy = (v: typeof faSortBy) => setTransferFilter({ faSortBy: v });
  const setDivFilter = (v: string) => setTransferFilter({ divFilter: v });
  const setNewsTypeFilter = (v: typeof newsTypeFilter) => setTransferFilter({ newsTypeFilter: v });
  const setHideUnaffordable = (v: boolean) => setTransferFilter({ hideUnaffordable: v });
  const setShowShortlistOnly = (v: boolean) => setTransferFilter({ showShortlistOnly: v });
  const setClauseReady = (v: boolean) => setTransferFilter({ clauseReady: v });

  // Transient UI state (resets on navigation — modal/dialog state)
  const [signingPlayer, setSigningPlayer] = useState<string | null>(null);
  const [offerWage, setOfferWage] = useState(0);
  const [offerYears, setOfferYears] = useState(FREE_AGENT_DEFAULT_CONTRACT_YEARS);
  const [negotiatingListing, setNegotiatingListing] = useState<TransferListing | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ offerId: string; accept: boolean; playerName: string; fee: number } | null>(null);
  const [negotiatingOffer, setNegotiatingOffer] = useState<IncomingOffer | null>(null);

  const club = clubs[playerClubId];

  // Filter listings based on shortlist toggle
  const listings = useMemo(() => {
    let result = showShortlistOnly
      ? transferMarket.filter(l => shortlist.includes(l.playerId))
      : transferMarket.filter(l => l.sellerClubId !== playerClubId);

    if (POSITION_FILTERS[posFilter].positions.length > 0) {
      result = result.filter(l => {
        const p = players[l.playerId];
        return p && POSITION_FILTERS[posFilter].positions.includes(p.position);
      });
    }

    // Division filter (tier-based)
    if (divFilter !== 'all') {
      const filterTier = Number(divFilter);
      result = result.filter(l => {
        const divId = l.divisionId || clubs[l.sellerClubId]?.divisionId;
        if (!divId) return false; // External player without divisionId — hide when filtering
        const listingTier = LEAGUES.find(lg => lg.id === divId)?.tier;
        return listingTier === filterTier;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l => {
        const p = players[l.playerId];
        if (!p) return false;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return fullName.includes(q);
      });
    }

    // Affordability filter (don't hide shortlisted players)
    if (hideUnaffordable && !showShortlistOnly) {
      const budget = club?.budget || 0;
      result = result.filter(l => l.askingPrice <= budget);
    }

    // Clause-ready filter — only show listings whose player has a release clause
    // the user's current budget can comfortably cover. Powers the "guaranteed
    // acquisition" scouting flow: flip the chip, see exactly who you can
    // sign-trigger today.
    if (clauseReady) {
      const budget = club?.budget || 0;
      result = result.filter(l => {
        const p = players[l.playerId];
        return !!p && !!p.releaseClause && p.releaseClause > 0 && p.releaseClause <= budget;
      });
    }

    // Sort by selected criteria
    result.sort((a, b) => {
      const pa = players[a.playerId];
      const pb = players[b.playerId];
      if (!pa || !pb) return 0;
      switch (sortBy) {
        case 'price': return a.askingPrice - b.askingPrice;
        case 'age': return pa.age - pb.age;
        case 'potential': return (pb.potential || pb.overall) - (pa.potential || pa.overall);
        case 'overall':
        default: return pb.overall - pa.overall;
      }
    });
    return result;
  }, [showShortlistOnly, transferMarket, shortlist, playerClubId, posFilter, players, searchQuery, sortBy, divFilter, clubs, hideUnaffordable, clauseReady, club?.budget]);

  // Outgoing: own players listed for sale
  const outgoingPlayers = useMemo(() => {
    return Object.values(players).filter(p => p.clubId === playerClubId && p.listedForSale);
  }, [players, playerClubId]);

  // Free agents
  const freeAgentPlayers = useMemo(() => {
    let result = freeAgents.map(id => players[id]).filter(Boolean);
    if (POSITION_FILTERS[posFilter].positions.length > 0) {
      result = result.filter(p => POSITION_FILTERS[posFilter].positions.includes(p.position));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
    }
    // Reputation gate: only show free agents within club's quality range
    const maxOvr = getMaxFreeAgentOverall(club?.reputation || 1, playerDivision);
    result = result.filter(p => p.overall <= maxOvr);
    result.sort((a, b) => {
      switch (faSortBy) {
        case 'age': return a.age - b.age;
        case 'potential': return (b.potential || b.overall) - (a.potential || a.overall);
        case 'wage': return a.wage - b.wage;
        case 'overall':
        default: return b.overall - a.overall;
      }
    });
    return result;
   
  }, [freeAgents, players, posFilter, searchQuery, faSortBy, club?.reputation, playerDivision]);

  // News tab computations (memoized)
  const newsSummary = useMemo(() => {
    const allNews = transferNews || [];
    const totalTransfers = allNews.filter(e => e.type === 'transfer').length;
    const totalLoans = allNews.filter(e => e.type === 'loan').length;
    const totalFreeAgents = allNews.filter(e => e.type === 'free_agent').length;
    const totalSpend = allNews.reduce((sum, e) => sum + (e.fee || 0), 0);
    const biggestDeal = allNews.reduce((max, e) => (e.fee || 0) > (max?.fee || 0) ? e : max, allNews[0]);
    const myClubDeals = allNews.filter(e => e.fromClubId === playerClubId || e.toClubId === playerClubId);
    return { allNews, totalTransfers, totalLoans, totalFreeAgents, totalSpend, biggestDeal, myClubDeals };
  }, [transferNews, playerClubId]);

  const filteredGroupedNews = useMemo(() => {
    const allNews = transferNews || [];
    const filteredNews = newsTypeFilter === 'all'
      ? [...allNews].reverse()
      : allNews.filter(e => e.type === newsTypeFilter).reverse();

    const grouped: Record<string, typeof filteredNews> = {};
    for (const entry of filteredNews) {
      const key = `S${entry.season} Wk ${entry.week}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    }
    return { filteredNews, grouped };
  }, [transferNews, newsTypeFilter]);

  const handleOffer = (listing: TransferListing) => {
    if (!transferWindowOpen) {
      errorToast('Transfer window is closed.');
      return;
    }
    hapticMedium();
    setNegotiatingListing(listing);
  };

  const confirmAllOffers = useGameStore(s => s.settings.confirmAllOffers);

  const handleRespondToOffer = (offerId: string, accept: boolean) => {
    // Confirm significant offers (player overall >= 70 or fee >= 5M), or all offers if setting enabled
    if (accept) {
      const offer = incomingOffers.find(o => o.id === offerId);
      const p = offer ? players[offer.playerId] : null;
      if (p && (confirmAllOffers || p.overall >= SIGNIFICANT_OFFER_OVERALL || (offer && offer.fee >= SIGNIFICANT_OFFER_FEE))) {
        hapticMedium();
        setConfirmAction({ offerId, accept, playerName: `${p.firstName} ${p.lastName}`, fee: offer!.fee });
        return;
      }
    }
    executeOfferResponse(offerId, accept);
  };

  const executeOfferResponse = (offerId: string, accept: boolean) => {
    // Detect clause trigger before the call — respondToOffer will auto-execute
    // when the offer meets the clause, so we need to know in advance to fire
    // the heavier haptic/audio feedback even if `accept` was false.
    const offer = incomingOffers.find(o => o.id === offerId);
    const p = offer ? players[offer.playerId] : null;
    const triggeredClause = !!(offer && p?.releaseClause && offer.fee >= p.releaseClause);

    const result = respondToOffer(offerId, accept);
    if (result.success) {
      if (triggeredClause) {
        hapticHeavy();
        playSfxWarning();
      } else if (accept) {
        hapticMedium();
      } else {
        hapticLight();
      }
      successToast(result.message);
    } else {
      errorToast(result.message);
    }
    setConfirmAction(null);
  };

  const handleUnlist = (playerId: string) => {
    unlistPlayer(playerId);
    infoToast('Player removed from transfer list.');
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* SubNav */}
      <SubNav items={MARKET_SUB_NAV} />

      <PageHint screen="transfers" title={PAGE_HINTS.transfers.title} body={PAGE_HINTS.transfers.body} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground font-display">Transfers</h2>
        {(week === SUMMER_WINDOW_END || week === WINTER_WINDOW_END) ? (
          <span className="flex items-center gap-1 text-xs bg-destructive/15 text-destructive px-2.5 py-1 rounded-md font-bold uppercase tracking-wide animate-pulse">
            <Clock className="w-3 h-3" /> Deadline Day
          </span>
        ) : (transferWindowOpen && week <= PRE_SEASON_END) ? (
          <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-1 rounded-md font-medium">
            <TrendingUp className="w-3 h-3" /> Pre-Season Market
          </span>
        ) : transferWindowOpen ? (
          <span className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            {week <= SUMMER_WINDOW_END
              ? `${SUMMER_WINDOW_END - week} wk${SUMMER_WINDOW_END - week !== 1 ? 's' : ''} left`
              : `${WINTER_WINDOW_END - week} wk${WINTER_WINDOW_END - week !== 1 ? 's' : ''} left`}
          </span>
        ) : (
          <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-md">
            Closed — opens {week < WINTER_WINDOW_START ? `Wk ${WINTER_WINDOW_START}` : 'next season'}
          </span>
        )}
      </div>

      {/* Budget & Squad Size */}
      <GlassPanel className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Available Budget</span>
          <AnimatedNumber
            value={club?.budget || 0}
            formatFn={(n) => '\u00A3' + (n / 1e6).toFixed(1) + 'M'}
            className="text-lg font-black text-primary tabular-nums"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Squad Size</span>
          <span className={cn('text-xs font-bold tabular-nums', (club?.playerIds.length || 0) >= MAX_SQUAD_SIZE ? 'text-destructive' : 'text-muted-foreground')}>
            {club?.playerIds.length || 0} / {MAX_SQUAD_SIZE}
          </span>
        </div>
      </GlassPanel>

      {/* Ad Reward: Budget Boost */}
      {transferWindowOpen && (
        <AdRewardButton rewardType="transfer_budget" onRewardClaimed={() => { useGameStore.getState().applyTransferBudgetBonus(); }} />
      )}

      {/* Closed window planning hints */}
      {!transferWindowOpen && (
        <GlassPanel className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {week < WINTER_WINDOW_START
                ? `${WINTER_WINDOW_START - week} weeks until the winter window`
                : `Transfer window reopens next season`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {shortlist.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {shortlist.length} shortlisted
              </span>
            )}
            {scouting.assignments.length > 0 && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                {scouting.assignments.length} scout{scouting.assignments.length !== 1 ? 's' : ''} active
              </span>
            )}
            <button
              onClick={() => setScreen('scouting')}
              className="text-[10px] text-primary underline underline-offset-2 hover:text-primary/80"
            >
              <Search className="w-3 h-3 inline mr-0.5" />Scout ahead
            </button>
          </div>
        </GlassPanel>
      )}

      {/* Transfer Tabs (4 tabs) */}
      <div role="tablist" aria-label="Transfer sections" className="flex gap-1.5">
        {([
          { id: 'market' as const, icon: ShoppingCart, label: 'Market', count: 0 },
          { id: 'deals' as const, icon: ArrowDownLeft, label: 'Deals', count: incomingOffers.length + outgoingPlayers.length + activeLoans.length + incomingLoanOffers.length },
          { id: 'freeAgents' as const, icon: Users, label: 'Free Agents', count: 0 },
          { id: 'news' as const, icon: Newspaper, label: 'News', count: 0 },
        ]).map(({ id, icon: TabIcon, label, count }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => { hapticLight(); setTab(id); if (id !== 'news') setNewsTypeFilter('all'); }}
            className={cn(
              'flex items-center gap-1 flex-1 justify-center px-2 py-2 rounded-lg text-xs font-medium transition-colors relative',
              tab === id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <TabIcon className="w-3.5 h-3.5" />
            <span className="truncate">{label}</span>
            {count != null && count > 0 && (
              <span className={cn(
                'ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1',
                tab === id ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary'
              )}>
                {count}
              </span>
            )}
            {tab === id && (
              <motion.div
                layoutId="transfer-tab-indicator"
                className="absolute inset-0 rounded-lg bg-primary -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Compact Filter Toolbar (market & free agents tabs) */}
      {(tab === 'market' || tab === 'freeAgents') && (
        <div className="space-y-2">
          {/* Search + Shortlist toggle (single row) */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="transfer-search" className="sr-only">Search player name</label>
              <input
                id="transfer-search"
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search player..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 pr-8 rounded-lg text-xs bg-card/60 backdrop-blur-xl border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {tab === 'market' && shortlist.length > 0 && (
              <button
                aria-label={showShortlistOnly ? 'Show all players' : 'Show shortlist only'}
                onClick={() => { hapticLight(); setShowShortlistOnly(!showShortlistOnly); }}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all',
                  showShortlistOnly ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {showShortlistOnly ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                {shortlist.length}
              </button>
            )}
          </div>

          {/* Position + Sort + Filters (single compact row) */}
          <div className="flex items-center gap-1.5">
            {POSITION_FILTERS.map((f, i) => (
              <button
                key={f.label}
                aria-label={`Filter by ${f.label === 'All' ? 'all positions' : f.label}`}
                onClick={() => { hapticLight(); setPosFilter(i); }}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                  posFilter === i ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="flex-1" />
            {tab === 'market' && (
              <button
                aria-label={hideUnaffordable ? 'Show all prices' : 'Hide unaffordable'}
                onClick={() => { hapticLight(); setHideUnaffordable(!hideUnaffordable); }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 transition-all',
                  hideUnaffordable ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {'\u00A3'}{hideUnaffordable ? '\u2713' : ''}
              </button>
            )}
            {tab === 'market' && (
              <button
                aria-label={clauseReady ? 'Show all listings' : 'Show only clause-ready players'}
                title="Only show players whose release clause fits your budget"
                onClick={() => { hapticLight(); setClauseReady(!clauseReady); }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 transition-all',
                  clauseReady ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                🔒{clauseReady ? '\u2713' : ''}
              </button>
            )}
            <button
              aria-label={`Sort by ${tab === 'freeAgents' ? faSortBy : sortBy}`}
              onClick={() => {
                hapticLight();
                if (tab === 'freeAgents') {
                  const opts: typeof faSortBy[] = ['overall', 'age', 'potential', 'wage'];
                  setFaSortBy(opts[(opts.indexOf(faSortBy) + 1) % opts.length]);
                } else {
                  const opts: typeof sortBy[] = ['overall', 'price', 'age', 'potential'];
                  setSortBy(opts[(opts.indexOf(sortBy) + 1) % opts.length]);
                }
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowUpDown className="w-2.5 h-2.5" />
              {tab === 'freeAgents'
                ? (faSortBy === 'overall' ? 'OVR' : faSortBy === 'age' ? 'Age' : faSortBy === 'potential' ? 'POT' : 'Wage')
                : (sortBy === 'overall' ? 'OVR' : sortBy === 'price' ? 'Price' : sortBy === 'age' ? 'Age' : 'POT')}
            </button>
          </div>

          {/* Division filter (market only, inline) */}
          {tab === 'market' && (
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {[
                { id: 'all', label: 'All' },
                { id: '1', label: 'Top Flight' },
                { id: '2', label: '2nd Tier' },
                { id: '3', label: '3rd Tier' },
                { id: '4', label: '4th Tier' },
              ].map(d => (
                <button
                  key={d.id}
                  aria-label={`Filter by ${d.label}`}
                  onClick={() => { hapticLight(); setDivFilter(d.id); }}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium shrink-0 transition-all',
                    divFilter === d.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground/60 hover:text-foreground'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Market Stats Summary */}
      {tab === 'market' && (
        <GlassPanel className="p-2.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{listings.filter(l => !l.externalPlayer).length} from clubs</span>
          <span className="text-border">|</span>
          <span>{listings.filter(l => l.externalPlayer).length} unattached</span>
          <span className="text-border">|</span>
          <span>{freeAgents.length} free agents</span>
          <span className="text-border">|</span>
          <span>{listings.length} match{listings.length !== 1 ? 'es' : ''}</span>
        </GlassPanel>
      )}

      {/* Market Listings */}
      {tab === 'market' && (
        <div className="space-y-2">
          {listings.length === 0 && (() => {
            const hasFilters = posFilter !== 0 || searchQuery.trim() || divFilter !== 'all' || hideUnaffordable || showShortlistOnly || clauseReady;
            return (
              <EmptyState
                icon={ShoppingCart}
                illustration={EMPTY_STATES.transfers}
                title={hasFilters ? (showShortlistOnly ? 'No shortlisted players' : 'No players match your filters') : 'No players on the market'}
                body={hasFilters ? (showShortlistOnly ? 'Tap the bookmark icon on any player to add them to your shortlist.' : 'Try adjusting your search, position, or division filters.') : 'Clubs list players during the transfer window. Check back once the window opens.'}
                compact
              />
            );
          })()}
          {listings.map((listing, i) => {
            const p = players[listing.playerId];
            if (!p) return null;
            const seller = clubs[listing.sellerClubId];
            const inShortlist = shortlist.includes(p.id);

            return (
              <TransferPlayerCard
                key={p.id}
                player={p}
                onSelect={selectPlayer}
                showFlag
                showPotential
                animationIndex={i}
                subtitle={
                  (() => {
                    const leagueInfo = listing.divisionId ? LEAGUES.find(l => l.id === listing.divisionId) : undefined;
                    return listing.externalPlayer ? (
                      <>
                        <span className="text-amber-400">Unattached</span>
                        {listing.divisionId && (
                          <span className="ml-1 text-[10px] text-muted-foreground/60">
                            ({leagueInfo?.shortName || 'External'} tier)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        From: {seller?.shortName || '?'}
                        {listing.divisionId && (
                          <span className="ml-1 text-[10px] text-muted-foreground/60">
                            ({leagueInfo?.shortName || 'External'})
                          </span>
                        )}
                      </>
                    );
                  })()
                }
                rightContent={
                  <>
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        listing.askingPrice > (club?.budget || 0) ? 'bg-destructive' :
                        listing.askingPrice > (club?.budget || 0) * BUDGET_WARNING_THRESHOLD ? 'bg-amber-400' : 'bg-emerald-400'
                      )} />
                      <p className="text-sm font-bold text-primary">{formatMoney(listing.askingPrice)}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{'\u00A3'}{(p.wage / 1e3).toFixed(0)}K/w</p>
                  </>
                }
                actions={
                  <>
                    <Button
                      size="sm" className="flex-1 h-8 text-xs"
                      disabled={!transferWindowOpen}
                      onClick={() => handleOffer(listing)}
                    >
                      Make Offer
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-8 w-8 p-0"
                      aria-label={inShortlist ? 'Remove from shortlist' : 'Add to shortlist'}
                      onClick={() => { hapticLight(); if (inShortlist) { removeFromShortlist(p.id); infoToast('Removed from shortlist'); } else { addToShortlist(p.id); successToast('Added to shortlist'); } }}
                    >
                      {inShortlist ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                    </Button>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Deals Tab (Incoming + Outgoing + Loans combined) */}
      {tab === 'deals' && (
        <div className="space-y-4">
          {/* Incoming Transfer Offers */}
          {incomingOffers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Incoming Offers</p>
              {incomingOffers.map((offer, i) => {
                const p = players[offer.playerId];
                if (!p) return null;
                const buyer = clubs[offer.buyerClubId];
                const perfMult = getPerformanceMultiplier(p);
                const pctDiff = p.value > 0 ? Math.round(((offer.fee - p.value) / p.value) * 100) : 0;

                return (
                  <TransferPlayerCard
                    key={offer.id}
                    player={p}
                    onSelect={selectPlayer}
                    animationIndex={i}
                    subtitle={<>Bid from: <span className="text-foreground">{buyer?.name || '?'}</span></>}
                    rightContent={
                      <>
                        <p className="text-sm font-bold text-primary">{formatMoney(offer.fee)}</p>
                        <p className="text-[10px] text-muted-foreground">Value: {formatMoney(p.value)}</p>
                        {pctDiff !== 0 && (
                          <p className={cn('text-[10px] font-medium', pctDiff > 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {pctDiff > 0 ? '+' : ''}{pctDiff}% {pctDiff > 0 ? 'above' : 'below'} value
                          </p>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-muted-foreground/70">Wk {offer.week}</span>
                          {perfMult >= HOT_FORM_THRESHOLD ? (
                            <span className="text-[9px] font-medium text-orange-500 bg-orange-500/10 px-1 rounded">Hot form</span>
                          ) : perfMult >= GOOD_FORM_THRESHOLD ? (
                            <span className="text-[9px] font-medium text-blue-400 bg-blue-400/10 px-1 rounded">Good form</span>
                          ) : null}
                          {week - offer.week >= OFFER_EXPIRY_WEEKS - OFFER_EXPIRY_WARNING_WEEKS && (
                            <span className="text-[9px] font-medium text-amber-500 bg-amber-500/10 px-1 rounded">Expiring</span>
                          )}
                        </div>
                      </>
                    }
                    actions={
                      <>
                        <Button
                          size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleRespondToOffer(offer.id, true)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm" className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-700"
                          onClick={() => { hapticMedium(); setNegotiatingOffer(offer); }}
                        >
                          Negotiate
                        </Button>
                        <Button
                          size="sm" variant="destructive" className="flex-1 h-8 text-xs"
                          onClick={() => handleRespondToOffer(offer.id, false)}
                        >
                          Reject
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Players Listed for Sale */}
          {outgoingPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Listed for Sale</p>
              {outgoingPlayers.map(p => {
                const listing = transferMarket.find(l => l.playerId === p.id);
                return (
                  <TransferPlayerCard
                    key={p.id}
                    player={p}
                    onSelect={selectPlayer}
                    showFlag
                    subtitle={<>{p.nationality}</>}
                    rightContent={
                      <>
                        <p className="text-sm font-bold text-primary">{formatMoney(listing ? listing.askingPrice : p.value)}</p>
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <Tag className="w-3 h-3 text-amber-400" />
                          <span className="text-[10px] text-amber-400">Listed</span>
                        </div>
                      </>
                    }
                    actions={
                      <Button
                        size="sm" variant="outline" className="flex-1 h-8 text-xs"
                        onClick={() => handleUnlist(p.id)}
                      >
                        Remove from List
                      </Button>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Incoming Loan Offers */}
          {incomingLoanOffers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Loan Offers Received</p>
              {incomingLoanOffers.map(offer => {
                const p = players[offer.playerId];
                if (!p) return null;
                const fromClub = clubs[offer.fromClubId];
                return (
                  <GlassPanel key={offer.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className={cn(
                          'font-mono font-black text-lg',
                          getRatingColor(p.overall)
                        )}>{p.overall}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} {p.age}y</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          From: <span className="text-foreground">{fromClub?.name || '?'}</span>
                        </p>
                        <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{offer.durationWeeks} weeks</span>
                          <span>Wage: {offer.wageSplit}%</span>
                          {offer.recallClause && <span className="text-primary">Recall clause</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          const r = respondToLoanOffer(offer.id, true);
                          if (r.success) { successToast(r.message); } else { errorToast(r.message); }
                        }}
                      >
                        Accept Loan
                      </Button>
                      <Button
                        size="sm" variant="destructive" className="flex-1 h-8 text-xs"
                        onClick={() => {
                          const r = respondToLoanOffer(offer.id, false);
                          if (r.success) { successToast(r.message); } else { errorToast(r.message); }
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          )}

          {/* Pending Loan Requests (Outgoing) */}
          {outgoingLoanRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pending Loan Requests</p>
              {outgoingLoanRequests.map(req => {
                const p = players[req.playerId];
                if (!p) return null;
                const ownerClub = clubs[req.toClubId];
                return (
                  <GlassPanel key={req.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} OVR {p.overall}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          From: <span className="text-foreground">{ownerClub?.name || '?'}</span>
                        </p>
                        <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{req.durationWeeks} weeks</span>
                          <span>Wage: {req.wageSplit}%</span>
                          {req.recallClause && <span className="text-blue-400">Recall</span>}
                          <span className={cn(
                            'font-semibold',
                            req.status === 'accepted' ? 'text-emerald-400' :
                            req.status === 'rejected' ? 'text-red-400' :
                            req.status === 'counter' ? 'text-amber-400' :
                            'text-muted-foreground'
                          )}>
                            {req.status === 'pending' ? 'Awaiting Response' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          )}

          {/* Active Loans Out */}
          {(() => {
            const loansOut = activeLoans.filter(l => l.fromClubId === playerClubId);
            const loansIn = activeLoans.filter(l => l.toClubId === playerClubId);
            return (
              <>
                {loansOut.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Players Loaned Out</p>
                    {loansOut.map(loan => {
                      const p = players[loan.playerId];
                      if (!p) return null;
                      const destClub = clubs[loan.toClubId];
                      const elapsed = (season - loan.startSeason) * totalWeeks + (week - loan.startWeek);
                      const remaining = Math.max(0, loan.durationWeeks - elapsed);
                      return (
                        <GlassPanel key={loan.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                              <Repeat2 className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                              <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} OVR {p.overall}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                At: <span className="text-foreground">{destClub?.name || '?'}</span>
                              </p>
                              <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                                <span>{remaining} weeks left</span>
                                <span>Wage: {loan.wageSplit}%</span>
                                {loan.obligatoryBuyFee && <span className="text-amber-400">{'\u00A3'}{(loan.obligatoryBuyFee / 1e6).toFixed(1)}M buy</span>}
                              </div>
                            </div>
                          </div>
                          {loan.recallClause && elapsed >= LOAN_MIN_WEEKS_BEFORE_RECALL && (
                            <Button
                              size="sm" variant="outline" className="w-full h-8 text-xs mt-3"
                              onClick={() => {
                                const r = recallLoan(loan.id);
                                if (r.success) { successToast(r.message); } else { errorToast(r.message); }
                              }}
                            >
                              Recall Player
                            </Button>
                          )}
                        </GlassPanel>
                      );
                    })}
                  </div>
                )}

                {loansIn.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Players on Loan (In)</p>
                    {loansIn.map(loan => {
                      const p = players[loan.playerId];
                      if (!p) return null;
                      const parentClub = clubs[loan.fromClubId];
                      const elapsed = (season - loan.startSeason) * totalWeeks + (week - loan.startWeek);
                      const remaining = Math.max(0, loan.durationWeeks - elapsed);
                      return (
                        <GlassPanel key={loan.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                              <Repeat2 className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                              <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} OVR {p.overall}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                From: <span className="text-foreground">{parentClub?.name || '?'}</span>
                              </p>
                              <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                                <span>{remaining} weeks left</span>
                                <span>Wage: {loan.wageSplit}%</span>
                                {loan.obligatoryBuyFee && <span className="text-amber-400">{'\u00A3'}{(loan.obligatoryBuyFee / 1e6).toFixed(1)}M buy clause</span>}
                              </div>
                            </div>
                          </div>
                          {transferWindowOpen && (
                            <Button
                              size="sm" variant="outline" className="w-full h-8 text-xs mt-3"
                              onClick={() => {
                                hapticMedium();
                                const fee = loan.obligatoryBuyFee || Math.round(p.value * LOAN_BUY_FEE_MULTIPLIER);
                                if (fee > (club?.budget || 0)) {
                                  errorToast(`Insufficient funds — need ${formatMoney(fee)}.`);
                                  return;
                                }
                                const r = buyLoanedPlayer(loan.id);
                                if (r.success) { hapticHeavy(); playSfxTransferAccepted(); successToast(r.message); } else { errorToast(r.message); }
                              }}
                            >
                              Buy Permanently — {formatMoney(loan.obligatoryBuyFee || Math.round(p.value * LOAN_BUY_FEE_MULTIPLIER))}
                            </Button>
                          )}
                        </GlassPanel>
                      );
                    })}
                  </div>
                )}

                {loansOut.length === 0 && loansIn.length === 0 && incomingLoanOffers.length === 0 && outgoingLoanRequests.length === 0 && incomingOffers.length === 0 && outgoingPlayers.length === 0 && (
                  <EmptyState
                    icon={ArrowDownLeft}
                    title="No active deals"
                    body="List a player for sale in your squad, or make an offer on the transfer market to start a deal."
                    compact
                  />
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Free Agents */}
      {tab === 'freeAgents' && (
        <div className="space-y-2">
          {freeAgentPlayers.map((p, i) => (
            <TransferPlayerCard
              key={p.id}
              player={p}
              onSelect={selectPlayer}
              showFlag
              showPotential
              animationIndex={i}
              rightContent={
                <>
                  <p className="text-sm font-bold text-emerald-400">FREE</p>
                  <p className="text-[10px] text-muted-foreground">{'\u00A3'}{(p.wage / 1e3).toFixed(0)}K/w</p>
                </>
              }
              actions={
                <Button
                  size="sm" className="w-full h-8 text-xs"
                  onClick={() => { setSigningPlayer(p.id); setOfferWage(p.wage); setOfferYears(FREE_AGENT_DEFAULT_CONTRACT_YEARS); }}
                >
                  Sign Player
                </Button>
              }
            />
          ))}
          {freeAgentPlayers.length === 0 && (
            <EmptyState
              icon={Users}
              title={freeAgents.length === 0 ? 'No free agents available' : 'No free agents match your filters'}
              body={freeAgents.length === 0 ? 'Players become free agents when their contracts expire at season end.' : 'Try adjusting your position or search filters.'}
              compact
            />
          )}
        </div>
      )}

      {/* Transfer News Feed */}
      {tab === 'news' && (() => {
        const { allNews, totalTransfers, totalLoans, totalFreeAgents, totalSpend, biggestDeal, myClubDeals } = newsSummary;
        const { filteredNews, grouped } = filteredGroupedNews;

        return (
          <div className="space-y-3">
            {/* News Summary Stats */}
            {allNews.length > 0 && (
              <GlassPanel className="p-3 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Window Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Total Spend</p>
                    <p className="text-sm font-bold text-primary">{formatMoney(totalSpend)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Deals</p>
                    <p className="text-sm font-bold text-foreground">{allNews.length}</p>
                  </div>
                  {biggestDeal?.fee ? (
                    <div className="bg-muted/30 rounded-lg p-2 col-span-2">
                      <p className="text-[10px] text-muted-foreground">Biggest Deal</p>
                      <p className="text-sm font-bold text-foreground">
                        {biggestDeal.playerName} <span className="text-primary">{formatMoney(biggestDeal.fee)}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
                {myClubDeals.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-muted-foreground">
                      Your club: <span className="text-foreground font-medium">{myClubDeals.length} deal{myClubDeals.length !== 1 ? 's' : ''}</span>
                    </span>
                  </div>
                )}
              </GlassPanel>
            )}

            {/* Type Filter */}
            {allNews.length > 0 && (
              <div className="flex gap-1.5">
                {([
                  { id: 'all' as const, label: 'All', count: allNews.length },
                  { id: 'transfer' as const, label: 'Transfers', count: totalTransfers },
                  { id: 'loan' as const, label: 'Loans', count: totalLoans },
                  { id: 'free_agent' as const, label: 'Free Agents', count: totalFreeAgents },
                ]).map(f => (
                  <button
                    key={f.id}
                    onClick={() => { hapticLight(); setNewsTypeFilter(f.id); }}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium shrink-0 transition-all',
                      newsTypeFilter === f.id
                        ? f.id === 'transfer' ? 'bg-primary/20 text-primary'
                        : f.id === 'loan' ? 'bg-amber-500/20 text-amber-400'
                        : f.id === 'free_agent' ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            )}

            {/* Grouped News Feed */}
            {filteredNews.length > 0 ? (
              Object.entries(grouped).map(([weekLabel, entries]) => (
                <div key={weekLabel} className="space-y-1.5">
                  <div className="flex items-center gap-2 pt-1">
                    <Calendar className="w-3 h-3 text-muted-foreground/50" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{weekLabel}</span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                  {entries.map((entry, i) => {
                    const fromClub = clubs[entry.fromClubId];
                    const toClub = clubs[entry.toClubId];
                    const involvesMyClub = entry.fromClubId === playerClubId || entry.toClubId === playerClubId;
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                      >
                        <GlassPanel className={cn('p-3', involvesMyClub && 'ring-1 ring-primary/30')}>
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                              entry.type === 'transfer' ? 'bg-primary/15 text-primary' :
                              entry.type === 'loan' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-emerald-500/15 text-emerald-400'
                            )}>
                              {entry.type === 'transfer' ? <ArrowUpRight className="w-4 h-4" /> :
                               entry.type === 'loan' ? <Repeat2 className="w-4 h-4" /> :
                               <Users className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold text-foreground">{entry.playerName}</p>
                                {involvesMyClub && (
                                  <span className="text-[8px] font-bold bg-primary/20 text-primary px-1 py-0.5 rounded">YOU</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {entry.playerPosition} {'\u2022'} {entry.playerAge}y {'\u2022'} {entry.playerOverall} OVR
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {entry.type === 'free_agent' ? (
                                  <>Signed by <span className="text-foreground font-medium">{toClub?.shortName || '?'}</span></>
                                ) : (
                                  <>
                                    <span className="text-foreground">{fromClub?.shortName || '?'}</span>
                                    {' \u2192 '}
                                    <span className="text-foreground">{toClub?.shortName || '?'}</span>
                                    {entry.type === 'loan' && entry.loanDuration && (
                                      <span className="text-amber-400 ml-1">({entry.loanDuration}wk loan)</span>
                                    )}
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {entry.fee ? (
                                <span className="text-sm font-bold text-primary">{formatMoney(entry.fee)}</span>
                              ) : entry.type === 'loan' ? (
                                <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">LOAN</span>
                              ) : (
                                <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>
                              )}
                            </div>
                          </div>
                        </GlassPanel>
                      </motion.div>
                    );
                  })}
                </div>
              ))
            ) : allNews.length > 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                <Newspaper className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No {newsTypeFilter === 'transfer' ? 'transfers' : newsTypeFilter === 'loan' ? 'loans' : 'free agent signings'} this season</p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                <Newspaper className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No transfer activity yet this season</p>
                <p className="text-xs text-muted-foreground/60 mt-1">AI club transfers and loans will appear here</p>
              </motion.div>
            )}
          </div>
        );
      })()}

      {/* Free Agent Signing Modal */}
      {signingPlayer && (() => {
        const p = players[signingPlayer];
        if (!p) return null;
        const signingBonus = calculateSigningBonus(offerWage, offerYears);
        const canAfford = (club?.budget || 0) >= signingBonus;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <GlassPanel className="p-5 max-w-sm w-full space-y-4">
              <h3 className="text-base font-bold text-foreground font-display">Sign {p.firstName} {p.lastName}</h3>
              <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} {p.age}y {'\u2022'} OVR {p.overall}</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Weekly Wage</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={Math.round(p.wage * FREE_AGENT_MIN_WAGE_RATIO)}
                    max={Math.round(p.wage * FREE_AGENT_MAX_WAGE_RATIO)}
                    step={1000}
                    value={offerWage}
                    onChange={e => setOfferWage(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-bold text-foreground tabular-nums w-16 text-right">{'\u00A3'}{(offerWage / 1e3).toFixed(0)}K</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contract Length</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(y => (
                    <button
                      key={y}
                      onClick={() => setOfferYears(y)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                        offerYears === y ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                      )}
                    >
                      {y} year{y > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Signing Bonus</span>
                <span className={cn('font-semibold', canAfford ? 'text-foreground' : 'text-destructive')}>
                  {'\u00A3'}{(signingBonus / 1e6).toFixed(1)}M
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">First Year Cost</span>
                <span className="font-semibold text-muted-foreground">
                  {'\u00A3'}{((signingBonus + offerWage * (totalWeeks || 46)) / 1e6).toFixed(1)}M
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Squad Size</span>
                <span className={cn('font-semibold', (club?.playerIds.length || 0) >= MAX_SQUAD_SIZE ? 'text-destructive' : 'text-muted-foreground')}>
                  {club?.playerIds.length || 0} / {MAX_SQUAD_SIZE}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" className="flex-1 h-9 text-xs"
                  disabled={!canAfford || (club?.playerIds.length || 0) >= MAX_SQUAD_SIZE}
                  onClick={() => {
                    const result = signFreeAgent(signingPlayer, offerWage, offerYears);
                    if (result.success) { hapticHeavy(); playSfxTransferAccepted(); successToast(result.message); } else { errorToast(result.message); }
                    setSigningPlayer(null);
                  }}
                >
                  {(club?.playerIds.length || 0) >= MAX_SQUAD_SIZE ? 'Squad Full' : canAfford ? 'Confirm Signing' : 'Cannot Afford'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setSigningPlayer(null)}>
                  Cancel
                </Button>
              </div>
            </GlassPanel>
          </div>
        );
      })()}

      {/* Transfer Negotiation Popup */}
      {negotiatingListing && (
        <TransferNegotiation
          listing={negotiatingListing}
          onClose={() => setNegotiatingListing(null)}
        />
      )}

      {negotiatingOffer && (
        <IncomingOfferNegotiation
          offer={negotiatingOffer}
          onClose={() => setNegotiatingOffer(null)}
        />
      )}

      {/* Confirm Accept Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <GlassPanel className="p-5 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-foreground font-display">Confirm Sale</h3>
            <p className="text-sm text-muted-foreground">
              Accept {'\u00A3'}{(confirmAction.fee / 1e6).toFixed(1)}M for <span className="text-foreground font-medium">{confirmAction.playerName}</span>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm" className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { hapticHeavy(); executeOfferResponse(confirmAction.offerId, true); }}
              >
                Confirm Sale
              </Button>
              <Button
                size="sm" variant="outline" className="flex-1 h-9"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

export default TransferPage;
