/**
 * Recruitment — who is available, and how much of what you are told is true.
 *
 * The rumour/trialist split is the whole mechanic: a recruit you have only
 * heard about shows numbers that are within `SUNDAY_RECRUIT_RUMOUR_ERROR` of
 * the truth. That used to be stated in a 68-character sentence repeated
 * verbatim on every card, under a pill that already encoded it. The pill now
 * carries a word, the estimated numbers carry a `~`, and the sentence is gone.
 *
 * The noise itself lives in `sundayRecruitReport` — generated from the
 * recruit's own id so it is stable across renders and reloads. A shifting card
 * would read as a bug and would also let a player re-roll the estimate by
 * leaving the screen.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SectionHeader } from '@/components/game/SectionHeader';
import { SundayRecruitCard } from '@/components/game/sunday/SundayRecruitCard';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  SUNDAY_MAX_SQUAD, SUNDAY_RECRUIT_SIGNINGS_PER_SEASON, getSundayArchetype,
} from '@/config/sundayLeague';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { sundayRecruitReport } from '@/utils/sunday/view';
import { sundayFaceSpec } from '@/utils/sunday/visuals';

const SundayRecruit = () => {
  const { t } = useTranslation();
  const { sunday, week } = useGameStore(useShallow(s => ({ sunday: s.sunday, week: s.week })));
  const sign = useGameStore(s => s.signSundayRecruit);
  // Signings are capped per season, so a double tap does not just duplicate a
  // signing — it burns one of the three.
  const [busy, setBusy] = useState<string | null>(null);

  const recruits = useMemo(() => sunday?.recruits ?? [], [sunday]);

  if (!sunday) return null;
  const squadFull = sunday.squad.length >= SUNDAY_MAX_SQUAD;
  const signingsLeft = Math.max(0, SUNDAY_RECRUIT_SIGNINGS_PER_SEASON - sunday.signingsThisSeason);
  const windowClosed = signingsLeft === 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* Both allowances in the header, where the count already was: how many
          names are on the sheet, and how many more may be added this season.
          The second used to be a line of prose under the heading and a second,
          longer line of prose once it ran out. */}
      <SectionHeader
        title={t('sunday.recruit.title')}
        icon={SUNDAY_ICON.recruit}
        accessory={(
          <span className="inline-flex items-center gap-2 text-caption text-muted-foreground tabular-nums">
            <span className={squadFull ? 'text-amber-300' : undefined}>
              {sunday.squad.length}/{SUNDAY_MAX_SQUAD}
            </span>
            <span className={windowClosed ? 'text-amber-300' : undefined}>
              {t('sunday.recruit.signingsLeft', { n: signingsLeft, max: SUNDAY_RECRUIT_SIGNINGS_PER_SEASON })}
            </span>
          </span>
        )}
      />

      {recruits.length === 0 ? (
        <GlassPanel className="p-6 text-center">
          <p className="text-body text-muted-foreground leading-relaxed">{t('sunday.recruit.empty')}</p>
        </GlassPanel>
      ) : (
        <GlassPanel className="p-1.5 space-y-1.5">
          {recruits.map(recruit => {
            const report = sundayRecruitReport(recruit);
            const arch = getSundayArchetype(recruit.member.archetype);
            return (
              <SundayRecruitCard
                key={recruit.id}
                {...sundayFaceSpec(recruit.player)}
                firstName={recruit.player.firstName}
                lastName={recruit.player.lastName}
                position={recruit.player.position}
                age={recruit.player.age}
                archetypeName={arch.name}
                job={recruit.member.job}
                sourceText={recruit.sourceText}
                attributes={report.attributes}
                overall={report.overall}
                revealed={report.revealed}
                fee={recruit.fee}
                weeksLeft={Math.max(0, recruit.expiresWeek - week)}
                disabledReason={
                  squadFull ? 'squad-full'
                    : windowClosed ? 'window-closed'
                      : sunday.balance < recruit.fee ? 'too-expensive'
                        : 'none'
                }
                busy={busy === recruit.id}
                onSign={() => {
                  if (busy) return;
                  setBusy(recruit.id);
                  void sign(recruit.id)
                    .then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); })
                    .finally(() => setBusy(null));
                }}
              />
            );
          })}
        </GlassPanel>
      )}
    </div>
  );
};

export default SundayRecruit;
