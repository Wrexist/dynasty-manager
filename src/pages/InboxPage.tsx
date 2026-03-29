import { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Mail, MailOpen, CheckCheck, Trophy, Stethoscope, ArrowLeftRight, TrendingUp, Megaphone, FileText, ChevronDown, ChevronUp, BookOpen, Handshake, Filter, BellDot, ExternalLink, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Message, GameScreen } from '@/types/game';
import { STORYLINE_CHAINS } from '@/data/storylineChains';

const typeIcon: Record<Message['type'], React.ElementType> = {
  match_preview: Trophy,
  match_result: Trophy,
  board: Megaphone,
  injury: Stethoscope,
  transfer: ArrowLeftRight,
  contract: FileText,
  development: TrendingUp,
  sponsorship: Handshake,
  general: Mail,
};

const FILTER_OPTIONS: { label: string; types: Message['type'][]; icon: React.ElementType }[] = [
  { label: 'Match', types: ['match_preview', 'match_result'], icon: Trophy },
  { label: 'Board', types: ['board'], icon: Megaphone },
  { label: 'Transfer', types: ['transfer'], icon: ArrowLeftRight },
  { label: 'Injury', types: ['injury'], icon: Stethoscope },
  { label: 'Contract', types: ['contract'], icon: FileText },
  { label: 'Development', types: ['development'], icon: TrendingUp },
  { label: 'Sponsorship', types: ['sponsorship'], icon: Handshake },
  { label: 'General', types: ['general'], icon: Mail },
];

