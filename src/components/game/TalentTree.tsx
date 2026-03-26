import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { Button } from '@/components/ui/button';
import {
  TALENT_BRANCHES,
  getBranchPerks,
  getCapstonePerk,
  canUnlockPerk,
} from '@/utils/managerPerks';
import type { ManagerPerk, ManagerProgression, PerkId } from '@/types/game';

interface TalentTreeProps {
  progression: ManagerProgression;
  onUnlock: (perkId: PerkId) => void;
}

export function TalentTree({ progression, onUnlock }: TalentTreeProps) {
  const [selectedPerk, setSelectedPerk] = useState<ManagerPerk | null>(null);
  const capstone = getCapstonePerk();
  const isCapstoneUnlocked = progression.unlockedPerks.includes(capstone.id);

  return (
    <div className="space-y-3">
      {/* Capstone Node */}
      <div className="flex justify-center mb-1">
        <TalentNode
          perk={capstone}
          progression={progression}
          isCapstone
          onClick={() => setSelectedPerk(capstone)}
        />
      </div>

      {/* Connection lines from capstone to branches */}
      <div className="flex justify-center">
        <svg width="100%" height="16" viewBox="0 0 320 16" preserveAspectRatio="xMidYMid meet" className="max-w-[320px]">
          {[0, 1, 2, 3].map(i => {
            const x = 40 + i * 80;
            return (
              <line
                key={i}
                x1={160} y1={0} x2={x} y2={16}
                stroke={isCapstoneUnlocked ? 'hsl(43 96% 46%)' : 'hsl(215 20% 25%)'}
                strokeWidth={isCapstoneUnlocked ? 2 : 1}
                strokeDasharray={isCapstoneUnlocked ? undefined : '4 3'}
              />
            );
          })}
        </svg>
      </div>

      {/* Branch Headers */}
      <div className="grid grid-cols-4 gap-1.5">
        {TALENT_BRANCHES.map(branch => {
          const branchPerks = getBranchPerks(branch.id);
          const unlockedCount = branchPerks.filter(p => progression.unlockedPerks.includes(p.id)).length;
          return (
            <div key={branch.id} className="text-center">
              <DynamicIcon name={branch.icon} className={cn('w-4 h-4 mx-auto mb-0.5', branch.color)} />
              <p className={cn('text-[9px] font-bold uppercase tracking-wider', branch.color)}>{branch.name}</p>
              <p className="text-[8px] text-muted-foreground">{unlockedCount}/{branchPerks.length}</p>
            </div>
          );
        })}
      </div>

      {/* Talent Tree Grid — rows 4 down to 0, with connection lines between */}
      {[4, 3, 2, 1, 0].map(row => (
        <div key={row}>
          {/* Connection line from the row above to this row */}
          {row < 4 && (
            <div className="grid grid-cols-4 gap-1.5 -mb-1 pointer-events-none" aria-hidden>
              {TALENT_BRANCHES.map(branch => {
                const upper = getBranchPerks(branch.id).find(p => p.row === row + 1);
                const lower = getBranchPerks(branch.id).find(p => p.row === row);
                if (!upper || !lower) return <div key={branch.id} />;
                const upperUnlocked = progression.unlockedPerks.includes(upper.id);
                const lowerUnlocked = progression.unlockedPerks.includes(lower.id);
                const connected = upperUnlocked || lowerUnlocked;
                return (
                  <div key={branch.id} className="flex justify-center">
                    <div
                      className={cn(
                        'w-0.5 h-3',
                        connected ? 'bg-primary' : 'bg-border/30',
                        !connected && 'border-l border-dashed border-border/50 w-0'
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {/* Perk nodes for this row */}
          <div className="grid grid-cols-4 gap-1.5">
            {TALENT_BRANCHES.map(branch => {
              const perk = getBranchPerks(branch.id).find(p => p.row === row);
              if (!perk) return <div key={branch.id} />;
              return (
                <TalentNode
                  key={perk.id}
                  perk={perk}
                  progression={progression}
                  branchColor={branch.color}
                  onClick={() => setSelectedPerk(perk)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Perk Detail Modal */}
      <AnimatePresence>
        {selectedPerk && (
          <PerkDetailSheet
            perk={selectedPerk}
            progression={progression}
            onUnlock={onUnlock}
            onClose={() => setSelectedPerk(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Individual Talent Node ──

interface TalentNodeProps {
  perk: ManagerPerk;
  progression: ManagerProgression;
  branchColor?: string;
  isCapstone?: boolean;
  onClick: () => void;
}

function TalentNode({ perk, progression, branchColor, isCapstone, onClick }: TalentNodeProps) {
  const isUnlocked = progression.unlockedPerks.includes(perk.id);
  const check = canUnlockPerk(perk, progression);
  const canBuy = check.canUnlock;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all min-w-0',
        isCapstone && 'px-4',
        isUnlocked && 'bg-primary/15',
        canBuy && !isUnlocked && 'bg-blue-500/10',
        !isUnlocked && !canBuy && 'opacity-40',
      )}
      whileTap={{ scale: 0.95 }}
    >
      {/* Node circle */}
      <div
        className={cn(
          'relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
          isCapstone && 'w-12 h-12',
          isUnlocked
            ? 'border-primary bg-primary/20 shadow-[0_0_12px_hsl(43_96%_46%/0.4)]'
            : canBuy
              ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_8px_hsl(215_60%_50%/0.3)]'
              : 'border-border/40 bg-muted/20',
        )}
      >
        <DynamicIcon
          name={perk.icon}
          className={cn(
            'w-5 h-5',
            isCapstone && 'w-6 h-6',
            isUnlocked ? 'text-primary' : canBuy ? 'text-blue-400' : 'text-muted-foreground/50',
          )}
        />
        {/* Pulse ring for available perks */}
        {canBuy && !isUnlocked && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-blue-400/50"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
      {/* Name */}
      <p className={cn(
        'text-[8px] font-semibold leading-tight text-center line-clamp-2 w-full',
        isUnlocked ? (branchColor || 'text-primary') : canBuy ? 'text-foreground' : 'text-muted-foreground/50',
      )}>
        {perk.name}
      </p>
      {/* Cost */}
      {!isUnlocked && (
        <p className={cn(
          'text-[7px]',
          canBuy ? 'text-blue-400' : 'text-muted-foreground/40',
        )}>
          {perk.cost} XP
        </p>
      )}
      {isUnlocked && (
        <p className="text-[7px] text-emerald-400 font-bold">Active</p>
      )}
    </motion.button>
  );
}

// ── Perk Detail Bottom Sheet ──

interface PerkDetailSheetProps {
  perk: ManagerPerk;
  progression: ManagerProgression;
  onUnlock: (perkId: PerkId) => void;
  onClose: () => void;
}

function PerkDetailSheet({ perk, progression, onUnlock, onClose }: PerkDetailSheetProps) {
  const isUnlocked = progression.unlockedPerks.includes(perk.id);
  const check = canUnlockPerk(perk, progression);
  const canBuy = check.canUnlock;
  const branchMeta = TALENT_BRANCHES.find(b => b.id === perk.branch);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-lg bg-card border-t border-border/50 rounded-t-2xl p-5 pb-24 z-10"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4" />

        <div className="flex items-start gap-4">
          <div className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center border-2 shrink-0',
            isUnlocked
              ? 'border-primary bg-primary/20'
              : canBuy
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-border/40 bg-muted/20'
          )}>
            <DynamicIcon
              name={perk.icon}
              className={cn(
                'w-7 h-7',
                isUnlocked ? 'text-primary' : canBuy ? 'text-blue-400' : 'text-muted-foreground',
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={cn('text-base font-bold', isUnlocked ? 'text-primary' : 'text-foreground')}>
                {perk.name}
              </h3>
              {branchMeta && (
                <span className={cn('text-[9px] font-bold uppercase', branchMeta.color)}>
                  {branchMeta.name}
                </span>
              )}
              {perk.branch === 'capstone' && (
                <span className="text-[9px] font-bold uppercase text-primary">Capstone</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{perk.description}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {isUnlocked ? (
            <div className="flex-1 text-center py-2.5 bg-emerald-500/10 rounded-lg">
              <p className="text-sm font-bold text-emerald-400">Active</p>
            </div>
          ) : canBuy ? (
            <Button
              className="flex-1 h-11 bg-primary text-primary-foreground font-bold"
              onClick={() => { onUnlock(perk.id); onClose(); }}
            >
              Unlock — {perk.cost} XP
            </Button>
          ) : (
            <div className="flex-1 text-center py-2.5 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">{check.reason}</p>
            </div>
          )}
          <Button variant="outline" className="h-11 px-4" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
