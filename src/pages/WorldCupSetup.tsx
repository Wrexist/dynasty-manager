/**
 * World Cup mode — nation select. Entry point for the standalone World Cup
 * (the whole game is one tournament). Pick a national team, boot via
 * `startWorldCup`, and drop into the squad picker.
 *
 * Mirrors the club new-game flow: the save slot arrives in `location.state`;
 * we set `activeSlot` BEFORE booting (so `startWorldCup`'s internal
 * `resetGame` clears the right slot), then navigate into the game.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Trophy, ArrowRight } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { NATIONS } from '@/data/nations';
import { getFlag } from '@/utils/nationality';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const CONFED_LABEL: Record<string, string> = {
  UEFA: 'Europe', CONMEBOL: 'South America', CAF: 'Africa', AFC: 'Asia', CONCACAF: 'N. America',
};

// Region filter chips — same "browse by region" affordance as club selection,
// so 50+ nations aren't one flat scroll.
const CONFED_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'UEFA', label: 'Europe' },
  { key: 'CONMEBOL', label: 'S. America' },
  { key: 'CAF', label: 'Africa' },
  { key: 'AFC', label: 'Asia' },
  { key: 'CONCACAF', label: 'N. America' },
];

const WorldCupSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const startWorldCup = useGameStore(s => s.startWorldCup);

  const slot = (location.state as { slot?: number } | null)?.slot;
  const missingSlot = slot == null;
  useEffect(() => {
    // Deep link / refresh with no slot — go pick one, don't clobber slot 1.
    if (missingSlot) navigate('/', { replace: true });
  }, [missingSlot, navigate]);

  const [selected, setSelected] = useState<string | null>(null);
  const [confed, setConfed] = useState('all');
  const sorted = useMemo(() => [...NATIONS].sort((a, b) => a.baseRanking - b.baseRanking), []);
  const nations = useMemo(
    () => confed === 'all' ? sorted : sorted.filter(n => n.confederation === confed),
    [sorted, confed],
  );

  if (missingSlot) return null;

  const start = () => {
    if (!selected) return;
    hapticMedium();
    // Target the chosen slot first — startWorldCup → resetGame reads activeSlot.
    useGameStore.setState({ activeSlot: slot });
    startWorldCup(selected);
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-lg mx-auto w-full px-4 pt-4 pb-28 flex-1">
        <button
          type="button"
          onClick={() => navigate('/mode-select', { state: { slot } })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Modes
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
          <Trophy className="w-9 h-9 text-amber-400 mx-auto mb-2" />
          <h1 className="text-2xl font-black text-foreground font-display">Choose Your Nation</h1>
          <p className="text-xs text-muted-foreground mt-1">Lead them through the World Cup — group stage to the final.</p>
        </motion.div>

        {/* Region filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 -mx-1 px-1">
          {CONFED_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { hapticLight(); setConfed(key); }}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors',
                confed === key
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {nations.map((n, i) => {
            const isSel = selected === n.name;
            return (
              <motion.button
                key={n.name}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.012, 0.3) }}
                onClick={() => { hapticLight(); setSelected(n.name); }}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors border',
                  isSel
                    ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_12px_-4px_rgba(245,178,5,0.5)]'
                    : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05]',
                )}
              >
                <span className="text-2xl leading-none shrink-0">{getFlag(n.name)}</span>
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold truncate', isSel ? 'text-amber-300' : 'text-foreground')}>{n.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{CONFED_LABEL[n.confederation] ?? n.confederation}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Sticky start bar */}
      <div className="fixed bottom-0 inset-x-0 safe-area-bottom bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 px-4">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={start}
            disabled={!selected}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-13 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all',
              selected
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-[0_4px_16px_-4px_rgba(245,178,5,0.5)] active:scale-[0.98]'
                : 'bg-white/[0.05] text-foreground/40 border border-white/[0.06]',
            )}
          >
            {selected ? <>Start as {selected} <ArrowRight className="w-4 h-4" /></> : 'Select a nation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorldCupSetup;
