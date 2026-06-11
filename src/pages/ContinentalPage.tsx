import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { TournamentHeader } from '@/components/game/TournamentHeader';
import { GroupTable } from '@/components/game/GroupTable';
import { KnockoutBracket } from '@/components/game/KnockoutBracket';
import type { ContinentalCompetition, ContinentalTournamentState } from '@/types/game';
import { cn } from '@/lib/utils';
import { Globe, Trophy } from 'lucide-react';
import { getCurrentMatchday } from '@/utils/continental';
import { getCompetitionCalendar } from '@/config/continental';
import { PageHint } from '@/components/game/PageHint';

function TournamentView({ tournament, competition }: { tournament: ContinentalTournamentState; competition: ContinentalCompetition }) {
  const { playerClubId, clubs, virtualClubs, week, totalWeeks } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    virtualClubs: s.virtualClubs,
    week: s.week,
    totalWeeks: s.totalWeeks,
  })));
  const [tab, setTab] = useState<'groups' | 'knockout'>(tournament.currentPhase === 'knockout' || tournament.currentPhase === 'complete' ? 'knockout' : 'groups');

  const currentMd = tournament.currentPhase === 'group' ? getCurrentMatchday(tournament) : 6;
  const compName = competition === 'champions_cup' ? 'Champions Cup' : competition === 'shield_cup' ? 'Shield Cup' : 'Conference Cup';
  const compStyles = competition === 'champions_cup'
    ? { winnerBg: 'bg-blue-400/10 border border-blue-400/30', text: 'text-blue-400' }
    : competition === 'shield_cup'
    ? { winnerBg: 'bg-orange-400/10 border border-orange-400/30', text: 'text-orange-400' }
    : { winnerBg: 'bg-emerald-400/10 border border-emerald-400/30', text: 'text-emerald-400' };

  const subtitleParts: string[] = [];
  if (tournament.currentPhase === 'group') {
    subtitleParts.push(`Group Stage · Matchday ${currentMd}`);
    const mdWeek = getCompetitionCalendar(totalWeeks).groupWeeks[currentMd - 1];
    if (mdWeek > week) subtitleParts.push(`Week ${mdWeek}`);
  } else if (tournament.currentPhase === 'knockout' && tournament.currentRound) {
    const roundNames: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' };
    subtitleParts.push(`Knockout · ${roundNames[tournament.currentRound] || tournament.currentRound}`);
  } else if (tournament.currentPhase === 'complete') {
    subtitleParts.push('Complete');
  }

  const winnerClubInfo = tournament.winnerId
    ? (clubs[tournament.winnerId] || virtualClubs[tournament.winnerId])
    : null;

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <TournamentHeader
          competition={competition}
          subtitle={subtitleParts.join(' · ')}
          winnerId={tournament.winnerId}
          winnerName={winnerClubInfo?.name}
          playerEliminated={tournament.playerEliminated}
        />
      </motion.div>

      {/* Player status banners */}
      {tournament.playerEliminated && !tournament.winnerId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center"
        >
          <p className="text-sm text-destructive font-medium">Eliminated from the {compName}</p>
        </motion.div>
      )}
      {tournament.winnerId === playerClubId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn(compStyles.winnerBg, 'rounded-xl p-3 text-center')}
        >
          <Trophy className={cn('w-6 h-6 mx-auto mb-1', compStyles.text)} />
          <p className={cn('text-sm font-bold', compStyles.text)}>{compName} Winners!</p>
        </motion.div>
      )}

      {/* Tab navigation — liquid-glass segmented control */}
      <div className="flex gap-1 p-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.28)] relative">
        {(['groups', 'knockout'] as const).map(t => (
          <button
            key={t}
            onClick={() => t === 'knockout' && tournament.knockoutTies.length === 0 ? undefined : setTab(t)}
            disabled={t === 'knockout' && tournament.knockoutTies.length === 0}
            className={cn(
              'flex-1 py-1.5 text-xs font-semibold rounded-full transition-colors relative z-10',
              tab === t ? 'text-foreground' : t === 'knockout' && tournament.knockoutTies.length === 0 ? 'text-muted-foreground/40' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === t && (
              <motion.div
                layoutId="continental-tab"
                className="absolute inset-0 rounded-full bg-white/12 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.25)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t === 'groups' ? 'Groups' : 'Knockout'}</span>
          </button>
        ))}
      </div>

      {/* Content with tab transitions */}
      <AnimatePresence mode="wait">
        {tab === 'groups' && (
          <motion.div
            key="groups"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {tournament.groups
              .sort((a, b) => {
                if (a.id === tournament.playerGroupId) return -1;
                if (b.id === tournament.playerGroupId) return 1;
                return a.id.localeCompare(b.id);
              })
              .map((group, i) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <GroupTable
                    group={group}
                    virtualClubs={virtualClubs}
                    playerClubId={playerClubId}
                    clubs={clubs}
                    isPlayerGroup={group.id === tournament.playerGroupId}
                    currentMatchday={currentMd}
                    competition={competition}
                  />
                </motion.div>
              ))}
          </motion.div>
        )}

        {tab === 'knockout' && tournament.knockoutTies.length > 0 && (
          <motion.div
            key="knockout"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
          >
            <KnockoutBracket
              ties={tournament.knockoutTies}
              virtualClubs={virtualClubs}
              playerClubId={playerClubId}
              clubs={clubs}
              currentRound={tournament.currentRound}
              winnerId={tournament.winnerId}
              competition={competition}
            />
          </motion.div>
        )}

        {tab === 'knockout' && tournament.knockoutTies.length === 0 && (
          <motion.div
            key="knockout-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-muted-foreground py-8"
          >
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Knockout stage has not started yet.</p>
            <p className="text-xs mt-1">Complete the group stage to see the draw.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ContinentalPage = () => {
  const championsCup = useGameStore(s => s.championsCup);
  const shieldCup = useGameStore(s => s.shieldCup);
  const conferenceCup = useGameStore(s => s.conferenceCup);
  const currentScreen = useGameStore(s => s.currentScreen);

  const isChampions = currentScreen === 'champions-cup';
  const isShield = currentScreen === 'shield-cup';
  const tournament = isChampions ? championsCup : isShield ? shieldCup : conferenceCup;
  const competition: ContinentalCompetition = isChampions ? 'champions_cup' : isShield ? 'shield_cup' : 'conference_cup';

  if (!tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground py-12">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {isChampions ? 'You have not qualified for the Champions Cup.' : isShield ? 'You have not qualified for the Shield Cup.' : 'You have not qualified for the Conference Cup.'}
          </p>
          <p className="text-xs mt-1">Finish higher in the league to qualify next season.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <PageHint
        screen="continental"
        title="Continental Competition"
        body="Compete against the best clubs from across the league system. The group stage determines who advances to the knockout rounds. Win the final to claim continental glory and a major reputation boost."
      />

      <TournamentView tournament={tournament} competition={competition} />
    </div>
  );
};

export default ContinentalPage;
