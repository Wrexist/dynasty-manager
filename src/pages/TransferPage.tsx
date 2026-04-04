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
import { getRatingColor, getTop3Attributes } from '@/utils/uiHelpers';
import { POSITION_FILTERS } from '@/config/ui';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { IncomingOfferNegotiation } from '@/components/game/IncomingOfferNegotiation';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { formatMoney } from '@/utils/helpers';
import { SIGNIFICANT_OFFER_OVERALL, SIGNIFICANT_OFFER_FEE } from '@/config/ui';
import { getFlag } from '@/utils/nationality';

const TransferPage = () => {
  const {
    transferMarket, players, clubs, playerClubId, shortlist, transferWindowOpen,
    incomingOffers, activeLoans, incomingLoanOffers, outgoingLoanRequests,
    week, season, totalWeeks,
    freeAgents, scouting, transferNews,
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
  })));

  const addToShortlist = useGameStore(s => s.addToShortlist);
  const removeFromShortlist = useGameStore(s => s.removeFromShortlist);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const respondToOffer = useGameStore(s => s.respondToOffer);
  const unlistPlayer = useGameStore(s => s.unlistPlayer);
  const recallLoan = useGameStore(s => s.recallLoan);
  const respondToLoanOffer = useGameStore(s => s.respondToLoanOffer);
  const signFreeAgent = useGameStore(s => s.signFreeAgent);
  const setScreen = useGameStore(s => s.setScreen);

  const [posFilter, setPosFilter] = useState(0);
  const [tab, setTab] = useState<'market' | 'shortlist' | 'incoming' | 'outgoing' | 'loans' | 'freeAgents' | 'news'>('market');
  const [signingPlayer, setSigningPlayer] = useState<string | null>(null);
  const [offerWage, setOfferWage] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  const [negotiatingListing, setNegotiatingListing] = useState<TransferListing | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ offerId: string; accept: boolean; playerName: string; fee: number } | null>(null);
  const [negotiatingOffer, setNegotiatingOffer] = useState<IncomingOffer | null>(null);
  const [sortBy, setSortBy] = useState<'overall' | 'price' | 'age' | 'potential'>('overall');
  const [divFilter, setDivFilter] = useState<string>('all');

  const club = clubs[playerClubId];

  // Filter listings based on active tab
  const listings = useMemo(() => {
    let result = tab === 'shortlist'
      ? transferMarket.filter(l => shortlist.includes(l.playerId))
      : transferMarket.filter(l => l.sellerClubId !== playerClubId);

    if (POSITION_FILTERS[posFilter].positions.length > 0) {
      result = result.filter(l => {
        const p = players[l.playerId];
        return p && POSITION_FILTERS[posFilter].positions.includes(p.position);
      });
    }

    // Division filter
    if (divFilter !== 'all') {
      result = result.filter(l => {
        if (l.divisionId) return l.divisionId === divFilter;
        // Fall back to seller club's division
        const sellerClub = clubs[l.sellerClubId];
        return sellerClub?.divisionId === divFilter;
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
  }, [tab, transferMarket, shortlist, playerClubId, posFilter, players, searchQuery, sortBy, divFilter, clubs]);

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
    return result.sort((a, b) => b.overall - a.overall);
  }, [freeAgents, players, posFilter, searchQuery]);

  const handleOffer = (listing: TransferListing) => {
    if (!transferWindowOpen) {
      errorToast('Transfer window is closed.');
      return;
    }
    hapticMedium();
    setNegotiatingListing(listing);
  };

  const handleRespondToOffer = (offerId: string, accept: boolean) => {
    // Confirm significant offers (player overall >= 70 or fee >= 5M)
    if (accept) {
      const offer = incomingOffers.find(o => o.id === offerId);
      const p = offer ? players[offer.playerId] : null;
      if (p && (p.overall >= SIGNIFICANT_OFFER_OVERALL || (offer && offer.fee >= SIGNIFICANT_OFFER_FEE))) {
        hapticMedium();
        setConfirmAction({ offerId, accept, playerName: `${p.firstName} ${p.lastName}`, fee: offer!.fee });
        return;
      }
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

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* SubNav */}
      <SubNav items={[
        { screen: 'transfers', label: 'Transfers' },
        { screen: 'scouting', label: 'Scouting' },
      ]} />

      <PageHint screen="transfers" title={PAGE_HINTS.transfers.title} body={PAGE_HINTS.transfers.body} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground font-display">Transfers</h2>
        {transferWindowOpen ? (
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

      {/* Budget */}
      <GlassPanel className="p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Available Budget</span>
        <AnimatedNumber
          value={club?.budget || 0}
          formatFn={(n) => '\u00A3' + (n / 1e6).toFixed(1) + 'M'}
          className="text-lg font-black text-primary tabular-nums"
        />
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

      {/* 4 Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {([
          { id: 'market' as const, icon: ShoppingCart, label: 'Market' },
          { id: 'shortlist' as const, icon: BookmarkCheck, label: `Shortlist (${shortlist.length})` },
          { id: 'incoming' as const, icon: ArrowDownLeft, label: `Incoming (${incomingOffers.length})` },
          { id: 'outgoing' as const, icon: ArrowUpRight, label: `Outgoing (${outgoingPlayers.length})` },
          { id: 'loans' as const, icon: Repeat2, label: `Loans (${activeLoans.length})` },
          { id: 'freeAgents' as const, icon: Users, label: `Free (${freeAgents.length})` },
          { id: 'news' as const, icon: Newspaper, label: `News (${(transferNews || []).length})` },
        ] as const).map(({ id, icon: TabIcon, label }) => (
          <button
            key={id}
            onClick={() => { hapticLight(); setTab(id); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors relative',
              tab === id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <TabIcon className="w-3.5 h-3.5" /> {label}
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

      {/* Search + Position Filter (for market, shortlist, and free agents tabs) */}
      {(tab === 'market' || tab === 'shortlist' || tab === 'freeAgents') && (
        <>
          {/* Search Input */}
          <label htmlFor="transfer-search" className="sr-only">Search player name</label>
          <div className="relative">
            <input
              id="transfer-search"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search player name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg text-sm bg-card/60 backdrop-blur-xl border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Position Filter */}
          <div className="flex gap-2">
            {POSITION_FILTERS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => { hapticLight(); setPosFilter(i); }}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-all active:scale-[0.95]',
                  posFilter === i ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Division Filter & Sort (market tab only) */}
          {tab === 'market' && (
            <div className="flex items-center gap-2">
              {/* Division Filter */}
              <div className="flex gap-1 flex-1 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'all', label: 'All Leagues' },
                  { id: 'div-1', label: 'Div 1' },
                  { id: 'div-2', label: 'Div 2' },
                  { id: 'div-3', label: 'Div 3' },
                  { id: 'div-4', label: 'Div 4' },
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => { hapticLight(); setDivFilter(d.id); }}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-medium shrink-0 transition-all',
                      divFilter === d.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <button
                onClick={() => {
                  hapticLight();
                  const opts: typeof sortBy[] = ['overall', 'price', 'age', 'potential'];
                  const next = opts[(opts.indexOf(sortBy) + 1) % opts.length];
                  setSortBy(next);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortBy === 'overall' ? 'OVR' : sortBy === 'price' ? 'Price' : sortBy === 'age' ? 'Age' : 'POT'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Market Stats Summary */}
      {tab === 'market' && (
        <GlassPanel className="p-2.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{transferMarket.filter(l => l.sellerClubId !== playerClubId).length} listed</span>
          <span className="text-border">|</span>
          <span>{freeAgents.length} free agents</span>
          <span className="text-border">|</span>
          <span>{listings.length} match{listings.length !== 1 ? 'es' : ''}</span>
        </GlassPanel>
      )}

      {/* Market / Shortlist Listings */}
      {(tab === 'market' || tab === 'shortlist') && (
        <div className="space-y-2">
          {listings.length === 0 && (
            <GlassPanel className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {tab === 'shortlist' ? 'No players in your shortlist' : 'No players on the transfer market'}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {tab === 'shortlist' ? 'Tap the star icon on a player to add them' : 'Check back during the transfer window'}
              </p>
            </GlassPanel>
          )}
          {listings.map((listing, i) => {
            const p = players[listing.playerId];
            if (!p) return null;
            const seller = clubs[listing.sellerClubId];
            const inShortlist = shortlist.includes(p.id);
            const top3 = getTop3Attributes(p.attributes);

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.2 }}
              >
              <GlassPanel className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className={cn(
                      'font-mono font-black text-lg',
                      getRatingColor(p.overall)
                    )}>{p.overall}</span>
                  </div>
                  <div className="flex-1 min-w-0" role="button" tabIndex={0} aria-label={`View ${p.firstName} ${p.lastName}`} onClick={() => selectPlayer(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(p.id); } }}>
                    <p className="font-bold text-foreground text-sm">{getFlag(p.nationality)} {p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.position} {'\u2022'} {p.age}y {'\u2022'} POT {p.potential || p.overall}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {listing.externalPlayer ? (
                        <span className="text-amber-400">Unattached</span>
                      ) : (
                        <>From: {seller?.shortName || '?'}</>
                      )}
                      {listing.divisionId && (
                        <span className="ml-1 text-[10px] text-muted-foreground/60">
                          ({listing.divisionId === 'div-1' ? 'D1' : listing.divisionId === 'div-2' ? 'D2' : listing.divisionId === 'div-3' ? 'D3' : 'D4'})
                        </span>
                      )}
                    </p>
                    {/* Top 3 Attributes */}
                    <div className="flex gap-2 mt-1.5">
                      {top3.map(attr => (
                        <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                          <span className="text-muted-foreground">{attr.label}</span>{' '}
                          <span className={cn(
                            'font-bold',
                            getRatingColor(attr.value)
                          )}>{attr.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        listing.askingPrice > (club?.budget || 0) ? 'bg-destructive' :
                        listing.askingPrice > (club?.budget || 0) * 0.5 ? 'bg-amber-400' : 'bg-emerald-400'
                      )} />
                      <p className="text-sm font-bold text-primary">{'\u00A3'}{(listing.askingPrice / 1e6).toFixed(1)}M</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{'\u00A3'}{(p.wage / 1e3).toFixed(0)}K/w</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
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
                </div>
              </GlassPanel>
              </motion.div>
            );
          })}
          {listings.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
              <Bookmark className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {tab === 'shortlist' ? 'No players in shortlist' : 'No players available'}
              </p>
              {tab === 'shortlist' && (
                <p className="text-xs text-muted-foreground/60 mt-1">Bookmark players from the market to track them here</p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Incoming Offers */}
      {tab === 'incoming' && (
        <div className="space-y-2">
          {incomingOffers.map((offer, i) => {
            const p = players[offer.playerId];
            if (!p) return null;
            const buyer = clubs[offer.buyerClubId];
            const top3 = getTop3Attributes(p.attributes);

            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.2 }}
              >
              <GlassPanel className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className={cn(
                      'font-mono font-black text-lg',
                      getRatingColor(p.overall)
                    )}>{p.overall}</span>
                  </div>
                  <div className="flex-1 min-w-0" role="button" tabIndex={0} aria-label={`View ${p.firstName} ${p.lastName}`} onClick={() => selectPlayer(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(p.id); } }}>
                    <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} {p.age}y</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Bid from: <span className="text-foreground">{buyer?.name || '?'}</span></p>
                    <div className="flex gap-2 mt-1.5">
                      {top3.map(attr => (
                        <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                          <span className="text-muted-foreground">{attr.label}</span>{' '}
                          <span className={cn(
                            'font-bold',
                            getRatingColor(attr.value)
                          )}>{attr.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{'\u00A3'}{(offer.fee / 1e6).toFixed(1)}M</p>
                    <p className="text-[10px] text-muted-foreground">Value: {'\u00A3'}{(p.value / 1e6).toFixed(1)}M</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
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
                </div>
              </GlassPanel>
              </motion.div>
            );
          })}
          {incomingOffers.length === 0 && (
            <GlassPanel className="p-8 text-center">
              <ArrowDownLeft className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No incoming offers.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">List players for sale to attract bids from other clubs.</p>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Outgoing (Listed for Sale) */}
      {tab === 'outgoing' && (
        <div className="space-y-2">
          {outgoingPlayers.map(p => {
            const listing = transferMarket.find(l => l.playerId === p.id);
            const top3 = getTop3Attributes(p.attributes);

            return (
              <GlassPanel key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className={cn(
                      'font-mono font-black text-lg',
                      getRatingColor(p.overall)
                    )}>{p.overall}</span>
                  </div>
                  <div className="flex-1 min-w-0" role="button" tabIndex={0} aria-label={`View ${p.firstName} ${p.lastName}`} onClick={() => selectPlayer(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(p.id); } }}>
                    <p className="font-bold text-foreground text-sm">{getFlag(p.nationality)} {p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} {p.age}y {'\u2022'} {p.nationality}</p>
                    <div className="flex gap-2 mt-1.5">
                      {top3.map(attr => (
                        <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                          <span className="text-muted-foreground">{attr.label}</span>{' '}
                          <span className={cn(
                            'font-bold',
                            getRatingColor(attr.value)
                          )}>{attr.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{'\u00A3'}{listing ? (listing.askingPrice / 1e6).toFixed(1) : (p.value / 1e6).toFixed(1)}M</p>
                    <div className="flex items-center gap-1 mt-0.5 justify-end">
                      <Tag className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-400">Listed</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm" variant="outline" className="flex-1 h-8 text-xs"
                    onClick={() => handleUnlist(p.id)}
                  >
                    Remove from List
                  </Button>
                </div>
              </GlassPanel>
            );
          })}
          {outgoingPlayers.length === 0 && (
            <GlassPanel className="p-8 text-center">
              <ArrowUpRight className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No players listed for sale.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Go to Squad to list players on the transfer market.</p>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Loans Tab */}
      {tab === 'loans' && (
        <div className="space-y-4">
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
                          {loan.recallClause && elapsed >= 4 && (
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
                              </div>
                            </div>
                          </div>
                        </GlassPanel>
                      );
                    })}
                  </div>
                )}

                {loansOut.length === 0 && loansIn.length === 0 && incomingLoanOffers.length === 0 && outgoingLoanRequests.length === 0 && (
                  <GlassPanel className="p-8 text-center">
                    <Repeat2 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No active loans.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">AI clubs may offer loan deals for your fringe players during the transfer window.</p>
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
          {freeAgentPlayers.map((p, i) => {
            const top3 = getTop3Attributes(p.attributes);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.2 }}
              >
              <GlassPanel className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className={cn('font-mono font-black text-lg', getRatingColor(p.overall))}>{p.overall}</span>
                  </div>
                  <div className="flex-1 min-w-0" role="button" tabIndex={0} aria-label={`View ${p.firstName} ${p.lastName}`} onClick={() => selectPlayer(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(p.id); } }}>
                    <p className="font-bold text-foreground text-sm">{getFlag(p.nationality)} {p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.position} {'\u2022'} {p.age}y {'\u2022'} POT {p.potential || p.overall}
                    </p>
                    <div className="flex gap-2 mt-1.5">
                      {top3.map(attr => (
                        <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                          <span className="text-muted-foreground">{attr.label}</span>{' '}
                          <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">FREE</p>
                    <p className="text-[10px] text-muted-foreground">{'\u00A3'}{(p.wage / 1e3).toFixed(0)}K/w</p>
                  </div>
                </div>
                <Button
                  size="sm" className="w-full h-8 text-xs mt-3"
                  onClick={() => { setSigningPlayer(p.id); setOfferWage(p.wage); setOfferYears(2); }}
                >
                  Sign Player
                </Button>
              </GlassPanel>
              </motion.div>
            );
          })}
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
        <div className="space-y-2">
          {(transferNews || []).length > 0 ? (
            [...(transferNews || [])].reverse().map((entry, i) => {
              const fromClub = clubs[entry.fromClubId];
              const toClub = clubs[entry.toClubId];
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                >
                  <GlassPanel className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                        entry.type === 'transfer' ? 'bg-primary/15 text-primary' :
                        entry.type === 'loan' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-emerald-500/15 text-emerald-400'
                      )}>
                        {entry.type === 'transfer' ? <ArrowUpRight className="w-4 h-4" /> :
                         entry.type === 'loan' ? <Repeat2 className="w-4 h-4" /> :
                         <Users className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{entry.playerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.playerPosition} {'\u2022'} {entry.playerAge}y {'\u2022'} {entry.playerOverall} OVR
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.type === 'free_agent' ? (
                            <>Signed by <span className="text-foreground">{toClub?.shortName || '?'}</span> (free agent)</>
                          ) : (
                            <>
                              <span className="text-foreground">{fromClub?.shortName || '?'}</span>
                              {' → '}
                              <span className="text-foreground">{toClub?.shortName || '?'}</span>
                              {entry.type === 'loan' && entry.loanDuration && ` (${entry.loanDuration}wk loan)`}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {entry.fee ? (
                          <span className="text-sm font-bold text-primary">{formatMoney(entry.fee)}</span>
                        ) : entry.type === 'loan' ? (
                          <span className="text-xs font-medium text-amber-400">LOAN</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-400">FREE</span>
                        )}
                        <p className="text-[10px] text-muted-foreground">Wk {entry.week}</p>
                      </div>
                    </div>
                  </GlassPanel>
                </motion.div>
              );
            })
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
              <Newspaper className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No transfer activity yet this season</p>
              <p className="text-xs text-muted-foreground/60 mt-1">AI club transfers and loans will appear here</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Free Agent Signing Modal */}
      {signingPlayer && (() => {
        const p = players[signingPlayer];
        if (!p) return null;
        const signingBonus = Math.round(offerWage * offerYears * 4);
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
                    min={Math.round(p.wage * 0.5)}
                    max={Math.round(p.wage * 2)}
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
              <div className="flex gap-2">
                <Button
                  size="sm" className="flex-1 h-9 text-xs"
                  disabled={!canAfford}
                  onClick={() => {
                    const result = signFreeAgent(signingPlayer, offerWage, offerYears);
                    if (result.success) { hapticHeavy(); successToast(result.message); } else { errorToast(result.message); }
                    setSigningPlayer(null);
                  }}
                >
                  {canAfford ? 'Confirm Signing' : 'Cannot Afford'}
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
