import { Player, Message, Club, StorylineEvent, StorylineOption } from '@/types/game';

interface StorylineContext {
  week: number;
  season: number;
  playerClubId: string;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  recentResults: { won: number; drawn: number; lost: number }; // last 5 matches
  leaguePosition: number;
  boardConfidence: number;
  fanMood: number;
}

interface StorylineMessage {
  type: Message['type'];
  title: string;
  body: string;
}

interface StorylineCandidate {
  message: StorylineMessage;
  event?: StorylineEvent;
}

/** Generate dynamic storyline events based on current game context.
 *  Returns messages for the inbox AND optionally a StorylineEvent with player choices. */
export function generateStorylines(ctx: StorylineContext): { messages: StorylineMessage[]; event: StorylineEvent | null } {
  const squad = Object.values(ctx.players).filter(p => p.clubId === ctx.playerClubId);
  const club = ctx.clubs[ctx.playerClubId];
  if (!club || squad.length === 0) return { messages: [], event: null };

  // Only trigger storylines occasionally (30% chance per week, max 1 per week)
  if (Math.random() > 0.30) return { messages: [], event: null };

  const candidates: StorylineCandidate[] = [];

  // ── Losing streak unrest ──
  if (ctx.recentResults.lost >= 3) {
    candidates.push({
      message: {
        type: 'general',
        title: 'Dressing Room Unrest',
        body: `Players are becoming frustrated with the recent run of ${ctx.recentResults.lost} defeats. Senior players are urging the squad to stick together.`,
      },
      event: {
        id: crypto.randomUUID(),
        title: 'Dressing Room Unrest',
        body: `Your squad is unhappy after ${ctx.recentResults.lost} defeats. How do you respond?`,
        icon: 'angry',
        options: [
          { label: 'Rally the troops', text: 'You gather the team and deliver a passionate speech.', effects: { morale: 5, boardConfidence: 2 } },
          { label: 'Crack down on discipline', text: 'You impose extra training sessions and demand focus.', effects: { morale: -3, boardConfidence: 5, fanMood: 2 } },
          { label: 'Let them sort it out', text: 'You trust the senior players to handle the situation.', effects: { morale: 2, boardConfidence: -2 } },
        ],
      },
    });
  }

  // ── Winning streak confidence ──
  if (ctx.recentResults.won >= 4) {
    candidates.push({
      message: {
        type: 'general',
        title: 'Squad Confidence Soaring',
        body: `The team is riding a ${ctx.recentResults.won}-game winning streak! Morale in the dressing room is sky-high.`,
      },
      event: {
        id: crypto.randomUUID(),
        title: 'Riding the Wave',
        body: `Your team is on a ${ctx.recentResults.won}-game winning streak. The media wants to know your thoughts.`,
        icon: 'trophy',
        options: [
          { label: 'Stay humble', text: 'You downplay the run and keep the squad focused.', effects: { morale: 2, boardConfidence: 3 } },
          { label: 'Enjoy the moment', text: 'You let the team celebrate and bask in the glory.', effects: { morale: 5, fanMood: 5, boardConfidence: -1 } },
          { label: 'Set higher targets', text: 'You challenge the squad to aim even higher.', effects: { morale: -2, boardConfidence: 5 } },
        ],
      },
    });
  }

  // ── Star player linked with move ──
  const stars = squad.filter(p => p.overall >= 75 && (p.personality?.ambition ?? 10) >= 14 && !p.listedForSale);
  if (stars.length > 0 && ctx.week >= 5 && ctx.week <= 30) {
    const star = stars[Math.floor(Math.random() * stars.length)];
    const bigClubs = Object.values(ctx.clubs).filter(c => c.id !== ctx.playerClubId && c.reputation >= (club.reputation || 3));
    if (bigClubs.length > 0) {
      const suitor = bigClubs[Math.floor(Math.random() * bigClubs.length)];
      candidates.push({
        message: {
          type: 'transfer',
          title: `${star.lastName} Linked with Move`,
          body: `Reports suggest ${suitor.name} are monitoring ${star.firstName} ${star.lastName}. The player's ambition could make him open to a move.`,
        },
        event: {
          id: crypto.randomUUID(),
          title: `${star.lastName} Linked with ${suitor.shortName}`,
          body: `${star.firstName} ${star.lastName} has been spotted talking to ${suitor.name} representatives. How do you handle it?`,
          icon: 'newspaper',
          options: [
            { label: 'Promise him first-team football', text: 'You assure the player he is central to your plans.', effects: { targetPlayerId: star.id, playerMorale: 10, boardConfidence: 1 } },
            { label: 'Tell him he can leave', text: 'You accept his wishes and begin looking at replacements.', effects: { targetPlayerId: star.id, playerMorale: -5, fanMood: -3 } },
            { label: 'Ignore the rumours', text: 'You refuse to be drawn on transfer speculation.', effects: { targetPlayerId: star.id, playerMorale: -2, boardConfidence: -1 } },
          ],
        },
      });
    }
  }

  // ── Youth prospect catching attention ──
  const risers = squad.filter(p => p.age <= 21 && p.overall >= 65 && p.potential >= 75);
  if (risers.length > 0) {
    const prospect = risers[Math.floor(Math.random() * risers.length)];
    candidates.push({
      message: {
        type: 'development',
        title: `${prospect.lastName} Turning Heads`,
        body: `Young talent ${prospect.firstName} ${prospect.lastName} (${prospect.age}) is attracting attention with impressive performances. Scouts from rival clubs have been spotted watching him.`,
      },
      event: {
        id: crypto.randomUUID(),
        title: `${prospect.lastName} Breaking Through`,
        body: `${prospect.firstName} ${prospect.lastName} is impressing everyone. Rival scouts are watching. What's your approach?`,
        icon: 'star',
        options: [
          { label: 'Give him more game time', text: 'You promote the youngster to a regular starter.', effects: { targetPlayerId: prospect.id, playerMorale: 10, fanMood: 3 } },
          { label: 'Shield him from pressure', text: 'You protect the youngster from media attention and ease his integration.', effects: { targetPlayerId: prospect.id, playerMorale: 3, boardConfidence: 2 } },
          { label: 'Tie him down to a new deal', text: 'You prioritize securing his future at the club.', effects: { boardConfidence: 3, fanMood: 2 } },
        ],
      },
    });
  }

  // ── Fan protest / low mood ──
  if (ctx.fanMood < 25 && ctx.leaguePosition > 15) {
    candidates.push({
      message: {
        type: 'general',
        title: 'Fan Frustration Growing',
        body: `Supporters are voicing their displeasure on social media. Some fans are calling for changes after the team's poor league position.`,
      },
      event: {
        id: crypto.randomUUID(),
        title: 'Fans Demand Answers',
        body: 'Supporters are protesting outside the stadium. They want to see improvement. How do you respond?',
        icon: 'megaphone',
        options: [
          { label: 'Acknowledge their frustration', text: 'You hold a fan forum and promise to do better.', effects: { fanMood: 8, boardConfidence: -2, morale: -2 } },
          { label: 'Focus on results', text: 'You say results will do the talking.', effects: { fanMood: 2, boardConfidence: 3 } },
          { label: 'Ignore the noise', text: 'You refuse to engage with the protests.', effects: { fanMood: -5, boardConfidence: 1, morale: 3 } },
        ],
      },
    });
  }

  // ── Board pressure at mid-season ──
  if (ctx.week >= 18 && ctx.week <= 22 && ctx.boardConfidence < 40) {
    candidates.push({
      message: {
        type: 'board',
        title: 'Board Reviewing Position',
        body: `The board are reportedly meeting to discuss the team's direction. Improved results in the second half of the season will be crucial.`,
      },
      event: {
        id: crypto.randomUUID(),
        title: 'Board Meeting',
        body: 'The board has summoned you for a mid-season review. Your position is under scrutiny.',
        icon: 'building',
        options: [
          { label: 'Present a plan for improvement', text: 'You outline your strategy for the rest of the season.', effects: { boardConfidence: 8, morale: -2 } },
          { label: 'Ask for patience', text: 'You request more time to implement your vision.', effects: { boardConfidence: 3 } },
          { label: 'Demand backing', text: 'You ask for transfer funds and better resources.', effects: { boardConfidence: -3, morale: 5 } },
        ],
      },
    });
  }

  // ── Injury-hit squad depth concern ──
  const injured = squad.filter(p => p.injuryWeeks > 0);
  if (injured.length >= 3) {
    candidates.push({
      message: {
        type: 'injury',
        title: 'Injury Crisis Deepening',
        body: `With ${injured.length} players currently sidelined, the medical team is under pressure. Squad depth will be tested in the coming weeks.`,
      },
    });
  }

  // ── Veteran mentor story ──
  const veterans = squad.filter(p => p.age >= 30 && p.overall >= 68 && (p.personality?.leadership ?? 10) >= 14);
  const youngsters = squad.filter(p => p.age <= 21 && p.overall < 65);
  if (veterans.length > 0 && youngsters.length > 0) {
    const vet = veterans[Math.floor(Math.random() * veterans.length)];
    const youth = youngsters[Math.floor(Math.random() * youngsters.length)];
    candidates.push({
      message: {
        type: 'development',
        title: `${vet.lastName} Mentoring ${youth.lastName}`,
        body: `${vet.firstName} ${vet.lastName} has taken ${youth.firstName} ${youth.lastName} under his wing on the training ground. The youngster could benefit from the veteran's experience.`,
      },
    });
  }

  // ── Hot-headed player warning ──
  const hotHeads = squad.filter(p => (p.personality?.temperament ?? 10) <= 6 && p.overall >= 65);
  if (hotHeads.length > 0) {
    const hh = hotHeads[Math.floor(Math.random() * hotHeads.length)];
    candidates.push({
      message: {
        type: 'general',
        title: `${hh.lastName}'s Temperament`,
        body: `Staff have noticed ${hh.firstName} ${hh.lastName} getting increasingly frustrated in training sessions. Keep an eye on his discipline in upcoming matches.`,
      },
      event: {
        id: crypto.randomUUID(),
        title: `${hh.lastName} Losing His Cool`,
        body: `${hh.firstName} ${hh.lastName} has been aggressive in training. Other players are concerned.`,
        icon: 'angry',
        options: [
          { label: 'Have a private chat', text: 'You sit down with the player and talk things through calmly.', effects: { targetPlayerId: hh.id, playerMorale: 5 } },
          { label: 'Issue a public warning', text: 'You make it clear this behaviour is unacceptable.', effects: { targetPlayerId: hh.id, playerMorale: -8, morale: 2, boardConfidence: 2 } },
          { label: 'Drop him from the squad', text: 'You bench the player to send a message.', effects: { targetPlayerId: hh.id, playerMorale: -15, morale: 3, boardConfidence: 3 } },
        ],
      },
    });
  }

  // Pick one random candidate
  if (candidates.length === 0) return { messages: [], event: null };

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    messages: [chosen.message],
    event: chosen.event || null,
  };
}
