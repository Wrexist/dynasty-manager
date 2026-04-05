import { cn } from '@/lib/utils';
import { MANAGER_TRAITS } from '@/config/managerCareer';
import type { ManagerTraitId, ManagerAttributes } from '@/types/game';
import { ClipboardList, Megaphone, Sprout, Handshake, ShieldCheck, Mic, Dumbbell, Search } from 'lucide-react';

const TRAIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardList,
  Megaphone,
  Sprout,
  Handshake,
  ShieldCheck,
  Mic,
  Dumbbell,
  Search,
};

const ATTRIBUTE_LABELS: Record<keyof ManagerAttributes, string> = {
  tacticalKnowledge: 'Tactical Knowledge',
  motivation: 'Motivation',
  negotiation: 'Negotiation',
  scoutingEye: 'Scouting Eye',
  youthDevelopment: 'Youth Development',
  discipline: 'Discipline',
  mediaHandling: 'Media Handling',
};

interface ManagerTraitPickerProps {
  selected: ManagerTraitId[];
  maxTraits?: number;
  onToggle: (traitId: ManagerTraitId) => void;
}

export function ManagerTraitPicker({ selected, maxTraits = 2, onToggle }: ManagerTraitPickerProps) {
  const traits = Object.values(MANAGER_TRAITS);

  return (
    <div className="grid grid-cols-2 gap-2">
      {traits.map(trait => {
        const isSelected = selected.includes(trait.id);
        const isDisabled = !isSelected && selected.length >= maxTraits;
        const IconComp = TRAIT_ICONS[trait.icon] || ClipboardList;

        return (
          <button
            key={trait.id}
            onClick={() => !isDisabled && onToggle(trait.id)}
            disabled={isDisabled}
            className={cn(
              'text-left rounded-xl p-3 border transition-all duration-200',
              'bg-card/60 backdrop-blur-xl',
              isSelected
                ? 'border-primary/50 bg-primary/10'
                : isDisabled
                  ? 'border-border/20 opacity-40'
                  : 'border-border/50 hover:border-border active:scale-[0.98]',
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <IconComp className={cn('w-4 h-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                {trait.name}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
              {trait.description}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(trait.attributeBonus).map(([key, bonus]) => (
                <span key={key} className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 rounded px-1 py-0.5">
                  +{bonus} {ATTRIBUTE_LABELS[key as keyof ManagerAttributes]}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-primary/70 mt-1 italic">
              {trait.passiveEffect}
            </p>
          </button>
        );
      })}
    </div>
  );
}
