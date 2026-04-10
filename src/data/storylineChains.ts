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
        body: '{playerName}\'s agent has reached out. He says a top club is interested and his client wants to discuss his future.',
        icon: 'phone',
        options: [
          { label: 'Refuse to engage', text: 'You tell the agent {playerName} is not for sale.', effects: { boardConfidence: 3, fanMood: 5, playerMorale: -3 } },
          { label: 'Listen to the offer', text: 'You hear what they have to say without committing.', effects: { boardConfidence: -1, playerMorale: 2 } },
          { label: 'Demand a huge fee', text: 'You set an astronomical asking price to deter interest.', effects: { boardConfidence: 2, fanMood: 3, playerMorale: -2 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Media Frenzy',
        body: 'The {playerName} story has leaked to the press. Reporters are asking about the transfer at every opportunity. {playerName} is distracted.',
        icon: 'newspaper',
        options: [
          { label: 'Give a defiant press conference', text: 'You insist {playerName} stays and the story is fabricated.', effects: { morale: 3, fanMood: 5, boardConfidence: 2, playerMorale: -5 } },
          { label: 'Remain tight-lipped', text: 'You refuse to comment and let the speculation die down.', effects: { boardConfidence: 1, playerMorale: -2 } },
          { label: 'Admit there\'s interest', text: 'You acknowledge the situation around {playerName} honestly.', effects: { morale: -3, fanMood: -5, boardConfidence: -2, playerMorale: 5 } },
        ],
      },
      {
        weekOffset: 3,
        title: 'The Player Speaks',
        body: '{playerName} has given a cryptic interview saying he "wants to play at the highest level." The fans are furious.',
        icon: 'mic',
        options: [
          { label: 'Fine him for the interview', text: 'You impose a fine on {playerName} for speaking without permission.', effects: { morale: -5, boardConfidence: 5, fanMood: 8, playerMorale: -12 } },
          { label: 'Have a heart-to-heart', text: 'You sit down privately with {playerName} to understand his feelings.', effects: { morale: 5, boardConfidence: 1, playerMorale: 8 } },
          { label: 'Put him on the transfer list', text: 'If {playerName} wants to go, let him go.', effects: { morale: -8, boardConfidence: -3, fanMood: -10, playerMorale: 5 } },
        ],
      },
      {
        weekOffset: 5,
        title: 'Deadline Day Decision',
        body: 'Transfer deadline is here. {playerName}\'s future must be decided today.',
        icon: 'clock',
        options: [
          { label: 'He stays — end of story', text: 'You refuse all offers and commit to {playerName}.', effects: { morale: 8, fanMood: 10, boardConfidence: 3, playerMorale: 15 } },
          { label: 'Accept a record fee', text: 'You sell {playerName} for a record price and reinvest.', effects: { morale: -10, fanMood: -5, boardConfidence: 8, playerMorale: -15 } },
          { label: 'Loan him out for the season', text: '{playerName} goes out on loan — a compromise. He gets his move but returns next year.', effects: { morale: -2, boardConfidence: 2, fanMood: -2, playerMorale: 5 } },
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
  {
    id: 'media-scandal',
    name: 'Media Scandal',
    steps: [
      {
        weekOffset: 0,
        title: 'Tabloid Exposé',
        body: 'A national tabloid has published a damaging story about your club — allegations of internal dysfunction and poor culture behind the scenes. The press are swarming the training ground.',
        icon: 'newspaper',
        options: [
          { label: 'Issue a strong denial', text: 'You release a statement calling the story fabricated and threaten legal action.', effects: { morale: 3, boardConfidence: 2, fanMood: 4 } },
          { label: 'Decline to comment', text: 'You refuse to engage with the media and instruct staff to do the same.', effects: { morale: -1, boardConfidence: 1 } },
          { label: 'Address it head-on', text: 'You hold a press conference admitting some issues exist but are being resolved.', effects: { morale: -3, boardConfidence: -2, fanMood: -3 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Investigation Launched',
        body: 'The story has gained traction. Pundits are debating it on every talk show. The board has launched an internal investigation to get to the bottom of things.',
        icon: 'megaphone',
        options: [
          { label: 'Cooperate fully', text: 'You open your door to the investigation and provide everything asked for.', effects: { morale: 2, boardConfidence: 5 } },
          { label: 'Protect your staff', text: 'You shield your coaching team and insist the blame lies elsewhere.', effects: { morale: 5, boardConfidence: -3 } },
          { label: 'Deflect to results', text: 'You point to recent performances and say the pitch is all that matters.', effects: { morale: 3, fanMood: 2, boardConfidence: -1 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'The Verdict',
        body: 'The investigation is complete. The board wants to move forward, and the media have largely moved on. How do you close this chapter?',
        icon: 'file-text',
        options: [
          { label: 'Implement new standards', text: 'You introduce a code of conduct and media training for all staff.', effects: { morale: 4, boardConfidence: 7, fanMood: 5 } },
          { label: 'Make an example', text: 'You dismiss a junior staff member linked to the leak as a warning.', effects: { morale: -5, boardConfidence: 5, fanMood: 2 } },
          { label: 'Simply move on', text: 'You tell everyone to forget it and focus on football.', effects: { morale: 6, boardConfidence: 2, fanMood: 1 } },
        ],
      },
    ],
  },
  {
    id: 'injury-crisis',
    name: 'Injury Crisis',
    steps: [
      {
        weekOffset: 0,
        title: 'First Wave',
        body: 'Disaster strikes — three first-team players have picked up injuries in the same training session. The medical staff are stretched thin and the next match is just days away.',
        icon: 'heart-pulse',
        options: [
          { label: 'Call up youth players', text: 'You promote youngsters from the academy to fill the gaps.', effects: { morale: -2, boardConfidence: 2, fanMood: 3 } },
          { label: 'Reshape the formation', text: 'You adapt your tactics to work around the missing players.', effects: { morale: 1, boardConfidence: 3 } },
          { label: 'Rush players back', text: 'You push the less-injured players to declare themselves fit early.', effects: { morale: -4, boardConfidence: -1, fanMood: -2 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Squad Depth Tested',
        body: 'The injuries are mounting and squad depth is being tested like never before. Fringe players are getting their chance, but fatigue is becoming a real concern.',
        icon: 'users',
        options: [
          { label: 'Rotate heavily', text: 'You manage workloads carefully, even if it means weaker starting elevens.', effects: { morale: 3, boardConfidence: 1, fanMood: -2 } },
          { label: 'Demand maximum effort', text: 'You push the remaining fit players to give everything in every match.', effects: { morale: -3, boardConfidence: 2, fanMood: 4 } },
          { label: 'Sign an emergency loan', text: 'You petition the board for an emergency loan signing to cover the crisis.', effects: { morale: 2, boardConfidence: -2, fanMood: 2 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'Recovery and Adaptation',
        body: 'Players are starting to return from injury. The crisis has tested the squad, but it has also revealed unexpected heroes among the fringe players.',
        icon: 'award',
        options: [
          { label: 'Reward the stand-ins', text: 'You offer extended contracts to the players who stepped up during the crisis.', effects: { morale: 8, boardConfidence: 4, fanMood: 5 } },
          { label: 'Return to the first-choice XI', text: 'You slot the returning stars straight back in and thank the deputies.', effects: { morale: -2, boardConfidence: 3, fanMood: 3 } },
          { label: 'Overhaul the medical setup', text: 'You demand investment in sports science to prevent future crises.', effects: { morale: 3, boardConfidence: 5, fanMood: 2 } },
        ],
      },
    ],
  },
  {
    id: 'board-takeover',
    name: 'Board Takeover',
    steps: [
      {
        weekOffset: 0,
        title: 'Takeover Rumours',
        body: 'Whispers are circulating that a wealthy consortium is interested in buying the club. Nothing official yet, but the uncertainty is unsettling everyone.',
        icon: 'building',
        options: [
          { label: 'Reassure the squad', text: 'You tell the players to ignore the rumours and focus on their jobs.', effects: { morale: 3, boardConfidence: 1 } },
          { label: 'Welcome the prospect', text: 'You publicly say new investment could be great for the club.', effects: { morale: 1, boardConfidence: -4, fanMood: 5 } },
          { label: 'Stay silent', text: 'You refuse to comment on matters above your pay grade.', effects: { morale: -1, boardConfidence: 2 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Formal Bid Tabled',
        body: 'It\'s official — a formal takeover bid has been submitted to the current owners. The new group wants to meet you to discuss their vision for the club.',
        icon: 'file-text',
        options: [
          { label: 'Meet the new owners', text: 'You sit down with the consortium to hear their plans and pitch your own vision.', effects: { morale: 2, boardConfidence: 3, fanMood: 4 } },
          { label: 'Stay loyal to current board', text: 'You publicly back the existing ownership and decline the meeting.', effects: { morale: -1, boardConfidence: 6, fanMood: -3 } },
          { label: 'Demand assurances', text: 'You agree to meet but insist on written guarantees about your position and transfer funds.', effects: { morale: 1, boardConfidence: -2, fanMood: 2 } },
        ],
      },
      {
        weekOffset: 3,
        title: 'New Era Begins',
        body: 'The takeover is complete. New owners are in place and the club is entering a new chapter. They want to discuss the immediate future with you.',
        icon: 'trending-down',
        options: [
          { label: 'Present an ambitious plan', text: 'You lay out a bold strategy for promotion and squad investment.', effects: { morale: 7, boardConfidence: 6, fanMood: 8 } },
          { label: 'Ask for patience', text: 'You explain that success takes time and urge the new owners to be realistic.', effects: { morale: 3, boardConfidence: 4, fanMood: 2 } },
          { label: 'Request full control', text: 'You ask for total autonomy over football decisions with no board interference.', effects: { morale: 5, boardConfidence: -3, fanMood: 4 } },
        ],
      },
    ],
  },
  {
    id: 'fan-protests',
    name: 'Fan Protests',
    steps: [
      {
        weekOffset: 0,
        title: 'Social Media Backlash',
        body: 'Fan accounts on social media are flooding with criticism. Hashtags calling for change are trending locally. The supporters trust is demanding answers from the club.',
        icon: 'megaphone',
        options: [
          { label: 'Engage with the fans', text: 'You post a heartfelt message on the club\'s channels acknowledging their frustration.', effects: { morale: -1, boardConfidence: 2, fanMood: 5 } },
          { label: 'Ignore social media', text: 'You tell the squad to delete their apps and focus on training.', effects: { morale: 3, boardConfidence: 1, fanMood: -5 } },
          { label: 'Blame the players', text: 'You publicly call out individual performances to deflect the anger.', effects: { morale: -8, boardConfidence: -2, fanMood: 2 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Organised Protest',
        body: 'Fans have organised a protest march before the next home match. Banners are being made, and local media will be covering it. The atmosphere at the stadium will be toxic.',
        icon: 'users',
        options: [
          { label: 'Meet the supporters\' group', text: 'You agree to a face-to-face meeting with fan representatives before the match.', effects: { morale: 2, boardConfidence: 3, fanMood: 6 } },
          { label: 'Use it as motivation', text: 'You tell the players to win the fans back with a performance on the pitch.', effects: { morale: 5, boardConfidence: 1, fanMood: -1 } },
          { label: 'Ask the board to intervene', text: 'You suggest the board release a statement to calm things down.', effects: { morale: -1, boardConfidence: -3, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'Rebuilding Trust',
        body: 'The protests have died down, but the relationship between club and fans remains fragile. A gesture of goodwill could go a long way.',
        icon: 'heart-pulse',
        options: [
          { label: 'Open training sessions', text: 'You invite fans to watch training and meet the players afterwards.', effects: { morale: 6, boardConfidence: 4, fanMood: 10 } },
          { label: 'Launch a community programme', text: 'You start free coaching clinics for local kids under the club\'s banner.', effects: { morale: 4, boardConfidence: 6, fanMood: 8 } },
          { label: 'Let results do the talking', text: 'You believe winning matches is the only way to truly win back the fans.', effects: { morale: 5, boardConfidence: 2, fanMood: 2 } },
        ],
      },
    ],
  },
  {
    id: 'rival-manager-feud',
    name: 'Rival Manager Feud',
    steps: [
      {
        weekOffset: 0,
        title: 'Pre-Match Provocation',
        body: 'The opposing manager has made inflammatory comments in his press conference, calling your team "limited" and questioning your tactical ability. The media are loving it.',
        icon: 'swords',
        options: [
          { label: 'Fire back publicly', text: 'You deliver a cutting response in your own press conference.', effects: { morale: 5, boardConfidence: -2, fanMood: 6 } },
          { label: 'Take the high road', text: 'You dismiss the comments with a smile and say your team will answer on the pitch.', effects: { morale: 3, boardConfidence: 3, fanMood: 3 } },
          { label: 'Use it in the dressing room', text: 'You pin the quotes on the dressing room wall and let the players stew.', effects: { morale: 7, boardConfidence: 1 } },
        ],
      },
      {
        weekOffset: 1,
        title: 'Match Day Tension',
        body: 'The match against your rival is here. The atmosphere is electric. Both sets of fans are fired up by the war of words, and the touchline will be a cauldron of tension.',
        icon: 'shield',
        options: [
          { label: 'Refuse to shake hands', text: 'You snub the opposing manager\'s handshake to send a message.', effects: { morale: 4, boardConfidence: -3, fanMood: 5 } },
          { label: 'Show respect', text: 'You shake hands warmly and demonstrate class under pressure.', effects: { morale: 2, boardConfidence: 5, fanMood: 2 } },
          { label: 'Wind him up on the touchline', text: 'You celebrate every tackle and goal with exaggerated passion right in front of him.', effects: { morale: 6, boardConfidence: -2, fanMood: 7 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'The Aftermath',
        body: 'The dust has settled after a heated encounter. The football world is still talking about the feud. How do you close this chapter?',
        icon: 'newspaper',
        options: [
          { label: 'Offer an olive branch', text: 'You publicly wish the rival manager well and call for mutual respect.', effects: { morale: 2, boardConfidence: 6, fanMood: -2 } },
          { label: 'Keep the rivalry alive', text: 'You drop one more pointed comment to keep the fans entertained.', effects: { morale: 4, boardConfidence: -2, fanMood: 8 } },
          { label: 'Focus on the next game', text: 'You move on completely and refuse to discuss it any further.', effects: { morale: 5, boardConfidence: 3, fanMood: 1 } },
        ],
      },
    ],
  },
  {
    id: 'contract-holdout',
    name: 'Contract Holdout',
    steps: [
      {
        weekOffset: 0,
        title: 'Agent Makes Demands',
        body: 'Your key player\'s agent has contacted the club demanding a significant pay rise. He says other clubs are offering double the wages, and his client feels undervalued.',
        icon: 'file-text',
        options: [
          { label: 'Open negotiations', text: 'You sit down with the agent to discuss a new deal.', effects: { morale: 2, boardConfidence: -1, fanMood: 1 } },
          { label: 'Reject outright', text: 'You tell the agent the current contract is fair and there will be no renegotiation.', effects: { morale: -4, boardConfidence: 4, fanMood: 3 } },
          { label: 'Stall for time', text: 'You say you\'ll discuss it after the next few matches and delay the conversation.', effects: { morale: -1, boardConfidence: 1 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Negotiations Stall',
        body: 'The situation has deteriorated. The player is visibly unhappy in training and there are rumours he\'s considering handing in a transfer request if his demands aren\'t met.',
        icon: 'trending-down',
        options: [
          { label: 'Offer a compromise', text: 'You propose a modest increase with performance bonuses to bridge the gap.', effects: { morale: 4, boardConfidence: 2, fanMood: 2 } },
          { label: 'Call his bluff', text: 'You tell the player he\'s free to leave if he can find a club willing to pay those wages.', effects: { morale: -6, boardConfidence: 3, fanMood: -3 } },
          { label: 'Appeal to his loyalty', text: 'You have a personal conversation about what the club means to him and his legacy here.', effects: { morale: 5, boardConfidence: 1, fanMood: 4 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'Deadline Decision',
        body: 'The contract situation must be resolved. The player\'s camp has set a deadline — agree terms this week or he goes public with a transfer request.',
        icon: 'clock',
        options: [
          { label: 'Meet his demands', text: 'You cave to the pressure and give him the contract he wants.', effects: { morale: 7, boardConfidence: -4, fanMood: 3 } },
          { label: 'Find a middle ground', text: 'A final round of negotiations produces a deal both sides can live with.', effects: { morale: 5, boardConfidence: 4, fanMood: 5 } },
          { label: 'Let him walk', text: 'You tell him to hand in the request. No player is bigger than the club.', effects: { morale: -8, boardConfidence: 5, fanMood: -5 } },
        ],
      },
    ],
  },
  {
    id: 'record-breaking-run',
    name: 'Record-Breaking Run',
    steps: [
      {
        weekOffset: 0,
        title: 'Historic Run Begins',
        body: 'The media have picked up on your recent form — you\'re on the verge of breaking the club\'s all-time unbeaten record. The pressure is building with every game.',
        icon: 'trophy',
        options: [
          { label: 'Embrace the spotlight', text: 'You tell the squad they\'re making history and to enjoy every moment.', effects: { morale: 8, boardConfidence: 5, fanMood: 10 } },
          { label: 'Downplay it', text: 'You ban any talk of records in the dressing room. Focus on the next game only.', effects: { morale: 4, boardConfidence: 3, fanMood: 2 } },
          { label: 'Use it as fuel', text: 'You tell the players that records exist to be broken and they should attack every match.', effects: { morale: 6, boardConfidence: 4, fanMood: 7 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'National Attention',
        body: 'TV cameras and national journalists have descended on the training ground. Sponsorship offers are flooding in. The club has never had this kind of attention before.',
        icon: 'newspaper',
        options: [
          { label: 'Shield the players', text: 'You limit media access and keep the squad in a protective bubble.', effects: { morale: 5, boardConfidence: 2, fanMood: -2 } },
          { label: 'Let them enjoy it', text: 'You allow interviews and appearances — the players have earned this moment.', effects: { morale: 3, boardConfidence: 4, fanMood: 8 } },
          { label: 'Channel the attention', text: 'You use the spotlight to promote the club\'s youth academy and community work.', effects: { morale: 4, boardConfidence: 6, fanMood: 6 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'The Record Match',
        body: 'This is it — one more result and you\'ll have the longest unbeaten run in the club\'s history. The stadium is sold out and the atmosphere is electric.',
        icon: 'star',
        options: [
          { label: 'Name your strongest XI', text: 'No experimentation today. You pick your best eleven and go for it.', effects: { morale: 10, boardConfidence: 5, fanMood: 10 } },
          { label: 'Stay true to rotation', text: 'You rotate as usual, showing faith in the whole squad.', effects: { morale: 7, boardConfidence: 4, fanMood: 3 } },
          { label: 'Dedicate it to the fans', text: 'You make a pre-match speech dedicating the performance to the supporters.', effects: { morale: 8, boardConfidence: 3, fanMood: 12 } },
        ],
      },
    ],
  },
  {
    id: 'local-academy-talent',
    name: 'Local Academy Talent',
    steps: [
      {
        weekOffset: 0,
        title: 'Scout\'s Report',
        body: 'Your head scout is buzzing. He\'s found a 16-year-old from a local school with exceptional talent. Other clubs haven\'t noticed him yet, but they will soon.',
        icon: 'eye',
        options: [
          { label: 'Fast-track to academy', text: 'You bring him in immediately and begin intensive development.', effects: { morale: 3, boardConfidence: 4 } },
          { label: 'Monitor from distance', text: 'You assign a scout to watch his next few games before committing.', effects: { morale: 1, boardConfidence: 2 } },
          { label: 'Invite for trial week', text: 'You bring him in for a week-long trial to assess his temperament and ability.', effects: { morale: 2, boardConfidence: 3, fanMood: 2 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'Interest Grows',
        body: 'Word has spread. Two bigger clubs have been spotted watching the youngster. His parents are fielding calls from agents. You need to act decisively or risk losing him.',
        icon: 'alert-triangle',
        options: [
          { label: 'Sign him immediately', text: 'You present a scholarship contract and personal development plan to his family.', effects: { morale: 2, boardConfidence: 5, fanMood: 5 } },
          { label: 'Promise first-team exposure', text: 'You guarantee opportunities with the senior squad to set yourself apart.', effects: { morale: 4, boardConfidence: 2, fanMood: 6 } },
          { label: 'Let him decide freely', text: 'You tell the family you won\'t pressure them — the right choice will be obvious.', effects: { morale: 3, boardConfidence: 3, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 4,
        title: 'The Decision',
        body: 'The youngster has made his choice. All eyes are on whether he joins your club or moves to a bigger team. It comes down to trust and vision.',
        icon: 'handshake',
        requiredPrevChoice: 0,
        options: [
          { label: 'Announce with fanfare', text: 'You make a public announcement celebrating the signing as a triumph for local development.', effects: { morale: 6, boardConfidence: 6, fanMood: 10 } },
          { label: 'Quietly integrate', text: 'You bring him in with no fuss and let his football do the talking.', effects: { morale: 4, boardConfidence: 4, fanMood: 4 } },
          { label: 'Assign a mentor', text: 'You pair him with your most experienced player to guide his development.', effects: { morale: 5, boardConfidence: 5, fanMood: 6 } },
        ],
      },
    ],
  },
  {
    id: 'stadium-expansion',
    name: 'Stadium Expansion',
    steps: [
      {
        weekOffset: 0,
        title: 'Capacity Concerns',
        body: 'The stadium has been selling out regularly and the board are considering a major expansion. But construction will be disruptive and expensive.',
        icon: 'building',
        options: [
          { label: 'Push for expansion', text: 'You back the board\'s plan. A bigger stadium means more revenue and a louder atmosphere.', effects: { morale: 3, boardConfidence: 5, fanMood: 8 } },
          { label: 'Express caution', text: 'You warn that the financial risk could impact the transfer budget for years.', effects: { morale: -1, boardConfidence: 3, fanMood: -2 } },
          { label: 'Suggest phased approach', text: 'You propose expanding in stages to minimise disruption and financial risk.', effects: { morale: 2, boardConfidence: 6, fanMood: 4 } },
        ],
      },
      {
        weekOffset: 3,
        title: 'Construction Begins',
        body: 'Building work has started on the new stand. The noise and reduced capacity are affecting the matchday atmosphere. Some fans are unhappy about the disruption.',
        icon: 'hard-hat',
        options: [
          { label: 'Rally the fans', text: 'You ask supporters to be patient and paint a picture of the future.', effects: { morale: 2, boardConfidence: 4, fanMood: 5 } },
          { label: 'Focus on away form', text: 'You tell the squad to treat the next few months as a chance to build a fearsome away record.', effects: { morale: 6, boardConfidence: 3, fanMood: 2 } },
          { label: 'Complain publicly', text: 'You criticise the timing and the impact it\'s having on your team.', effects: { morale: 3, boardConfidence: -5, fanMood: 4 } },
        ],
      },
      {
        weekOffset: 6,
        title: 'Grand Opening',
        body: 'The new stand is complete! Capacity has increased significantly and there\'s a real buzz around the club. The first match in the expanded stadium is a big occasion.',
        icon: 'sparkles',
        options: [
          { label: 'Put on a show', text: 'You pick your most attacking line-up and promise entertaining football for the opening match.', effects: { morale: 10, boardConfidence: 5, fanMood: 12 } },
          { label: 'Dedicate it to the community', text: 'You invite local schools and community groups to fill the new stand.', effects: { morale: 7, boardConfidence: 6, fanMood: 10 } },
          { label: 'Business as usual', text: 'You treat it like any other match. The focus is on three points, not celebrations.', effects: { morale: 4, boardConfidence: 4, fanMood: 2 } },
        ],
      },
    ],
  },
  {
    id: 'cup-giant-killing',
    name: 'Cup Giant-Killing',
    steps: [
      {
        weekOffset: 0,
        title: 'Big Draw',
        body: 'The cup draw has been kind — or cruel, depending on your perspective. You\'ve been drawn against one of the biggest clubs in the country. The media are already calling it a potential giant-killing.',
        icon: 'swords',
        options: [
          { label: 'Relish the occasion', text: 'You tell the media this is what cup football is all about and you fancy your chances.', effects: { morale: 8, boardConfidence: 3, fanMood: 10 } },
          { label: 'Play down expectations', text: 'You say it\'s a free hit — no pressure, just enjoy the experience.', effects: { morale: 5, boardConfidence: 4, fanMood: 4 } },
          { label: 'Focus on preparation', text: 'You demand the squad treats this like any other match with full professionalism.', effects: { morale: 4, boardConfidence: 5, fanMood: 2 } },
        ],
      },
      {
        weekOffset: 1,
        title: 'Media Circus',
        body: 'The build-up has been enormous. National media are requesting interviews, former players are sharing memories of past upsets, and the atmosphere around the club is electric.',
        icon: 'tv',
        options: [
          { label: 'Ride the wave', text: 'You let the excitement build naturally and feed off the energy.', effects: { morale: 6, boardConfidence: 2, fanMood: 8 } },
          { label: 'Limit distractions', text: 'You close the training ground and focus purely on the tactical plan.', effects: { morale: 3, boardConfidence: 5, fanMood: 0 } },
          { label: 'Study the opposition', text: 'You obsess over video analysis, looking for any weakness to exploit.', effects: { morale: 4, boardConfidence: 4, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 2,
        title: 'The Aftermath',
        body: 'The cup tie is over. Regardless of the result, the experience has galvanised the squad and brought the club together. There\'s a sense that something special is building.',
        icon: 'heart',
        options: [
          { label: 'Channel the momentum', text: 'You use the cup experience to drive the squad forward in the league campaign.', effects: { morale: 10, boardConfidence: 5, fanMood: 8 } },
          { label: 'Keep perspective', text: 'You remind everyone that the league is what really matters and refocus the group.', effects: { morale: 5, boardConfidence: 6, fanMood: 3 } },
          { label: 'Celebrate the journey', text: 'You organise a team dinner to mark the occasion and strengthen bonds.', effects: { morale: 8, boardConfidence: 3, fanMood: 6 } },
        ],
      },
    ],
  },
  {
    id: 'captain-retirement',
    name: 'Captain\'s Farewell',
    steps: [
      {
        weekOffset: 0,
        title: 'Retirement Announcement',
        body: 'Your long-serving captain has told you privately that he plans to retire at the end of the season. He wants to go out on his own terms but is emotional about leaving.',
        icon: 'heart',
        options: [
          { label: 'Plan a testimonial', text: 'You begin planning a special testimonial match and proper send-off.', effects: { morale: 8, boardConfidence: 4, fanMood: 8 } },
          { label: 'Keep it private for now', text: 'You agree to keep it between you until the time is right to announce.', effects: { morale: 4, boardConfidence: 2, fanMood: 0 } },
          { label: 'Try to change his mind', text: 'You tell him he still has a lot to offer and ask him to reconsider.', effects: { morale: 6, boardConfidence: 1, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 3,
        title: 'Passing the Armband',
        body: 'With the captain\'s retirement approaching, you need to think about succession. Several players have shown leadership qualities, and the dressing room is watching your decision closely.',
        icon: 'shield',
        options: [
          { label: 'Let the squad vote', text: 'You hold a secret ballot and let the players choose their next leader.', effects: { morale: 7, boardConfidence: 3, fanMood: 5 } },
          { label: 'Pick the natural leader', text: 'You appoint the player who\'s been the most vocal and consistent presence.', effects: { morale: 5, boardConfidence: 5, fanMood: 4 } },
          { label: 'Create a leadership group', text: 'Instead of one captain, you establish a group of four senior players.', effects: { morale: 6, boardConfidence: 4, fanMood: 3 } },
        ],
      },
      {
        weekOffset: 5,
        title: 'Final Match',
        body: 'It\'s the captain\'s last game. The stadium is packed, fans are holding scarves aloft, and there\'s a lump in everyone\'s throat. How do you mark the occasion?',
        icon: 'award',
        options: [
          { label: 'Start him and sub him off late', text: 'You give him one last run-out and bring him off to a standing ovation.', effects: { morale: 12, boardConfidence: 4, fanMood: 12 } },
          { label: 'Make him lead the team out', text: 'He walks the team out as captain one final time, with his children by his side.', effects: { morale: 10, boardConfidence: 3, fanMood: 10 } },
          { label: 'Keep it professional', text: 'You pick the team on merit. If he plays, great. The match comes first.', effects: { morale: 3, boardConfidence: 5, fanMood: -3 } },
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
    case 'media-scandal':
      return ctx.week >= 10;
    case 'injury-crisis':
      return ctx.recentLosses >= 1 && ctx.week >= 5;
    case 'board-takeover':
      return ctx.boardConfidence < 40 && ctx.week >= 15;
    case 'fan-protests':
      return ctx.boardConfidence < 35 && ctx.week >= 8;
    case 'rival-manager-feud':
      return ctx.recentLosses >= 1 && ctx.week >= 8;
    case 'contract-holdout':
      return ctx.hasStarPlayer && ctx.week >= 12;
    case 'record-breaking-run':
      return ctx.recentWins >= 4 && ctx.week >= 10;
    case 'local-academy-talent':
      return ctx.hasYouthProspect && ctx.week >= 8 && ctx.week <= 30;
    case 'stadium-expansion':
      return ctx.boardConfidence >= 60 && ctx.week >= 15;
    case 'cup-giant-killing':
      return ctx.week >= 5 && ctx.week <= 35;
    case 'captain-retirement':
      return ctx.week >= 25 && ctx.hasStarPlayer;
    default:
      return false;
  }
}
