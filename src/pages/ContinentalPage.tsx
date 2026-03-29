import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { TournamentHeader } from '@/components/game/TournamentHeader';
import { GroupTable } from '@/components/game/GroupTable';
import { KnockoutBracket } from '@/components/game/KnockoutBracket';
import type { ContinentalCompetition, ContinentalTournamentState } from '@/types/game';
import { cn } from '@/lib/utils';
import { Globe, Trophy } from 'lucide-react';
import { getCurrentMatchday } from '@/utils/continental';
import { CONTINENTAL_GROUP_WEEKS } from '@/config/continental';
import { PageHint } from '@/components/game/PageHint';

function TournamentView({ tournament, competition }: { tournament: ContinentalTournamentState; competition: ContinentalCompetition }) {
  const { playerClubId, clubs, virtualClubs, week } = useGameStore();
  const [tab, setTab] = useState<'groups' | 'knockout'>(tournament.currentPhase === 'knockout' || tournament.currentPhase === 'complete' ? 'knockout' : 'groups');

  const currentMd = tournament.currentPhase === 'group' ? getCurrentMatchday(tournament) : 6;
  const compName = competition === 'champions_cup' ? 'Champions Cup' : 'Shield Cup';

  const subtitleParts: string[] = [];
  if (tournament.currentPhase === 'group') {
    subtitleParts.push(`Group Stage · Matchday ${currentMd}`);
    const mdWeek = CONTINENTAL_GROUP_WEEKS[currentMd - 1];
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
      <TournamentHeader
        competition={competition}
        subtitle={subtitleParts.join(' · ')}
        winnerId={tournament.winnerId}
        winnerName={winnerClubInfo?.name}
        playerEliminated={tournament.playerEliminated}
      />

      {/* Player status banners */}
      {tournament.playerEliminated && !tournament.winnerId && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center">
          <p className="text-sm text-destructive font-medium">Eliminated from the {compName}</p>
        </div>
      )}
      {tournament.winnerId === playerClubId && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
          <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
          <p className="text-sm text-primary font-bold">{compName} Winners!</p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-card/40 rounded-lg p-1">
        <button
          onClick={() => setTab('groups')}
          className={cn(
            'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
            tab === 'groups' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          Groups
        </button>
        <button
          onClick={() => setTab('knockout')}
          className={cn(
            'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
            tab === 'knockout'
              ? 'bg-card text-foreground shadow-sm'
              : tournament.knockoutTies.length > 0 ? 'text-muted-foreground' : 'text-muted-foreground/40'
          )}
          disabled={tournament.knockoutTies.length === 0}
        >
          Knockout
        </button>
      </div>

      {/* Content */}
      {tab === 'groups' && (
        <div className="space-y-3">
          {/* Player's group first */}
          {tournament.groups
            .sort((a, b) => {
              if (a.id === tournament.playerGroupId) return -1;
              if (b.id === tournament.playerGroupId) return 1;
              return a.id.localeCompare(b.id);
            })
            .map(group => (
              <GroupTable
                key={group.id}
                group={group}
                virtualClubs={virtualClubs}
                playerClubId={playerClubId}
                clubs={clubs}
                isPlayerGroup={group.id === tournament.playerGroupId}
                currentMatchday={currentMd}
              />
            ))}
        </div>
      )}

      {tab === 'knockout' && tournament.knockoutTies.length > 0 && (
        <KnockoutBracket
          ties={tournament.knockoutTies}
          virtualClubs={virtualClubs}
          playerClubId={playerClubId}
          clubs={clubs}
          currentRound={tournament.currentRound}
          winnerId={tournament.winnerId}
        />
      )}

      {tab === 'knockout' && tournament.knockoutTies.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Knockout stage has not started yet.</p>
          <p className="text-xs mt-1">Complete the group stage to see the draw.</p>
        </div>
      )}
    </div>
  );
}

const ContinentalPage = () => {
  const { championsCup, shieldCup, currentScreen } = useGameStore();

  const isChampions = currentScreen === 'champions-cup';
  const tournament = isChampions ? championsCup : shieldCup;
  const competition: ContinentalCompetition = isChampions ? 'champions_cup' : 'shield_cup';

  if (!tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground py-12">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {isChampions ? 'You have not qualified for the Champions Cup.' : 'You have not qualified for the Shield Cup.'}
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
