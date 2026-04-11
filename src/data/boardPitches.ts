/**
 * Board Pitch Questions for Job Market Interviews
 * Used during the interview process when applying for manager positions.
 * Each interview selects 3 questions from different contexts.
 */

import type { PitchTone } from '@/types/game';

export interface PitchQuestionDef {
  question: string;
  context: 'vision' | 'budget' | 'youth' | 'transfers' | 'pressure';
  options: Record<PitchTone, { text: string; scoreModifier: number; bestForTier?: number }>;
}

export const PITCH_QUESTIONS: PitchQuestionDef[] = [
  // ── Vision ──
  {
    question: "What's your long-term vision for this club?",
    context: 'vision',
    options: {
      ambitious: { text: "I want to build a title-winning side within three seasons. We go big or we go home.", scoreModifier: 12, bestForTier: 1 },
      pragmatic: { text: "Steady improvement each year. Consolidate, stabilize, then push on.", scoreModifier: 8, bestForTier: 3 },
      developmental: { text: "Build from within. Invest in youth and create a sustainable model for success.", scoreModifier: 10, bestForTier: 4 },
      defensive: { text: "Make us hard to beat first. Organization and discipline — results will follow.", scoreModifier: 6 },
    },
  },
  {
    question: "Where do you see this club in five years?",
    context: 'vision',
    options: {
      ambitious: { text: "Competing at the highest level. I don't settle for anything less than the top.", scoreModifier: 11, bestForTier: 1 },
      pragmatic: { text: "Established in this division with a growing reputation and financial stability.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "A club known for producing talent — a pipeline that the bigger clubs envy.", scoreModifier: 10, bestForTier: 4 },
      defensive: { text: "Solid. Secure. A club that never has to worry about going down.", scoreModifier: 5 },
    },
  },
  {
    question: "What makes you the right person for this job?",
    context: 'vision',
    options: {
      ambitious: { text: "I've got the tactical brain and the hunger. I'll transform this squad.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "I know how to get results with what I'm given. I'm a problem-solver.", scoreModifier: 9, bestForTier: 3 },
      developmental: { text: "I develop players. Every club I've been at, players have improved under me.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "I bring structure and organization. My teams are always well-drilled.", scoreModifier: 7 },
    },
  },
  {
    question: "What style of football will the fans see under your management?",
    context: 'vision',
    options: {
      ambitious: { text: "Attacking, dominant football. We'll control possession and create chances.", scoreModifier: 11, bestForTier: 1 },
      pragmatic: { text: "Effective football. Whatever gets us three points — I'm adaptable.", scoreModifier: 8, bestForTier: 2 },
      developmental: { text: "Technical football built on good coaching. The young lads will flourish.", scoreModifier: 9, bestForTier: 4 },
      defensive: { text: "Solid at the back, lethal on the counter. We'll be hard to break down.", scoreModifier: 7, bestForTier: 3 },
    },
  },
  {
    question: "How will you put your stamp on this club from day one?",
    context: 'vision',
    options: {
      ambitious: { text: "Immediate signings. I'll identify weaknesses and bring in quality fast.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "I'll assess what we have first. Get to know the squad before making changes.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Start with the training ground. Upgrade how we develop players daily.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "Tactical structure. Within a week they'll know their roles inside out.", scoreModifier: 7, bestForTier: 3 },
    },
  },

  // ── Budget ──
  {
    question: "How would you allocate our transfer budget?",
    context: 'budget',
    options: {
      ambitious: { text: "Spend big on proven quality. One top signing can change everything.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "Spread it wisely across several areas. Strengthen the weak points.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Invest in young prospects with high potential. They're the future.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "Prioritize defensive reinforcements. A solid backline is the foundation.", scoreModifier: 7, bestForTier: 3 },
    },
  },
  {
    question: "The budget is tight this season. How do you plan to work with limited funds?",
    context: 'budget',
    options: {
      ambitious: { text: "Generate funds through sales and reinvest. You have to speculate to accumulate.", scoreModifier: 9, bestForTier: 1 },
      pragmatic: { text: "Loans, free agents, and smart deals. You don't need millions to improve.", scoreModifier: 11, bestForTier: 3 },
      developmental: { text: "Promote from the academy. We have talent there — let's give them a chance.", scoreModifier: 10, bestForTier: 4 },
      defensive: { text: "Focus on organization rather than signings. Coach the existing players better.", scoreModifier: 7, bestForTier: 3 },
    },
  },
  {
    question: "Would you prioritize transfers or improving facilities?",
    context: 'budget',
    options: {
      ambitious: { text: "Transfers. You need players to win matches — bricks and mortar can wait.", scoreModifier: 9, bestForTier: 1 },
      pragmatic: { text: "A balance of both. Good facilities attract better players long-term.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Facilities first. An upgraded academy will pay dividends for decades.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "Medical and fitness facilities. Keeping players fit is the priority.", scoreModifier: 6 },
    },
  },
  {
    question: "If you had to sell a key player to balance the books, how would you handle it?",
    context: 'budget',
    options: {
      ambitious: { text: "Get top dollar and reinvest every penny into a replacement or two.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "It's part of the game. Sell smart, plan ahead, and the squad copes.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Replace from within. If we've done our academy work, the next one is ready.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "I'd fight to keep them. But if forced, I'd protect the defensive core.", scoreModifier: 6, bestForTier: 3 },
    },
  },

  // ── Youth ──
  {
    question: "What role will the academy play under your management?",
    context: 'youth',
    options: {
      ambitious: { text: "It feeds the first team with talent. Our best youngsters will get chances.", scoreModifier: 9 },
      pragmatic: { text: "Academy players fill the squad depth. Some will break through, some won't.", scoreModifier: 7, bestForTier: 2 },
      developmental: { text: "The academy is the heartbeat of the club. Every player gets a pathway.", scoreModifier: 12, bestForTier: 4 },
      defensive: { text: "Young players need to earn their place. I won't throw them in unprepared.", scoreModifier: 6 },
    },
  },
  {
    question: "How quickly would you trust a 17-year-old in the first team?",
    context: 'youth',
    options: {
      ambitious: { text: "If they're good enough, they're old enough. Age is just a number.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "Cup games and easier fixtures first. Let them taste it gradually.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Immediately if they've earned it in training. That's how you develop stars.", scoreModifier: 11, bestForTier: 4 },
      defensive: { text: "They need to prove they can handle the pressure. Protection first.", scoreModifier: 5, bestForTier: 3 },
    },
  },
  {
    question: "A rival club wants to buy our best academy prospect. Your stance?",
    context: 'youth',
    options: {
      ambitious: { text: "If the price is right and we can reinvest wisely, I'd consider it.", scoreModifier: 7, bestForTier: 1 },
      pragmatic: { text: "It depends on the fee and whether they'll get game time here.", scoreModifier: 8, bestForTier: 2 },
      developmental: { text: "Not for sale. Our best youth talent stays and develops here.", scoreModifier: 11, bestForTier: 4 },
      defensive: { text: "Sell, but insert a buy-back clause. That's smart business.", scoreModifier: 8, bestForTier: 3 },
    },
  },
  {
    question: "How would you rate the importance of youth development versus buying proven players?",
    context: 'youth',
    options: {
      ambitious: { text: "Proven players win trophies. Youth development is a bonus, not the strategy.", scoreModifier: 8, bestForTier: 1 },
      pragmatic: { text: "You need both. Smart recruitment plus academy output — that's the sweet spot.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Youth development is everything. The club's identity should be built on homegrown talent.", scoreModifier: 12, bestForTier: 4 },
      defensive: { text: "Experienced players first. They mentor the youth and stabilize the squad.", scoreModifier: 6, bestForTier: 3 },
    },
  },

  // ── Transfers ──
  {
    question: "What's your approach to recruitment?",
    context: 'transfers',
    options: {
      ambitious: { text: "Target the best players available. Quality over quantity, every time.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "Data-driven scouting. Find undervalued players who fit our system.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Young, hungry players with room to grow. Buy potential, sell at peak.", scoreModifier: 9, bestForTier: 4 },
      defensive: { text: "Experience and reliability. I want players who won't let us down.", scoreModifier: 7, bestForTier: 3 },
    },
  },
  {
    question: "How do you feel about the loan market?",
    context: 'transfers',
    options: {
      ambitious: { text: "Loans are a stopgap. If I want a player, I want to own them.", scoreModifier: 8, bestForTier: 1 },
      pragmatic: { text: "Smart loans can be game-changers. Get top talent without the commitment.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Great for sending our young lads out to get experience.", scoreModifier: 9, bestForTier: 4 },
      defensive: { text: "Useful for plugging gaps at short notice without financial risk.", scoreModifier: 8, bestForTier: 3 },
    },
  },
  {
    question: "Would you be willing to sell a star player to fund a squad rebuild?",
    context: 'transfers',
    options: {
      ambitious: { text: "If it funds three or four quality signings? Absolutely. Build a team, not a fantasy.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "Only if the overall squad becomes stronger. It has to make mathematical sense.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Sell high, buy young. Reinvest the profit into the next generation.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "Very reluctantly. You don't sell your best defender in a relegation fight.", scoreModifier: 6, bestForTier: 3 },
    },
  },
  {
    question: "The January window is approaching and we're mid-table. Do you want to buy?",
    context: 'transfers',
    options: {
      ambitious: { text: "Always. There's never a bad time to improve the squad.", scoreModifier: 9, bestForTier: 1 },
      pragmatic: { text: "Only if there's a clear need. I won't spend for the sake of it.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Loan in some youngsters for experience. Save the budget for summer.", scoreModifier: 7, bestForTier: 4 },
      defensive: { text: "Maybe a defensive reinforcement if we're leaking goals.", scoreModifier: 7, bestForTier: 3 },
    },
  },

  // ── Pressure ──
  {
    question: "How will you handle the pressure from our passionate fanbase?",
    context: 'pressure',
    options: {
      ambitious: { text: "I thrive on pressure. When the fans demand success, I deliver it.", scoreModifier: 10, bestForTier: 1 },
      pragmatic: { text: "Communication is key. Keep the fans informed and they'll stay patient.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Give them exciting young talent to get behind. Fans love seeing academy lads.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "Results speak louder than words. Win games and the fans are happy.", scoreModifier: 7, bestForTier: 3 },
    },
  },
  {
    question: "If we're in a relegation fight, what's your approach?",
    context: 'pressure',
    options: {
      ambitious: { text: "Attack our way out of trouble. You can't play scared — that's when you go down.", scoreModifier: 7 },
      pragmatic: { text: "Manage every detail. Set pieces, game management, discipline — leave nothing to chance.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Trust the young lads. They have no fear and will fight for the shirt.", scoreModifier: 6, bestForTier: 4 },
      defensive: { text: "Shut up shop. We go hard to beat and take every point we can grind out.", scoreModifier: 11, bestForTier: 3 },
    },
  },
  {
    question: "What if results don't go your way early on?",
    context: 'pressure',
    options: {
      ambitious: { text: "I'll back myself. My methods work — it just takes time to implement them.", scoreModifier: 8, bestForTier: 1 },
      pragmatic: { text: "Analyze, adapt, and adjust. I'm not too proud to change my approach.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "Short-term results don't define a project. We're building something bigger.", scoreModifier: 7, bestForTier: 4 },
      defensive: { text: "Go back to basics. Defensive solidity first, then rebuild from there.", scoreModifier: 9, bestForTier: 3 },
    },
  },
  {
    question: "The media will be watching your every move. How do you handle the spotlight?",
    context: 'pressure',
    options: {
      ambitious: { text: "Let them watch. I've got nothing to hide — my record speaks for itself.", scoreModifier: 9, bestForTier: 1 },
      pragmatic: { text: "Keep it professional. Say the right things, let the football do the talking.", scoreModifier: 9, bestForTier: 2 },
      developmental: { text: "Use the media to shine a light on the club's young talent. Great PR.", scoreModifier: 7, bestForTier: 4 },
      defensive: { text: "I don't care what the media says. I focus on my job and my players.", scoreModifier: 8, bestForTier: 3 },
    },
  },
  {
    question: "How important is it for you to have the full backing of the board?",
    context: 'pressure',
    options: {
      ambitious: { text: "Essential. Give me the resources and trust, and I'll deliver trophies.", scoreModifier: 9, bestForTier: 1 },
      pragmatic: { text: "Important, but I can work without it. I'll prove my value on the pitch.", scoreModifier: 10, bestForTier: 2 },
      developmental: { text: "I just need patience. A development project can't be rushed.", scoreModifier: 8, bestForTier: 4 },
      defensive: { text: "I keep my head down and do my job. Results earn board backing.", scoreModifier: 7, bestForTier: 3 },
    },
  },
];
