import { useState, useMemo } from 'react';
import { useIncrementalReveal } from '@/hooks/useIncrementalReveal';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShoppingCart, Bookmark, BookmarkCheck, Tag, ArrowDownLeft, Repeat2, Clock, Users, Search, Calendar, Newspaper, X, ArrowUpDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticLight, hapticMedium, hapticHeavy } from '@/utils/haptics';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { TransferListing, IncomingOffer } from '@/types/game';
import { successToast, errorToast, infoToast } from '@/utils/gameToast';
import { POSITION_FILTERS, PAGE_HINTS, SIGNIFICANT_OFFER_OVERALL, SIGNIFICANT_OFFER_FEE, BUDGET_WARNING_THRESHOLD, HOT_FORM_THRESHOLD, GOOD_FORM_THRESHOLD, OFFER_EXPIRY_WARNING_WEEKS } from '@/config/ui';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { IncomingOfferNegotiation } from '@/components/game/IncomingOfferNegotiation';
import { PageHint } from '@/components/game/PageHint';
import { getTransferWindows, OFFER_EXPIRY_WEEKS, FREE_AGENT_DEFAULT_CONTRACT_YEARS, PRE_SEASON_END } from '@/config/transfers';
import { MAX_SQUAD_SIZE, LOAN_MIN_WEEKS_BEFORE_RECALL } from '@/config/gameBalance';
import { formatMoney } from '@/utils/helpers';
import { getPerformanceMultiplier, getMaxFreeAgentOverall, getLoanBuyFee } from '@/utils/transferOffers';
import { TransferPlayerCard } from '@/components/game/TransferPlayerCard';
import { LEAGUES } from '@/data/league';
import { NewsTab } from '@/components/transfer/NewsTab';
import { FreeAgentSigningModal } from '@/components/transfer/FreeAgentSigningModal';

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
  const tw = getTransferWindows(totalWeeks);

  const addToShortlist = useGameStore(s => s.addToShortlist);
  const removeFromShortlist = useGameStore(s => s.removeFromShortlist);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const respondToOffer = useGameStore(s => s.respondToOffer);
  const unlistPlayer = useGameStore(s => s.unlistPlayer);
  const recallLoan = useGameStore(s => s.recallLoan);
  const buyLoanedPlayer = useGameStore(s => s.buyLoanedPlayer);
  const respondToLoanOffer = useGameStore(s => s.respondToLoanOffer);
  const signFreeAgent = useGameStore(s => s.signFreeAgent);
  const cancelLoanRequest = useGameStore(s => s.cancelLoanRequest);
  const setScreen = useGameStore(s => s.setScreen);
  const setTransferFilter = useGameStore(s => s.setTransferFilter);

  // Persistent filters (survive navigation)
  const { tab, posFilter, searchQuery, sortBy, faSortBy, divFilter, newsTypeFilter, hideUnaffordable, showShortlistOnly } = transferFilters;
  const setTab = (v: typeof tab) => setTransferFilter({ tab: v, searchQuery: '' });
  const setPosFilter = (v: number) => setTransferFilter({ posFilter: v });
  const setSearchQuery = (v: string) => setTransferFilter({ searchQuery: v });
  const setSortBy = (v: typeof sortBy) => setTransferFilter({ sortBy: v });
  const setFaSortBy = (v: typeof faSortBy) => setTransferFilter({ faSortBy: v });
  const setDivFilter = (v: string) => setTransferFilter({ divFilter: v });
  const setNewsTypeFilter = (v: typeof newsTypeFilter) => setTransferFilter({ newsTypeFilter: v });
  const setHideUnaffordable = (v: boolean) => setTransferFilter({ hideUnaffordable: v });
  const setShowShortlistOnly = (v: boolean) => setTransferFilter({ showShortlistOnly: v });

  // Transient UI state (resets on navigation — modal/dialog state)
  const [signingPlayer, setSigningPlayer] = useState<string | null>(null);
  const [offerWage, setOfferWage] = useState(0);
  const [offerYears, setOfferYears] = useState(FREE_AGENT_DEFAULT_CONTRACT_YEARS);
  const [negotiatingListing, setNegotiatingListing] = useState<TransferListing | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ offerId: string; accept: boolean; playerName: string; fee: number } | null>(null);
  const [confirmLoanBuy, setConfirmLoanBuy] = useState<{ loanId: string; playerName: string; fee: number } | null>(null);
  const [negotiatingOffer, setNegotiatingOffer] = useState<IncomingOffer | null>(null);
  // Loan responses and recalls are irreversible squad changes that were bare
  // onClicks — one mis-tap and a player is gone (or yanked back) for good.
  const [confirmLoanOffer, setConfirmLoanOffer] = useState<{ offerId: string; accept: boolean; playerName: string; clubName: string } | null>(null);
  const [confirmRecall, setConfirmRecall] = useState<{ loanId: string; playerName: string; clubName: string } | null>(null);

  const club = clubs[playerClubId];
  // At the cap, offers/signings are rejected by the store anyway — disable the
  // buttons up front (with a hint) instead of letting the user negotiate a
  // deal and only then hit a rejection toast.
  const squadFull = (club?.playerIds.length || 0) >= MAX_SQUAD_SIZE;

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
  }, [showShortlistOnly, transferMarket, shortlist, playerClubId, posFilter, players, searchQuery, sortBy, divFilter, clubs, hideUnaffordable, club?.budget]);

  // Outgoing: own players listed for sale. Iterate the club's own roster
  // (~25 ids) — Object.values(players) scanned the entire player universe
  // (thousands) on every players-map change to find these few entries.
  const outgoingPlayers = useMemo(() => {
    return (club?.playerIds || []).map(id => players[id]).filter(p => p && p.listedForSale);
  }, [players, club?.playerIds]);

  // Counts for the market summary row — folded into a memo so the row doesn't
  // re-filter the listings array twice on every render.
  const marketStats = useMemo(() => ({
    fromClubs: listings.filter(l => !l.externalPlayer).length,
    unattached: listings.filter(l => l.externalPlayer).length,
  }), [listings]);

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

  // Render the (potentially hundreds-long) market + free-agent lists in growing
  // chunks so we never mount every image-backed card at once. Resets to the top
  // whenever the filtered list changes.
  const marketReveal = useIncrementalReveal(listings);
  const freeAgentReveal = useIncrementalReveal(freeAgentPlayers);

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
    // Confirm significant offers (player overall >= 70 or fee >= 5M), or all
    // offers if the setting is enabled — for BOTH accept and reject, since a
    // rejected bid is consumed and the deal cannot be recovered.
    const offer = incomingOffers.find(o => o.id === offerId);
    const p = offer ? players[offer.playerId] : null;
    if (p && (confirmAllOffers || p.overall >= SIGNIFICANT_OFFER_OVERALL || (offer && offer.fee >= SIGNIFICANT_OFFER_FEE))) {
      hapticMedium();
      setConfirmAction({ offerId, accept, playerName: `${p.firstName} ${p.lastName}`, fee: offer!.fee });
      return;
    }
    executeOfferResponse(offerId, accept);
  };

  const executeOfferResponse = (offerId: string, accept: boolean) => {
    const result = respondToOffer(offerId, accept);
    if (result.success) {
      if (accept) { hapticMedium(); } else { hapticLight(); }
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

  const runLoanBuy = () => {
    if (!confirmLoanBuy) return;
    const r = buyLoanedPlayer(confirmLoanBuy.loanId);
    if (r.success) { hapticHeavy(); successToast(r.message); } else { errorToast(r.message); }
    setConfirmLoanBuy(null);
  };

  const runLoanOfferResponse = () => {
    if (!confirmLoanOffer) return;
    const r = respondToLoanOffer(confirmLoanOffer.offerId, confirmLoanOffer.accept);
    if (r.success) { hapticMedium(); successToast(r.message); } else { errorToast(r.message); }
    setConfirmLoanOffer(null);
  };

  const runRecall = () => {
    if (!confirmRecall) return;
    const r = recallLoan(confirmRecall.loanId);
    if (r.success) { hapticMedium(); successToast(r.message); } else { errorToast(r.message); }
    setConfirmRecall(null);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint screen="transfers" title={PAGE_HINTS.transfers.title} body={PAGE_HINTS.transfers.body} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground font-display">Transfers</h2>
        {(week === tw.summerEnd || week === tw.winterEnd) ? (
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
            {week <= tw.summerEnd
              ? `${tw.summerEnd - week} wk${tw.summerEnd - week !== 1 ? 's' : ''} left`
              : `${tw.winterEnd - week} wk${tw.winterEnd - week !== 1 ? 's' : ''} left`}
          </span>
        ) : (
          <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-md">
            Closed — opens {week < tw.winterStart ? `Wk ${tw.winterStart}` : 'next season'}
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
              {week < tw.winterStart
                ? `${tw.winterStart - week} weeks until the winter window`
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
          { id: 'deals' as const, icon: ArrowDownLeft, label: 'Deals', count: incomingOffers.length + outgoingPlayers.length + activeLoans.length + incomingLoanOffers.length + outgoingLoanRequests.length },
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
                  // Visual stays a 14px glyph; `after:-inset-2` grows only the
                  // hit area (same trick as SquadPage's Renew chip).
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors after:absolute after:-inset-3 after:content-['']"
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
                  'relative px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                  // Hit area only — keeps the compact toolbar look.
                  'after:absolute after:-inset-2 after:content-[""]',
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
                  'relative px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 transition-all',
                  'after:absolute after:-inset-2 after:content-[""]',
                  hideUnaffordable ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {'\u00A3'}{hideUnaffordable ? '\u2713' : ''}
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
              className="relative flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground hover:text-foreground shrink-0 after:absolute after:-inset-2 after:content-['']"
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
                    'relative px-2 py-0.5 rounded text-[10px] font-medium shrink-0 transition-all',
                    'after:absolute after:-inset-2 after:content-[""]',
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
        <GlassPanel className="p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{marketStats.fromClubs} from clubs</span>
          <span className="text-border">|</span>
          <span>{marketStats.unattached} unattached</span>
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
            const hasFilters = posFilter !== 0 || searchQuery.trim() || divFilter !== 'all' || hideUnaffordable || showShortlistOnly;
            return (
              <GlassPanel className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {hasFilters
                    ? showShortlistOnly ? 'No players in your shortlist' : 'No players match your filters'
                    : 'No players on the transfer market'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {hasFilters
                    ? showShortlistOnly ? 'Tap the bookmark icon on a player to add them' : 'Try adjusting your search, position, or division filters'
                    : 'Check back during the transfer window'}
                </p>
              </GlassPanel>
            );
          })()}
          {marketReveal.visible.map((listing, i) => {
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
                      disabled={!transferWindowOpen || squadFull}
                      onClick={() => handleOffer(listing)}
                    >
                      {squadFull ? 'Squad Full' : 'Make Offer'}
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
          {marketReveal.hasMore && (
            <div ref={marketReveal.sentinelRef} aria-hidden className="h-8" />
          )}
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
                  <TransferPlayerCard
                    key={offer.id}
                    player={p}
                    onSelect={selectPlayer}
                    subtitle={
                      <>
                        <div>From: <span className="text-foreground">{fromClub?.name || '?'}</span></div>
                        <div className="flex gap-3 mt-1 text-[10px]">
                          <span>{offer.durationWeeks} weeks</span>
                          <span>Wage: {offer.wageSplit}%</span>
                          {offer.recallClause && <span className="text-primary">Recall clause</span>}
                        </div>
                      </>
                    }
                    actions={
                      <>
                        <Button
                          size="sm" className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setConfirmLoanOffer({
                            offerId: offer.id, accept: true,
                            playerName: `${p.firstName} ${p.lastName}`,
                            clubName: fromClub?.name || 'the other club',
                          })}
                        >
                          Accept Loan
                        </Button>
                        <Button
                          size="sm" variant="destructive" className="flex-1 h-9 text-xs"
                          onClick={() => setConfirmLoanOffer({
                            offerId: offer.id, accept: false,
                            playerName: `${p.firstName} ${p.lastName}`,
                            clubName: fromClub?.name || 'the other club',
                          })}
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

          {/* Pending Loan Requests (Outgoing) */}
          {outgoingLoanRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pending Loan Requests</p>
              {outgoingLoanRequests.map(req => {
                const p = players[req.playerId];
                if (!p) return null;
                const ownerClub = clubs[req.toClubId];
                // A fresh request for the same player supersedes a pending
                // counter (the slice consumes it), and counters are accepted
                // via acceptLoanCounter. The Cancel action here remains the
                // quickest way to clear a counter without re-negotiating.
                return (
                  <TransferPlayerCard
                    key={req.id}
                    player={p}
                    onSelect={selectPlayer}
                    subtitle={
                      <>
                        <div>From: <span className="text-foreground">{ownerClub?.name || '?'}</span></div>
                        <div className="flex gap-3 mt-1 text-[10px] items-center">
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
                          {req.status === 'counter' && req.counterWageSplit != null && (
                            <span className="text-amber-400/80 ml-auto">
                              wants {req.counterWageSplit}%
                              {req.counterDuration != null && req.counterDuration !== req.durationWeeks ? ` / ${req.counterDuration}w` : ''}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); cancelLoanRequest(req.id); }}
                            className="px-1.5 py-0.5 rounded border border-border/40 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 text-[9px] uppercase tracking-wider"
                          >
                            {req.status === 'counter' ? 'Dismiss' : 'Clear'}
                          </button>
                        </div>
                      </>
                    }
                  />
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
                        <TransferPlayerCard
                          key={loan.id}
                          player={p}
                          onSelect={selectPlayer}
                          subtitle={
                            <>
                              <div>At: <span className="text-foreground">{destClub?.name || '?'}</span></div>
                              <div className="flex gap-3 mt-1 text-[10px] flex-wrap">
                                <span className="inline-flex items-center gap-1 text-blue-400"><Repeat2 className="w-3 h-3" />On loan</span>
                                <span>{remaining}w left</span>
                                <span>Wage: {loan.wageSplit}%</span>
                                {loan.obligatoryBuyFee && <span className="text-amber-400">{'\u00A3'}{(loan.obligatoryBuyFee / 1e6).toFixed(1)}M buy</span>}
                              </div>
                            </>
                          }
                          actions={loan.recallClause && elapsed >= LOAN_MIN_WEEKS_BEFORE_RECALL ? (
                            <Button
                              size="sm" variant="outline" className="w-full h-9 text-xs"
                              onClick={() => setConfirmRecall({
                                loanId: loan.id,
                                playerName: `${p.firstName} ${p.lastName}`,
                                clubName: destClub?.name || 'their loan club',
                              })}
                            >
                              Recall Player
                            </Button>
                          ) : undefined}
                        />
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
                        <TransferPlayerCard
                          key={loan.id}
                          player={p}
                          onSelect={selectPlayer}
                          subtitle={
                            <>
                              <div>From: <span className="text-foreground">{parentClub?.name || '?'}</span></div>
                              <div className="flex gap-3 mt-1 text-[10px] flex-wrap">
                                <span className="inline-flex items-center gap-1 text-blue-400"><Repeat2 className="w-3 h-3" />On loan</span>
                                <span>{remaining}w left</span>
                                <span>Wage: {loan.wageSplit}%</span>
                                {loan.obligatoryBuyFee && <span className="text-amber-400">{'\u00A3'}{(loan.obligatoryBuyFee / 1e6).toFixed(1)}M buy clause</span>}
                              </div>
                            </>
                          }
                          actions={transferWindowOpen ? (
                            <Button
                              size="sm" variant="outline" className="w-full h-8 text-xs"
                              onClick={() => {
                                hapticMedium();
                                const fee = getLoanBuyFee(loan, p);
                                if (fee > (club?.budget || 0)) {
                                  errorToast(`Insufficient funds — need ${formatMoney(fee)}.`);
                                  return;
                                }
                                setConfirmLoanBuy({ loanId: loan.id, playerName: `${p.firstName} ${p.lastName}`, fee });
                              }}
                            >
                              Buy Permanently — {formatMoney(getLoanBuyFee(loan, p))}
                            </Button>
                          ) : undefined}
                        />
                      );
                    })}
                  </div>
                )}

                {loansOut.length === 0 && loansIn.length === 0 && incomingLoanOffers.length === 0 && outgoingLoanRequests.length === 0 && incomingOffers.length === 0 && outgoingPlayers.length === 0 && (
                  <GlassPanel className="p-8 text-center">
                    <ArrowDownLeft className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No active deals.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">List players for sale or browse the market to get started.</p>
                  </GlassPanel>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Free Agents */}
      {tab === 'freeAgents' && (
        <div className="space-y-2">
          {freeAgentReveal.visible.map((p, i) => (
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
                  disabled={squadFull}
                  onClick={() => { setSigningPlayer(p.id); setOfferWage(p.wage); setOfferYears(FREE_AGENT_DEFAULT_CONTRACT_YEARS); }}
                >
                  {squadFull ? 'Squad Full' : 'Sign Player'}
                </Button>
              }
            />
          ))}
          {freeAgentReveal.hasMore && (
            <div ref={freeAgentReveal.sentinelRef} aria-hidden className="h-8" />
          )}
          {freeAgentPlayers.length === 0 && (
            <GlassPanel className="p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{freeAgents.length === 0 ? 'No free agents available.' : 'No free agents match your filters.'}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{freeAgents.length === 0 ? 'Players become free agents when their contracts expire at season end.' : 'Try adjusting your position or search filters.'}</p>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Transfer News Feed */}
      {tab === 'news' && (
        <NewsTab
          newsSummary={newsSummary}
          filteredGroupedNews={filteredGroupedNews}
          clubs={clubs}
          playerClubId={playerClubId}
          newsTypeFilter={newsTypeFilter}
          onSetNewsTypeFilter={setNewsTypeFilter}
        />
      )}

      {/* Free Agent Signing Modal */}
      {signingPlayer && players[signingPlayer] && (
        <FreeAgentSigningModal
          player={players[signingPlayer]}
          club={club}
          offerWage={offerWage}
          offerYears={offerYears}
          totalWeeks={totalWeeks}
          onSetOfferWage={setOfferWage}
          onSetOfferYears={setOfferYears}
          onConfirm={() => {
            const result = signFreeAgent(signingPlayer, offerWage, offerYears);
            if (result.success) { hapticHeavy(); successToast(result.message); } else { errorToast(result.message); }
            setSigningPlayer(null);
          }}
          onCancel={() => setSigningPlayer(null)}
        />
      )}

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

      {/* Irreversible actions all go through ConfirmDialog \u2014 it brings dialog
          semantics, a focus trap, Escape and scroll lock, none of which the
          hand-rolled `fixed inset-0` overlays here had. */}
      <ConfirmDialog
        open={confirmLoanBuy !== null}
        onOpenChange={(open) => { if (!open) setConfirmLoanBuy(null); }}
        title="Sign permanently?"
        description={confirmLoanBuy
          ? `Buy ${confirmLoanBuy.playerName} from their parent club for \u00A3${(confirmLoanBuy.fee / 1e6).toFixed(1)}M? This permanent transfer cannot be undone.`
          : ''}
        confirmLabel="Confirm Signing"
        variant="default"
        onConfirm={runLoanBuy}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmAction?.accept ? 'Confirm Sale' : 'Reject Offer'}
        description={confirmAction
          ? confirmAction.accept
            ? `Accept \u00A3${(confirmAction.fee / 1e6).toFixed(1)}M for ${confirmAction.playerName}? This cannot be undone.`
            : `Reject the \u00A3${(confirmAction.fee / 1e6).toFixed(1)}M bid for ${confirmAction.playerName}? The offer will be withdrawn for good.`
          : ''}
        confirmLabel={confirmAction?.accept ? 'Confirm Sale' : 'Reject Offer'}
        variant={confirmAction?.accept ? 'default' : 'destructive'}
        onConfirm={() => { if (confirmAction) { hapticHeavy(); executeOfferResponse(confirmAction.offerId, confirmAction.accept); } }}
      />

      <ConfirmDialog
        open={confirmLoanOffer !== null}
        onOpenChange={(open) => { if (!open) setConfirmLoanOffer(null); }}
        title={confirmLoanOffer?.accept ? 'Accept loan offer?' : 'Reject loan offer?'}
        description={confirmLoanOffer
          ? confirmLoanOffer.accept
            ? `${confirmLoanOffer.playerName} will join ${confirmLoanOffer.clubName} on loan and be unavailable for selection until the loan ends.`
            : `${confirmLoanOffer.clubName} will withdraw their loan offer for ${confirmLoanOffer.playerName}. This cannot be undone.`
          : ''}
        confirmLabel={confirmLoanOffer?.accept ? 'Accept Loan' : 'Reject'}
        variant={confirmLoanOffer?.accept ? 'default' : 'destructive'}
        onConfirm={runLoanOfferResponse}
      />

      <ConfirmDialog
        open={confirmRecall !== null}
        onOpenChange={(open) => { if (!open) setConfirmRecall(null); }}
        title="Recall player?"
        description={confirmRecall
          ? `Cut ${confirmRecall.playerName}'s loan at ${confirmRecall.clubName} short and bring him back now? The loan cannot be restarted.`
          : ''}
        confirmLabel="Recall"
        onConfirm={runRecall}
      />
    </div>
  );
};

export default TransferPage;
