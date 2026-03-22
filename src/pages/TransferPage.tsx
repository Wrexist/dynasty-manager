import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShoppingCart, Bookmark, BookmarkCheck, Tag, ArrowDownLeft, ArrowUpRight, Repeat2, Clock, Users, Search, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticMedium } from '@/utils/haptics';
import { TransferListing } from '@/types/game';
import { successToast, errorToast, infoToast } from '@/utils/gameToast';
import { getRatingColor, getTop3Attributes } from '@/utils/uiHelpers';
import { POSITION_FILTERS } from '@/config/ui';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { getFlag } from '@/utils/nationality';

const TransferPage = () => {
  const {
    transferMarket, players, clubs, playerClubId, shortlist, transferWindowOpen,
    addToShortlist, removeFromShortlist, selectPlayer,
    incomingOffers, respondToOffer, unlistPlayer,
    activeLoans, incomingLoanOffers, recallLoan, respondToLoanOffer,
    week, season, totalWeeks,
    freeAgents, signFreeAgent,
    setScreen, scouting,
  } = useGameStore();

  const [posFilter, setPosFilter] = useState(0);
  const [tab, setTab] = useState<'market' | 'shortlist' | 'incoming' | 'outgoing' | 'loans' | 'freeAgents'>('market');
  const [signingPlayer, setSigningPlayer] = useState<string | null>(null);
  const [offerWage, setOfferWage] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  const [negotiatingListing, setNegotiatingListing] = useState<TransferListing | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ offerId: string; accept: boolean; playerName: string; fee: number } | null>(null);

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

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l => {
        const p = players[l.playerId];
        if (!p) return false;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return fullName.includes(q);
      });
    }

    result.sort((a, b) => (players[b.playerId]?.overall || 0) - (players[a.playerId]?.overall || 0));
    return result;
  }, [tab, transferMarket, shortlist, playerClubId, posFilter, players, searchQuery]);

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
      if (p && (p.overall >= 70 || (offer && offer.fee >= 5_000_000))) {
        setConfirmAction({ offerId, accept, playerName: `${p.firstName} ${p.lastName}`, fee: offer!.fee });
        return;
      }
    }
    executeOfferResponse(offerId, accept);
  };

  const executeOfferResponse = (offerId: string, accept: boolean) => {
    const result = respondToOffer(offerId, accept);
    if (result.success) {
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
        <span className="text-lg font-black text-primary">{'\u00A3'}{((club?.budget || 0) / 1e6).toFixed(1)}M</span>
      </GlassPanel>

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
        <button
          onClick={() => setTab('market')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-all',
            tab === 'market' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <ShoppingCart className="w-3.5 h-3.5" /> Market
        </button>
        <button
          onClick={() => setTab('shortlist')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-all',
            tab === 'shortlist' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <BookmarkCheck className="w-3.5 h-3.5" /> Shortlist ({shortlist.length})
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-all',
            tab === 'incoming' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" /> Incoming ({incomingOffers.length})
        </button>
        <button
          onClick={() => setTab('outgoing')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-all',
            tab === 'outgoing' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5" /> Outgoing ({outgoingPlayers.length})
        </button>
        <button
          onClick={() => setTab('loans')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-all',
            tab === 'loans' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <Repeat2 className="w-3.5 h-3.5" /> Loans ({activeLoans.length})
        </button>
        <button
          onClick={() => setTab('freeAgents')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-all',
            tab === 'freeAgents' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <Users className="w-3.5 h-3.5" /> Free ({freeAgents.length})
        </button>
      </div>

      {/* Search + Position Filter (for market, shortlist, and free agents tabs) */}
      {(tab === 'market' || tab === 'shortlist' || tab === 'freeAgents') && (
        <>
          {/* Search Input */}
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search player name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-card/60 backdrop-blur-xl border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />

          {/* Position Filter */}
          <div className="flex gap-2">
            {POSITION_FILTERS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setPosFilter(i)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-all',
                  posFilter === i ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Market / Shortlist Listings */}
      {(tab === 'market' || tab === 'shortlist') && (
        <div className="space-y-2">
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
                  <div className="flex-1 min-w-0" onClick={() => selectPlayer(p.id)}>
                    <p className="font-bold text-foreground text-sm">{getFlag(p.nationality)} {p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} {p.age}y {'\u2022'} {p.nationality}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">From: {seller?.shortName || '?'}</p>
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
                    onClick={() => inShortlist ? removeFromShortlist(p.id) : addToShortlist(p.id)}
                  >
                    {inShortlist ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                  </Button>
                </div>
              </GlassPanel>
              </motion.div>
            );
          })}
          {listings.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {tab === 'shortlist' ? 'No players in shortlist' : 'No players available'}
            </p>
          )}
        </div>
      )}

      {/* Incoming Offers */}
      {tab === 'incoming' && (
        <div className="space-y-2">
          {incomingOffers.map(offer => {
            const p = players[offer.playerId];
            if (!p) return null;
            const buyer = clubs[offer.buyerClubId];
            const top3 = getTop3Attributes(p.attributes);

            return (
              <GlassPanel key={offer.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className={cn(
                      'font-mono font-black text-lg',
                      getRatingColor(p.overall)
                    )}>{p.overall}</span>
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => selectPlayer(p.id)}>
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
                    size="sm" variant="destructive" className="flex-1 h-8 text-xs"
                    onClick={() => handleRespondToOffer(offer.id, false)}
                  >
                    Reject
                  </Button>
                </div>
              </GlassPanel>
            );
          })}
          {incomingOffers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No incoming offers. List players for sale to attract bids.
            </p>
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
                  <div className="flex-1 min-w-0" onClick={() => selectPlayer(p.id)}>
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
            <p className="text-sm text-muted-foreground text-center py-8">
              No players listed for sale. Go to Squad to list players.
            </p>
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

                {loansOut.length === 0 && loansIn.length === 0 && incomingLoanOffers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No active loans. AI clubs may offer loan deals for your fringe players during the transfer window.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Free Agents */}
      {tab === 'freeAgents' && (
        <div className="space-y-2">
          {freeAgentPlayers.map(p => {
            const top3 = getTop3Attributes(p.attributes);
            return (
              <GlassPanel key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className={cn('font-mono font-black text-lg', getRatingColor(p.overall))}>{p.overall}</span>
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => selectPlayer(p.id)}>
                    <p className="font-bold text-foreground text-sm">{getFlag(p.nationality)} {p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground">{p.position} {'\u2022'} {p.age}y {'\u2022'} {p.nationality}</p>
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
            );
          })}
          {freeAgentPlayers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {freeAgents.length === 0 ? 'No free agents available. Players become free agents when their contracts expire at season end.' : 'No free agents match your filters.'}
            </p>
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
                    if (result.success) { successToast(result.message); } else { errorToast(result.message); }
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
                onClick={() => executeOfferResponse(confirmAction.offerId, true)}
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
