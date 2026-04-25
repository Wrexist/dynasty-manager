import { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Mail, MailOpen, CheckCheck, Trophy, Stethoscope, ArrowLeftRight, TrendingUp, Megaphone, FileText, ChevronDown, ChevronUp, BookOpen, Handshake, Filter, BellDot, ExternalLink, MessageCircle, Globe, AlertTriangle, Check, Circle, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Message, GameScreen } from '@/types/game';
import type { MessageColorScheme } from '@/types/game';
import { TRANSFER_TALK_RETRY_WEEKS } from '@/config/personality';
import { STORYLINE_CHAINS } from '@/data/storylineChains';
import { PageHint } from '@/components/game/PageHint';

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
  national_team: Globe,
  warning: AlertTriangle,
};

const typeColors: Record<Message['type'], MessageColorScheme> = {
  injury:        { iconBg: 'bg-red-500/20',     iconText: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-500' },
  sponsorship:   { iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  transfer:      { iconBg: 'bg-amber-500/20',   iconText: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-500' },
  contract:      { iconBg: 'bg-orange-500/20',  iconText: 'text-orange-400',  border: 'border-orange-500/30',  dot: 'bg-orange-500' },
  development:   { iconBg: 'bg-blue-500/20',    iconText: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
  board:         { iconBg: 'bg-purple-500/20',   iconText: 'text-purple-400',  border: 'border-purple-500/30',  dot: 'bg-purple-500' },
  match_preview: { iconBg: 'bg-cyan-500/20',    iconText: 'text-cyan-400',    border: 'border-cyan-500/30',    dot: 'bg-cyan-500' },
  match_result:  { iconBg: 'bg-primary/20',     iconText: 'text-primary',     border: 'border-primary/30',     dot: 'bg-primary' },
  general:       { iconBg: 'bg-sky-500/15',      iconText: 'text-sky-400',         border: 'border-sky-500/20',     dot: 'bg-sky-400' },
  national_team: { iconBg: 'bg-teal-500/20',    iconText: 'text-teal-400',       border: 'border-teal-500/30',    dot: 'bg-teal-500' },
  warning:       { iconBg: 'bg-amber-500/20',   iconText: 'text-amber-400',      border: 'border-amber-500/30',   dot: 'bg-amber-500' },
};

const DEFAULT_COLORS: MessageColorScheme = {
  iconBg: 'bg-muted/50',
  iconText: 'text-muted-foreground',
  border: 'border-border/50',
  dot: 'bg-muted-foreground',
};

function getMatchResultColors(msg: Message): MessageColorScheme {
  const t = msg.title.toLowerCase();
  if (t.startsWith('victory') || t.includes('won')) {
    return { iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' };
  }
  if (t.startsWith('defeat') || t.includes('eliminated')) {
    return { iconBg: 'bg-red-500/20', iconText: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' };
  }
  // Draw / neutral match result — use muted semantic tokens instead of a
  // bespoke slate palette so the chip tracks the dark theme's neutral tier.
  return { iconBg: 'bg-muted/30', iconText: 'text-muted-foreground', border: 'border-border/50', dot: 'bg-muted-foreground/70' };
}

function getMessageColors(msg: Message): MessageColorScheme {
  if (msg.type === 'match_result') return getMatchResultColors(msg);
  return typeColors[msg.type] || DEFAULT_COLORS;
}

function getGeneralNavTarget(title: string): { label: string; screen: GameScreen } | null {
  const t = title.toLowerCase();
  if (t.includes('scout report')) return { label: 'Scouting', screen: 'scouting' };
  if (t.includes('upgrade')) return { label: 'Facilities', screen: 'facilities' };
  if (t.includes('campaign')) return { label: 'Merchandise', screen: 'merchandise' };
  if (t.includes('youth intake')) return { label: 'Youth Academy', screen: 'youth-academy' };
  if (t.includes('window') || t.includes('transfer')) return { label: 'Transfers', screen: 'transfers' };
  if (t.includes('achievement')) return { label: 'Trophies', screen: 'trophy-cabinet' };
  if (t.includes('available') || t.includes('settled')) return { label: 'View Squad', screen: 'squad' };
  if (t.includes('between jobs') || t.includes('contract expiring')) return { label: 'Job Market', screen: 'job-market' };
  if (t.includes('reputation') || t.includes('manager of the month')) return { label: 'Profile', screen: 'manager-profile' };
  if (t.includes('hired') || t.includes('released')) return { label: 'Staff', screen: 'staff' };
  return null;
}

function getMessageAction(msg: Message, gameMode: string | undefined): { label: string; screen: GameScreen } | null {
  if (msg.type === 'contract') return gameMode === 'career' ? { label: 'Job Market', screen: 'job-market' } : { label: 'View Squad', screen: 'squad' };
  if (msg.type === 'transfer') return { label: 'Transfers', screen: 'transfers' };
  if (msg.type === 'injury') return { label: 'View Squad', screen: 'squad' };
  if (msg.type === 'development') return { label: 'View Squad', screen: 'squad' };
  if (msg.type === 'board') return { label: 'Board', screen: 'board' };
  if (msg.type === 'sponsorship') return { label: 'Finance', screen: 'finance' };
  if (msg.type === 'match_preview') return { label: 'Match Prep', screen: 'match-prep' };
  if (msg.type === 'match_result') return { label: 'Match Review', screen: 'match-review' };
  if (msg.type === 'general') return getGeneralNavTarget(msg.title);
  if (msg.type === 'national_team') return { label: 'National Team', screen: 'national-team' };
  return null;
}

const FILTER_OPTIONS: { label: string; types: Message['type'][]; icon: React.ElementType; color: string }[] = [
  { label: 'Match', types: ['match_preview', 'match_result'], icon: Trophy, color: 'text-cyan-400' },
  { label: 'Board', types: ['board'], icon: Megaphone, color: 'text-purple-400' },
  { label: 'Transfer', types: ['transfer'], icon: ArrowLeftRight, color: 'text-amber-400' },
  { label: 'Injury', types: ['injury'], icon: Stethoscope, color: 'text-red-400' },
  { label: 'Contract', types: ['contract'], icon: FileText, color: 'text-orange-400' },
  { label: 'Development', types: ['development'], icon: TrendingUp, color: 'text-blue-400' },
  { label: 'Sponsorship', types: ['sponsorship'], icon: Handshake, color: 'text-emerald-400' },
  { label: 'General', types: ['general', 'warning'], icon: Mail, color: 'text-sky-400' },
  { label: 'National Team', types: ['national_team'], icon: Globe, color: 'text-teal-400' },
];

const InboxPage = () => {
  const messages = useGameStore((s) => s.messages);
  const activeStorylineChains = useGameStore((s) => s.activeStorylineChains);
  const players = useGameStore((s) => s.players);
  const week = useGameStore((s) => s.week);
  const gameMode = useGameStore((s) => s.gameMode);
  const markMessageRead = useGameStore((s) => s.markMessageRead);
  const markAllRead = useGameStore((s) => s.markAllRead);
  const setScreen = useGameStore((s) => s.setScreen);
  const loadMatchForReview = useGameStore((s) => s.loadMatchForReview);
  const openTransferTalk = useGameStore((s) => s.openTransferTalk);
  const selectPlayer = useGameStore((s) => s.selectPlayer);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedStoryline, setExpandedStoryline] = useState<string | null>(null);
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
      <PageHint
        screen="inbox"
        title="Inbox"
        body="All club communications in one place — transfer offers, injury updates, board messages, and more. Use the filter to find specific message types. Some messages have actions you can take directly."
      />

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
          <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
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
                    <Icon className={cn('w-3.5 h-3.5 shrink-0', !checked && opt.color)} />
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

      {/* Active Storyline Chains — Collapsible Accordion */}
      {activeStorylineChains.length > 0 && (
        <GlassPanel className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Storylines</p>
            <span className="ml-auto text-[10px] text-muted-foreground/60">{activeStorylineChains.length} active</span>
          </div>
          <div className="px-2 pb-2">
            {activeStorylineChains.map(chain => {
              const chainDef = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
              const totalSteps = chainDef?.steps.length || 0;
              const targetPlayer = chain.targetPlayerId ? players[chain.targetPlayerId] : null;
              const playerDeparted = chain.targetPlayerId && !targetPlayer;
              const playerLabel = targetPlayer
                ? `${targetPlayer.firstName} ${targetPlayer.lastName}`
                : 'your star player';
              // Auto-expand when there's only one storyline, otherwise use toggle state
              const isExpanded = activeStorylineChains.length === 1
                ? expandedStoryline !== chain.chainId  // default open, toggle to close
                : expandedStoryline === chain.chainId;
              // Progress: use choices.length (actual completions) not currentStep
              const progressPct = totalSteps > 0 ? (chain.choices.length / totalSteps) * 100 : 0;

              // Build a step-indexed choice map that handles skipped steps.
              // choices[] is sequential (order of response), so we need to map
              // each choice to its actual step by walking through steps in order.
              const stepChoiceMap: Record<number, number> = {};
              let choiceIdx = 0;
              if (chainDef) {
                for (let si = 0; si <= chain.currentStep && si < chainDef.steps.length; si++) {
                  // A step was responded to if it wasn't skipped (requiredPrevChoice mismatch)
                  // Skipped steps have no entry — choiceIdx stays where it was
                  if (choiceIdx < chain.choices.length) {
                    const step = chainDef.steps[si];
                    const wasSkipped = si > 0
                      && step.requiredPrevChoice !== undefined
                      && stepChoiceMap[si - 1] === undefined  // prev was skipped
                      ? true
                      : si > 0
                        && step.requiredPrevChoice !== undefined
                        && chain.choices.length > 0
                        && (() => {
                            // Find the choice for the preceding step
                            const prevStepChoice = stepChoiceMap[si - 1];
                            return prevStepChoice !== undefined && prevStepChoice !== step.requiredPrevChoice;
                          })()
                        ? true
                        : false;

                    if (!wasSkipped) {
                      stepChoiceMap[si] = chain.choices[choiceIdx];
                      choiceIdx++;
                    }
                  }
                }
              }

              return (
                <div key={chain.chainId} className="mb-1 last:mb-0">
                  {/* Collapsed header — always visible */}
                  <button
                    onClick={() => setExpandedStoryline(prev =>
                      prev === chain.chainId ? null : chain.chainId
                    )}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isExpanded ? 'bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{chainDef?.name || chain.chainId}</p>
                        {targetPlayer && (
                          <span className="text-[10px] text-amber-400 truncate shrink-0">
                            {playerLabel}
                          </span>
                        )}
                        {playerDeparted && (
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">Departed</span>
                        )}
                      </div>
                      {/* Slim progress bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {chain.choices.length}/{totalSteps}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      'w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-300',
                      isExpanded && 'rotate-180'
                    )} />
                  </button>

                  {/* Expanded step timeline */}
                  <AnimatePresence initial={false}>
                    {isExpanded && chainDef && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 pr-3 pt-2 pb-3">
                          {chainDef.steps.map((step, i) => {
                            // Determine step state using choice map, not just currentStep
                            const hasChoice = stepChoiceMap[i] !== undefined;
                            const isActive = i === chain.currentStep;
                            const isCompleted = hasChoice;
                            // "Responded but waiting for next advanceWeek to trigger next step"
                            const isAwaitingAdvance = isActive && hasChoice;
                            // "Current step, user hasn't responded yet"
                            const isPending = isActive && !hasChoice;
                            // Step was skipped due to requiredPrevChoice mismatch
                            const isSkipped = i < chain.currentStep && !hasChoice;
                            const isUpcoming = i > chain.currentStep;
                            const isLast = i === chainDef.steps.length - 1;

                            return (
                              <motion.div
                                key={i}
                                className="flex gap-3"
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.25 }}
                              >
                                {/* Vertical timeline rail */}
                                <div className="flex flex-col items-center">
                                  <div className={cn(
                                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors',
                                    isCompleted && 'bg-primary border-primary',
                                    isPending && 'bg-primary/20 border-primary',
                                    isSkipped && 'bg-muted/40 border-muted-foreground/30',
                                    isUpcoming && 'bg-muted/40 border-muted-foreground/20'
                                  )}>
                                    {isCompleted && <Check className="w-3 h-3 text-primary-foreground" />}
                                    {isPending && <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />}
                                    {isSkipped && <span className="text-[8px] text-muted-foreground/40">—</span>}
                                    {isUpcoming && <Circle className="w-2 h-2 text-muted-foreground/30" />}
                                  </div>
                                  {!isLast && (
                                    <div className={cn(
                                      'w-0.5 flex-1 min-h-[16px] rounded-full',
                                      (isCompleted || isAwaitingAdvance) ? 'bg-primary/50' : 'bg-muted-foreground/15'
                                    )} />
                                  )}
                                </div>
                                {/* Step content */}
                                <div className={cn('pb-3 flex-1 min-w-0', isLast && 'pb-0')}>
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      'text-[9px] tabular-nums font-medium leading-none mt-px',
                                      isCompleted ? 'text-primary/60' : isPending ? 'text-primary' : 'text-muted-foreground/30'
                                    )}>
                                      {i + 1}
                                    </span>
                                    <p className={cn(
                                      'text-xs font-semibold leading-5',
                                      isCompleted && 'text-foreground/60',
                                      isPending && 'text-foreground',
                                      isSkipped && 'text-muted-foreground/40 line-through',
                                      isUpcoming && 'text-muted-foreground/50'
                                    )}>
                                      {step.title}
                                    </p>
                                    {isAwaitingAdvance && (
                                      <Clock className="w-3 h-3 text-primary/50 shrink-0" />
                                    )}
                                  </div>
                                  {isPending && (
                                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                                      {step.body.replace(/\{playerName\}/g, playerLabel)}
                                    </p>
                                  )}
                                  {isCompleted && step.options[stepChoiceMap[i]] && (
                                    <p className="text-[10px] text-primary/70 mt-0.5 truncate">
                                      Chose: {step.options[stepChoiceMap[i]].label}
                                    </p>
                                  )}
                                  {isSkipped && (
                                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">Skipped</p>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
            <button type="button" className="text-xs text-primary mt-2 hover:underline" onClick={clearAllFilters}>
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
                const colors = getMessageColors(msg);
                const action = getMessageAction(msg, gameMode);
                // Transfer talk overrides normal action for unhappy players
                const hasTransferTalk = msg.type === 'transfer' && msg.playerId && !msg.actioned && (() => {
                  const player = players[msg.playerId!];
                  if (!player || !player.wantsToLeave || player.listedForSale) return false;
                  // Prevent spam: hide button during talk retry cooldown
                  if (player.lastTransferTalkWeek && week - player.lastTransferTalkWeek < TRANSFER_TALK_RETRY_WEEKS) return false;
                  return true;
                })();
                const hasAction = hasTransferTalk || !!action;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(msgIdx * 0.03, 0.45), duration: 0.2 }}
                  >
                  <GlassPanel
                    className={cn('transition-all', !msg.read && colors.border)}
                    onClick={() => toggleExpand(msg.id)}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', !msg.read ? colors.iconBg : 'bg-muted/50')}>
                          <Icon className={cn('w-4 h-4', !msg.read ? colors.iconText : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={cn('text-sm font-semibold truncate', !msg.read ? 'text-foreground' : 'text-foreground/70')}>{msg.title}</p>
                            {!msg.read && <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', colors.dot)} />}
                          </div>
                          {!expanded && <p className="text-xs text-muted-foreground line-clamp-1">{msg.body}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!expanded && hasAction && (
                            <ExternalLink className={cn('w-3 h-3', colors.iconText, 'opacity-40')} />
                          )}
                          <div className="text-muted-foreground">
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-2 ml-11">
                          <p className="text-xs text-foreground/80 leading-relaxed">{msg.body}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground/60">Season {msg.season} · Week {msg.week}</p>
                            <div className="flex items-center gap-1.5">
                              {msg.playerId && players[msg.playerId] && !hasTransferTalk && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); selectPlayer(msg.playerId!); }}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:brightness-125 bg-primary/10 text-primary"
                                >
                                  View Player <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                              {hasTransferTalk ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openTransferTalk(msg.playerId!); setScreen('dashboard'); }}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:brightness-125',
                                    colors.iconBg, colors.iconText
                                  )}
                                >
                                  Talk to Player <MessageCircle className="w-3 h-3" />
                                </button>
                              ) : action ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (action.screen === 'match-review') loadMatchForReview(msg.week); setScreen(action.screen); }}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:brightness-125',
                                    colors.iconBg, colors.iconText
                                  )}
                                >
                                  {action.label} <ExternalLink className="w-3 h-3" />
                                </button>
                              ) : null}
                            </div>
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
