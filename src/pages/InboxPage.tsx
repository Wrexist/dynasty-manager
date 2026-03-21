import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Mail, MailOpen, CheckCheck, Trophy, Stethoscope, ArrowLeftRight, TrendingUp, Megaphone, FileText, ChevronDown, ChevronUp, BookOpen, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/types/game';
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

const CATEGORY_FILTERS: { label: string; types: Message['type'][] }[] = [
  { label: 'All', types: [] },
  { label: 'Board', types: ['board'] },
  { label: 'Transfer', types: ['transfer'] },
  { label: 'Match', types: ['match_preview', 'match_result'] },
  { label: 'Player', types: ['development', 'injury', 'contract'] },
  { label: 'Sponsors', types: ['sponsorship'] },
];

const InboxPage = () => {
  const { messages, markMessageRead, markAllRead, activeStorylineChains } = useGameStore();
  const [category, setCategory] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unread = messages.filter(m => !m.read).length;

  const filtered = CATEGORY_FILTERS[category].types.length > 0
    ? messages.filter(m => CATEGORY_FILTERS[category].types.includes(m.type))
    : messages;

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
          <p className="text-xs text-muted-foreground">{unread} unread · {filtered.length} messages</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <CheckCheck className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {CATEGORY_FILTERS.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setCategory(i)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              category === i
                ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {cat.label}
          </button>
        ))}
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
        <GlassPanel className="p-8 text-center">
          <MailOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {category > 0 ? `No ${CATEGORY_FILTERS[category].label.toLowerCase()} messages` : 'No messages'}
          </p>
          {category > 0 && (
            <button className="text-xs text-primary mt-2 hover:underline" onClick={() => setCategory(0)}>
              Clear filter
            </button>
          )}
        </GlassPanel>
      ) : (
        Object.entries(grouped).map(([weekKey, msgs]) => (
          <div key={weekKey}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{weekKey}</p>
            <div className="space-y-1.5">
              {msgs.map(msg => {
                const Icon = typeIcon[msg.type] || Mail;
                const expanded = expandedId === msg.id;
                return (
                  <GlassPanel
                    key={msg.id}
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
                          <p className="text-[10px] text-muted-foreground/60 mt-2">Season {msg.season} · Week {msg.week}</p>
                        </div>
                      )}
                    </div>
                  </GlassPanel>
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
