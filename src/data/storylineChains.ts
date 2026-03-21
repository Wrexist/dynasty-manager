import { StorylineChainDef } from '@/types/game';

/**
 * Multi-week storyline chain definitions.
 * Each chain has 3-5 steps that trigger on successive weeks.
 * Steps can branch based on previous choices (requiredPrevChoice).
 */
export const STORYLINE_CHAINS: StorylineChainDef[] = [
  {
    id: 'dressing-room-power-struggle',
    name: 'Dressing Room Power Struggle',
    steps: [
      {
        weekOffset: 0,
        title: 'Clash of Egos',
        body: 'Two senior players have had a heated argument in training. The squad is divided — some back one, some the other. How do you handle it?',
        icon: 'angry',
        options: [
          { label: 'Side with the veteran', text: 'You publicly back the experienced leader.', effects: { morale: -3, boardConfidence: 2 } },
          { label: 'Side with the younger star', text: 'You support the rising talent and his new ideas.', effects: { morale: -2, fanMood: 3 } },
          { label: 'Stay neutral', text: 'You refuse to take sides and insist on professionalism.', effects: { morale: 1, boardConfidence: 1 } },
        ],
      },
      {
        weekOffset: 1,
        title: 'Tensions Escalate',
        body: 'The situation has worsened. Players are forming cliques in the dressing room. Staff are worried about team cohesion.',
        icon: 'zap',
        options: [
          { label: 'Hold a team meeting', text: 'You bring everyone together to clear the air.', effects: { morale: 5, boardConfidence: 2 } },
          { label: 'Drop both from the squad', text: 'You bench the troublemakers to send a message.', effects: { morale: -5, boardConfidence: 5, fanMood: -3 } },
          { label: 'Let them fight it out', text: 'You organize a competitive training drill to settle it on the pitch.', effects: { morale: 3, fanMood: 2 } },
        ],
      },
      {
        weekOffset: 3,
        title: 'Resolution',
        body: 'The dust has settled. The squad wants to know how you plan to prevent this happening again.',
        icon: 'handshake',
        requiredPrevChoice: 0, // only if they chose "Hold a team meeting"
        options: [
          { label: 'Establish a leadership group', text: 'You create a players\' council to handle disputes.', effects: { morale: 8, boardConfidence: 5 } },
          { label: 'Appoint a new captain', text: 'You shake up the leadership structure.', effects: { morale: 3, boardConfidence: 3, fanMood: 5 } },
          { label: 'Move on quickly', text: 'You draw a line under it and focus on football.', effects: { morale: 4, boardConfidence: 2 } },
        ],
      },
    ],
  },
  {
    id: 'star-player-transfer-saga',
    name: 'Star Player Transfer Saga',
    steps: [
      {
        weekOffset: 0,
        title: 'Agent Makes Contact',
        body: 'Your star player\'s agent has reached out. He says a top club is interested and his client wants to discuss his future.',
        icon: 'phone',
        options: [
          { label: 'Refuse to engage', text: 'You tell the agent your player is not for sale.', effects: { boardConfidence: 3, fanMood: 5 } },
          { label: 'Listen to the offer', text: 'You hear what they have to say without committing.', effects: { boardConfidence: -1 } },
          { label: 'Demand a huge fee', text: 'You set an astronomical asking price to deter interest.', effects: { boardConfidence: 2, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Media Frenzy',
        body: 'The story has leaked to the press. Reporters are asking about the transfer at every opportunity. The player is distracted.',
        icon: 'newspaper',
        options: [
          { label: 'Give a defiant press conference', text: 'You insist the player stays and the story is fabricated.', effects: { morale: 3, fanMood: 5, boardConfidence: 2 } },
          { label: 'Remain tight-lipped', text: 'You refuse to comment and let the speculation die down.', effects: { boardConfidence: 1 } },
          { label: 'Admit there\'s interest', text: 'You acknowledge the situation honestly.', effects: { morale: -3, fanMood: -5, boardConfidence: -2 } },
        ],
      },
      {
        weekOffset: 3,
        title: 'The Player Speaks',
        body: 'Your star has given a cryptic interview saying he "wants to play at the highest level." The fans are furious.',
        icon: 'mic',
        options: [
          { label: 'Fine him for the interview', text: 'You impose a fine for speaking without permission.', effects: { morale: -5, boardConfidence: 5, fanMood: 8 } },
          { label: 'Have a heart-to-heart', text: 'You sit down privately to understand his feelings.', effects: { morale: 5, boardConfidence: 1 } },
          { label: 'Put him on the transfer list', text: 'If he wants to go, let him go.', effects: { morale: -8, boardConfidence: -3, fanMood: -10 } },
        ],
      },
      {
        weekOffset: 5,
        title: 'Deadline Day Decision',
        body: 'Transfer deadline is here. Your star player\'s future must be decided today.',
        icon: 'clock',
        options: [
          { label: 'He stays — end of story', text: 'You refuse all offers and commit to the player.', effects: { morale: 8, fanMood: 10, boardConfidence: 3 } },
          { label: 'Accept a record fee', text: 'You sell for a record price and reinvest.', effects: { morale: -10, fanMood: -5, boardConfidence: 8 } },
          { label: 'Loan him out for the season', text: 'A compromise — he gets his move but returns next year.', effects: { morale: -2, boardConfidence: 2, fanMood: -2 } },
        ],
      },
    ],
  },
  {
    id: 'youth-prodigy-breakthrough',
    name: 'Youth Prodigy Breakthrough',
    steps: [
      {
        weekOffset: 0,
        title: 'Wonderkid Emerges',
        body: 'Your youth academy has produced a special talent. Academy coaches say he\'s the most gifted player they\'ve ever seen. Should he train with the first team?',
        icon: 'star',
        options: [
          { label: 'Promote him immediately', text: 'You fast-track him to first-team training.', effects: { fanMood: 5, boardConfidence: 3 } },
          { label: 'Keep him in the academy', text: 'He needs more development time before the spotlight.', effects: { boardConfidence: 2, morale: 2 } },
          { label: 'Loan him out', text: 'A loan spell at a lower club will toughen him up.', effects: { boardConfidence: 1, fanMood: -2 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Big Club Scouts Spotted',
        body: 'Scouts from rival clubs have been watching your prodigy in training. There\'s growing media attention on the youngster.',
        icon: 'eye',
        options: [
          { label: 'Shield him from the media', text: 'You protect the youngster from outside pressure.', effects: { morale: 3, boardConfidence: 3 } },
          { label: 'Use the attention', text: 'You let the hype build his confidence and the club\'s profile.', effects: { fanMood: 5, morale: -2 } },
          { label: 'Tie him to a long contract', text: 'You move quickly to secure his future at the club.', effects: { boardConfidence: 5, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'First Team Debut',
        body: 'The moment has arrived. Your prodigy is ready for his first-team debut. The fans are buzzing with excitement.',
        icon: 'star',
        options: [
          { label: 'Start him in a big match', text: 'You throw him into the deep end against a top team.', effects: { morale: 5, fanMood: 8, boardConfidence: -2 } },
          { label: 'Bring him off the bench', text: 'A careful introduction as a substitute in a comfortable game.', effects: { morale: 3, fanMood: 3, boardConfidence: 3 } },
          { label: 'Wait for the right moment', text: 'You hold off — patience is key for young players.', effects: { boardConfidence: 2, morale: -2, fanMood: -3 } },
        ],
      },
    ],
  },
  {
    id: 'financial-crisis',
    name: 'Financial Crisis',
    steps: [
      {
        weekOffset: 0,
        title: 'Budget Cuts Announced',
        body: 'The board has announced significant budget cuts due to declining revenue. You must find ways to reduce costs.',
        icon: 'coins',
        options: [
          { label: 'Sell a key player', text: 'You accept the need to raise funds through player sales.', effects: { boardConfidence: 5, morale: -5, fanMood: -5 } },
          { label: 'Cut non-essential spending', text: 'You reduce training and scouting budgets instead.', effects: { boardConfidence: 3, morale: -2 } },
          { label: 'Demand the board invests', text: 'You push back and insist on maintaining the squad.', effects: { boardConfidence: -5, morale: 5, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Sponsor Pressure',
        body: 'The main sponsor is threatening to pull out unless results improve. The commercial department is panicking.',
        icon: 'trending-down',
        options: [
          { label: 'Promise better results', text: 'You assure the sponsor that the team is on the right track.', effects: { boardConfidence: 3, morale: -3 } },
          { label: 'Focus on youth development', text: 'You pitch a long-term vision of homegrown talent.', effects: { boardConfidence: 2, fanMood: 5 } },
          { label: 'Ignore the pressure', text: 'Commercial matters are not your concern — you focus on football.', effects: { morale: 3, boardConfidence: -3 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'Light at the End',
        body: 'Recent results have eased the financial pressure somewhat. The board wants to discuss the path forward.',
        icon: 'sunset',
        options: [
          { label: 'Invest in youth', text: 'You propose upgrading youth facilities for long-term sustainability.', effects: { boardConfidence: 8, fanMood: 5 } },
          { label: 'Request transfer funds', text: 'You ask for a modest transfer budget to strengthen weak areas.', effects: { boardConfidence: 3, morale: 5 } },
          { label: 'Maintain the status quo', text: 'You suggest riding the momentum with the current squad.', effects: { boardConfidence: 5, morale: 3, fanMood: 3 } },
        ],
      },
    ],
  },
];

/** Check if a chain should trigger based on game context */
export function shouldTriggerChain(
  chainId: string,
  ctx: {
    week: number;
    recentWins: number;
    recentLosses: number;
    boardConfidence: number;
    hasStarPlayer: boolean;
    hasYouthProspect: boolean;
    budget: number;
    averageBudget: number;
  },
): boolean {
  switch (chainId) {
    case 'dressing-room-power-struggle':
      return ctx.recentLosses >= 2 && ctx.week >= 8;
    case 'star-player-transfer-saga':
      return ctx.hasStarPlayer && ctx.week >= 5 && ctx.week <= 25;
    case 'youth-prodigy-breakthrough':
      return ctx.hasYouthProspect && ctx.week >= 6;
    case 'financial-crisis':
      return ctx.budget < ctx.averageBudget * 0.5 && ctx.boardConfidence < 50 && ctx.week >= 10;
    default:
      return false;
  }
}