const InboxPage = () => {
  const { messages, markMessageRead, markAllRead, activeStorylineChains, setScreen, players, openTransferTalk } = useGameStore();
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterOpen]);

  const toggleFilter = (label: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Per-category counts (total + unread) for dropdown badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; unread: number }> = {};
    for (const opt of FILTER_OPTIONS) {
      const matching = messages.filter(m => opt.types.includes(m.type));
      counts[opt.label] = {
        total: matching.length,
        unread: matching.filter(m => !m.read).length,
      };
    }
    return counts;
  }, [messages]);

  // Apply type filters
  const allowedTypes = activeFilters.size > 0
    ? FILTER_OPTIONS.filter(o => activeFilters.has(o.label)).flatMap(o => o.types)
    : [];
  let filtered = allowedTypes.length > 0
    ? messages.filter(m => allowedTypes.includes(m.type))
    : messages;

  // Apply unread-only filter
  if (unreadOnly) {
    filtered = filtered.filter(m => !m.read);
  }

  const filteredUnread = filtered.filter(m => !m.read).length;
  const totalUnread = messages.filter(m => !m.read).length;
  const hasActiveFilter = activeFilters.size > 0 || unreadOnly;
  const activeCount = activeFilters.size + (unreadOnly ? 1 : 0);

  // Filter-aware mark all read
  const handleMarkAllRead = () => {
    if (hasActiveFilter) {
      filtered.forEach(m => { if (!m.read) markMessageRead(m.id); });
    } else {
      markAllRead();
    }
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
    setUnreadOnly(false);
  };

  // Group by week
  const grouped: Record<string, Message[]> = {};
  filtered.forEach(msg => {
    const key = `S${msg.season} W${msg.week}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(msg);
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    markMessageRead(id);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground font-display">Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {hasActiveFilter
              ? `${filteredUnread} unread · ${filtered.length} of ${messages.length} messages`
              : `${totalUnread} unread · ${messages.length} messages`}
          </p>
        </div>
        {(hasActiveFilter ? filteredUnread : totalUnread) > 0 && (
          <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <CheckCheck className="w-3 h-3" />
            {hasActiveFilter ? 'Mark filtered read' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Filter Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setFilterOpen(prev => !prev)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
            hasActiveFilter
              ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Filter className="w-3 h-3" />
          Filter
          {activeCount > 0 && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <ChevronDown className={cn('w-3 h-3 transition-transform', filterOpen && 'rotate-180')} />
        </button>

        {filterOpen && (
          <div className="absolute left-0 top-full mt-1.5 z-50 w-60 bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 space-y-0.5">
              {/* Unread only toggle */}
              <button
                onClick={() => setUnreadOnly(prev => !prev)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors',
                  unreadOnly ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  unreadOnly ? 'bg-primary border-primary' : 'border-border'
                )}>
                  {unreadOnly && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 5.5L4 8L8.5 2" />
                    </svg>
                  )}
                </div>
                <BellDot className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">Unread only</span>
                {totalUnread > 0 && (
                  <span className="ml-auto text-[10px] text-primary font-semibold">{totalUnread}</span>
                )}
              </button>

              <div className="border-t border-border/30 my-1" />

              {/* Category filters */}
              {FILTER_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const checked = activeFilters.has(opt.label);
                const counts = categoryCounts[opt.label];
                return (
                  <button
                    key={opt.label}
                    onClick={() => toggleFilter(opt.label)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors',
                      checked ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      checked ? 'bg-primary border-primary' : 'border-border'
                    )}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1.5 5.5L4 8L8.5 2" />
                        </svg>
                      )}
                    </div>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">{opt.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {counts.unread > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <span className="text-[10px] tabular-nums text-muted-foreground">{counts.total}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {hasActiveFilter && (
              <div className="border-t border-border/50 px-2.5 py-2">
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] text-primary hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Storyline Chains */}
      {activeStorylineChains.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Storylines</p>
          </div>
          <div className="space-y-2">
            {activeStorylineChains.map(chain => {
              const chainDef = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
              const totalSteps = chainDef?.steps.length || 0;
              return (
                <div key={chain.chainId} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{chainDef?.name || chain.chainId}</p>
                    <p className="text-[10px] text-muted-foreground">Step {chain.currentStep + 1} of {totalSteps}</p>
                  </div>
                  <div className="flex gap-0.5 ml-2">
                    {Array.from({ length: totalSteps }, (_, i) => (
                      <div key={i} className={cn('w-2 h-2 rounded-full', i <= chain.currentStep ? 'bg-primary' : 'bg-muted')} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Messages grouped by week */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <GlassPanel className="p-8 text-center">
          <MailOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilter ? 'No messages match your filters' : 'Your inbox is empty'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {hasActiveFilter ? 'Try a different filter or clear all filters below' : 'Messages about transfers, contracts, injuries, and more will appear here as you progress'}
          </p>
          {hasActiveFilter && (
            <button className="text-xs text-primary mt-2 hover:underline" onClick={clearAllFilters}>
              Clear all filters
            </button>
          )}
        </GlassPanel>
        </motion.div>
      ) : (
        Object.entries(grouped).map(([weekKey, msgs]) => (
          <div key={weekKey}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{weekKey}</p>
            <div className="space-y-1.5">
              {msgs.map((msg, msgIdx) => {
                const Icon = typeIcon[msg.type] || Mail;
                const expanded = expandedId === msg.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(msgIdx * 0.03, 0.45), duration: 0.2 }}
                  >
                  <GlassPanel
                    className={cn('transition-all', !msg.read && 'border-primary/30')}
                    onClick={() => toggleExpand(msg.id)}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', !msg.read ? 'bg-primary/20' : 'bg-muted/50')}>
                          <Icon className={cn('w-4 h-4', !msg.read ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={cn('text-sm font-semibold truncate', !msg.read ? 'text-foreground' : 'text-foreground/70')}>{msg.title}</p>
                            {!msg.read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                          </div>
                          {!expanded && <p className="text-xs text-muted-foreground line-clamp-1">{msg.body}</p>}
                        </div>
                        <div className="shrink-0 text-muted-foreground">
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-2 ml-11">
                          <p className="text-xs text-foreground/80 leading-relaxed">{msg.body}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground/60">Season {msg.season} · Week {msg.week}</p>
                            {(() => {
                              // Transfer request messages with a playerId — offer "Talk to Player"
                              if (msg.type === 'transfer' && msg.playerId) {
                                const player = players[msg.playerId];
                                if (player && player.wantsToLeave && !player.listedForSale) {
                                  return (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openTransferTalk(msg.playerId!); setScreen('dashboard'); }}
                                      className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 font-semibold transition-colors"
                                    >
                                      Talk to Player <MessageCircle className="w-3 h-3" />
                                    </button>
                                  );
                                }
                              }
                              const actions: { label: string; screen: GameScreen }[] = [];
                              if (msg.type === 'contract') actions.push({ label: 'View Squad', screen: 'squad' });
                              if (msg.type === 'transfer') actions.push({ label: 'Transfers', screen: 'transfers' });
                              if (msg.type === 'injury') actions.push({ label: 'View Squad', screen: 'squad' });
                              if (msg.type === 'development') actions.push({ label: 'Youth Academy', screen: 'youth-academy' });
                              if (msg.type === 'board') actions.push({ label: 'Board', screen: 'board' });
                              if (actions.length === 0) return null;
                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setScreen(actions[0].screen); }}
                                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-semibold transition-colors"
                                >
                                  {actions[0].label} <ExternalLink className="w-3 h-3" />
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassPanel>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default InboxPage;
