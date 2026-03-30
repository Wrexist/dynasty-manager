import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CHALLENGES, getDifficultyColor } from '@/data/challenges';
import { CLUBS_DATA } from '@/data/league';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight, Shield, Trophy, Star } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import type { ChallengeScenario } from '@/types/game';

const ChallengePicker = () => {
  const navigate = useNavigate();
  const startChallenge = useGameStore(s => s.startChallenge);
  const [selected, setSelected] = useState<ChallengeScenario | null>(null);
  const [pickingClub, setPickingClub] = useState(false);

  const handleSelectChallenge = (scenario: ChallengeScenario) => {
    setSelected(scenario);
    if (scenario.startingClubId) {
      // Fixed club — start directly
      startChallenge(scenario.id, scenario.startingClubId);
      navigate('/game');
    } else if (scenario.id === 'giant-killer') {
      // Must pick lowest rep club
      const lowestRep = [...CLUBS_DATA].sort((a, b) => a.reputation - b.reputation)[0];
      startChallenge(scenario.id, lowestRep.id);
      navigate('/game');
    } else {
      setPickingClub(true);
    }
  };

  const handleSelectClub = (clubId: string) => {
    if (!selected) return;
    startChallenge(selected.id, clubId);
    navigate('/game');
  };

  if (pickingClub && selected) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-border/30">
          <button onClick={() => setPickingClub(false)} className="p-2 rounded-lg hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground">Choose Your Club</h1>
            <p className="text-xs text-muted-foreground">{selected.name}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
          <div className="space-y-2">
            {CLUBS_DATA.sort((a, b) => b.reputation - a.reputation).map(club => (
              <button
                key={club.id}
                onClick={() => handleSelectClub(club.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-card/60 backdrop-blur-xl border border-border/50 hover:border-primary/40 active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: club.color }}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{club.name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">Rep: {Array.from({ length: 5 }).map((_, si) => <Star key={si} className={cn('w-2 h-2 inline', si < club.reputation ? 'fill-primary text-primary' : 'text-muted-foreground/30')} />)} · Budget: £{(club.budget / 1e6).toFixed(0)}M</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-muted/50">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">Challenge Mode</h1>
          <p className="text-xs text-muted-foreground">Test your skills with unique scenarios</p>
        </div>
      </div>

      {/* Challenge List */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        <div className="space-y-3">
          {CHALLENGES.map((challenge, i) => (
            <motion.button
              key={challenge.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectChallenge(challenge)}
              className="w-full text-left bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-4 hover:border-primary/40 active:scale-[0.98] transition-all"
            >
              <div className="flex items-start gap-3">
                <DynamicIcon name={challenge.icon} className="w-7 h-7 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-foreground">{challenge.name}</h3>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', getDifficultyColor(challenge.difficulty))}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{challenge.description}</p>

                  {/* Objective */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Trophy className="w-3 h-3 text-primary shrink-0" />
                    <p className="text-[10px] text-primary font-medium">{challenge.winCondition}</p>
                  </div>

                  {/* Constraints */}
                  <div className="flex flex-wrap gap-1">
                    {challenge.constraints.map((c, j) => (
                      <span key={j} className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                        {c}
                      </span>
                    ))}
                    <span className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                      {challenge.seasonLimit} season{challenge.seasonLimit > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChallengePicker;
