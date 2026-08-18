/**
 * Recruitment — who is available, and how much of what you are told is true.
 *
 * The rumour/trialist split is the whole mechanic: a recruit you have only
 * heard about shows numbers that are within `SUNDAY_RECRUIT_RUMOUR_ERROR` of
 * the truth, and the card says so. The noise is generated from the recruit's
 * own id so it is stable across renders and reloads — a shifting card would
 * read as a bug and would also let a player re-roll the estimate by leaving the
 * screen.
 */
import { useMemo } from 'react';
import { Eye, MessageSquare, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { SundayEventModal } from '@/components/game/sunday/SundayEventModal';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { SUNDAY_MAX_SQUAD, SUNDAY_RECRUIT_RUMOUR_ERROR, getSundayArchetype } from '@/config/sundayLeague';
import { subSeed, createSundayRng } from '@/utils/sunday/rng';
import type { PlayerAttributes, SundayRecruit } from '@/types/game';

/** Fixed base for the rumour noise. Any constant works; it only has to be
 *  the SAME constant every time. */
const RUMOUR_SEED = 0x51ac0de;

const ATTR_LABELS: { key: keyof PlayerAttributes; short: string }[] = [
  { key: 'pace', short: 'PAC' },
  { key: 'shooting', short: 'SHO' },
  { key: 'passing', short: 'PAS' },
  { key: 'defending', short: 'DEF' },
  { key: 'physical', short: 'PHY' },
  { key: 'mental', short: 'MEN' },
];

/** What the manager THINKS the recruit is. Derived from the recruit's id so it
 *  never changes between renders, screens or sessions. */
function reportedAttributes(recruit: SundayRecruit): PlayerAttributes {
  if (recruit.revealed) return recruit.player.attributes;
  // Fixed base so the estimate depends only on the recruit, not on when it
  // is rendered.
  const rng = createSundayRng(subSeed(RUMOUR_SEED, recruit.id), 0);
  const out = { ...recruit.player.attributes };
  for (const { key } of ATTR_LABELS) {
    const drift = rng.int(-SUNDAY_RECRUIT_RUMOUR_ERROR, SUNDAY_RECRUIT_RUMOUR_ERROR);
    out[key] = Math.max(1, Math.min(99, out[key] + drift));
  }
  return out;
}

const SundayRecruit = () => {
  const { t } = useTranslation();
  const { sunday, week } = useGameStore(useShallow(s => ({ sunday: s.sunday, week: s.week })));
  const sign = useGameStore(s => s.signSundayRecruit);

  const recruits = useMemo(() => sunday?.recruits ?? [], [sunday]);

  if (!sunday) return null;
  const squadFull = sunday.squad.length >= SUNDAY_MAX_SQUAD;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SundayEventModal />
      <SectionHeader
        title={t('sunday.recruit.title')}
        icon={UserPlus}
        accessory={<span className="text-caption text-muted-foreground">{sunday.squad.length}/{SUNDAY_MAX_SQUAD}</span>}
      />

      {squadFull && (
        <GlassPanel className="p-3" tone="danger">
          <p className="text-caption text-amber-200">{t('sunday.recruit.squadFull')}</p>
        </GlassPanel>
      )}

      {recruits.length === 0 ? (
        <GlassPanel className="p-6 text-center">
          <p className="text-body text-muted-foreground leading-relaxed">{t('sunday.recruit.empty')}</p>
        </GlassPanel>
      ) : (
        recruits.map(recruit => {
          const attrs = reportedAttributes(recruit);
          const arch = getSundayArchetype(recruit.member.archetype);
          const weeksLeft = Math.max(0, recruit.expiresWeek - week);
          return (
            <GlassPanel key={recruit.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-9 text-micro font-semibold text-muted-foreground shrink-0 pt-1">
                  {recruit.player.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-foreground truncate">
                    {recruit.player.firstName} {recruit.player.lastName}
                  </p>
                  <p className="text-micro text-muted-foreground truncate">
                    {recruit.player.age} · {arch.name} · {recruit.member.job}
                  </p>
                </div>
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-micro font-semibold shrink-0',
                  recruit.revealed
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/[0.06] text-muted-foreground border-white/15',
                )}>
                  {recruit.revealed
                    ? <Eye className="w-3 h-3" aria-hidden />
                    : <MessageSquare className="w-3 h-3" aria-hidden />}
                </span>
              </div>

              <p className="text-caption text-muted-foreground leading-relaxed">{recruit.sourceText}</p>

              <div className="grid grid-cols-6 gap-1">
                {ATTR_LABELS.map(({ key, short }) => (
                  <div key={key} className="rounded-lg bg-white/[0.04] px-1 py-1.5 text-center">
                    <p className="text-micro text-muted-foreground">{short}</p>
                    <p className="text-caption font-semibold text-foreground tabular-nums">{attrs[key]}</p>
                  </div>
                ))}
              </div>

              <p className="text-micro text-muted-foreground leading-relaxed">
                {recruit.revealed ? t('sunday.recruit.seen') : t('sunday.recruit.rumour')}
              </p>

              <div className="flex items-center gap-2">
                <LiquidButton
                  tone="primary"
                  className="flex-1 py-2.5"
                  disabled={squadFull || sunday.balance < recruit.fee}
                  onClick={() => { void sign(recruit.id).then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); }); }}
                >
                  <span className="text-caption">
                    {recruit.fee > 0 ? t('sunday.recruit.sign', { n: recruit.fee }) : t('sunday.recruit.signFree')}
                  </span>
                </LiquidButton>
                <span className="text-micro text-muted-foreground shrink-0">
                  {t('sunday.recruit.expires', { n: weeksLeft, s: weeksLeft === 1 ? '' : 's' })}
                </span>
              </div>
            </GlassPanel>
          );
        })
      )}
    </div>
  );
};

export default SundayRecruit;
