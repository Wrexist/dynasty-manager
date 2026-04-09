import type { PressConference, PressOption, PressResponseTone } from '@/types/game';
import { pick } from '@/utils/helpers';
import { PRESS_TRANSFER_RUMOUR_CHANCE, PRESS_POOR_FORM_LOSSES, PRESS_GOOD_FORM_WINS, PRESS_BIG_MATCH_REP_GAP, PRESS_PROMOTION_RACE_TOP_N, PRESS_RELEGATION_BATTLE_BOTTOM_N, PRESS_INJURY_CRISIS_MIN, PRESS_DERBY_PREVIEW_CHANCE } from '@/config/gameBalance';

interface QuestionDef {
  question: string;
  options: Record<'confident' | 'humble' | 'deflect', { text: string; effects: PressOption['effects'] }>;
  proOption?: { tone: PressResponseTone; text: string; effects: PressOption['effects'] };
}

// Pool of press conference questions by context
const QUESTIONS: Record<PressConference['context'], QuestionDef[]> = {
  post_win: [
    {
      question: 'A great result today. How do you feel about the team\'s performance?',
      options: {
        confident: { text: 'We dominated from start to finish. This is the standard we set.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'The lads worked incredibly hard. Credit to every single one of them.', effects: { morale: 12, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'It\'s just three points. We focus on the next game now.', effects: { morale: 4, boardConfidence: 2, fanMood: 2 } },
      },
      proOption: { tone: 'strategic', text: 'We identified their weaknesses in prep and executed perfectly. That\'s what elite analysis gives you.', effects: { morale: 10, boardConfidence: 7, fanMood: 6 } },
    },
    {
      question: 'The fans seem delighted. Is this the turning point of the season?',
      options: {
        confident: { text: 'We\'re building something special here. The fans can see it.', effects: { morale: 6, boardConfidence: 6, fanMood: 10 } },
        humble: { text: 'It\'s a step in the right direction, but we can\'t get carried away.', effects: { morale: 8, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Let\'s not get ahead of ourselves. One game at a time.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'Your striker was clinical today. How important is his form to the team right now?',
      options: {
        confident: { text: 'He\'s the best in the division and he proved it again today.', effects: { morale: 7, boardConfidence: 4, fanMood: 9 } },
        humble: { text: 'He\'d be the first to say it\'s a team effort. We create the chances, he finishes them.', effects: { morale: 10, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'Individual performances matter less than the collective. The system works.', effects: { morale: 5, boardConfidence: 2, fanMood: 3 } },
      },
    },
    {
      question: 'You made some bold tactical changes at half-time. Was that always the plan?',
      options: {
        confident: { text: 'I read the game perfectly. Sometimes you have to be brave to win.', effects: { morale: 6, boardConfidence: 6, fanMood: 7 } },
        humble: { text: 'The players deserve the credit. They adapted brilliantly to the new shape.', effects: { morale: 11, boardConfidence: 3, fanMood: 4 } },
        deflect: { text: 'We always have a Plan B ready. Good preparation is key.', effects: { morale: 4, boardConfidence: 3, fanMood: 2 } },
      },
      proOption: { tone: 'analytical', text: 'Our data team flagged their vulnerability on the left side. The switch to an asymmetric shape exploited that perfectly.', effects: { morale: 9, boardConfidence: 7, fanMood: 6 } },
    },
    {
      question: 'That\'s three wins on the bounce now. Is confidence sky-high in the dressing room?',
      options: {
        confident: { text: 'The lads feel unstoppable right now, and so they should. We\'re the form team in this league.', effects: { morale: 9, boardConfidence: 5, fanMood: 9 } },
        humble: { text: 'Confidence is good but we keep each other grounded. Nobody gets complacent in my squad.', effects: { morale: 10, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Three wins is nice, but there are no prizes handed out in March. We keep going.', effects: { morale: 4, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'Your midfield completely controlled the tempo today. Is that something you\'ve been working on specifically?',
      options: {
        confident: { text: 'That\'s the blueprint. When we dictate the game, nobody can live with us.', effects: { morale: 7, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'The lads in the middle were outstanding. They followed the game plan to the letter.', effects: { morale: 11, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'We work on everything in training. Today it all clicked, but the focus is already on next week.', effects: { morale: 5, boardConfidence: 3, fanMood: 2 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve been drilling a specific pressing trigger in the second phase. When they played out from the back, our midfield knew exactly when to squeeze.', effects: { morale: 9, boardConfidence: 6, fanMood: 6 } },
    },
  ],
  post_loss: [
    {
      question: 'A disappointing result. What went wrong out there?',
      options: {
        confident: { text: 'We\'ll bounce back. One bad day doesn\'t define this squad.', effects: { morale: 5, boardConfidence: -2, fanMood: 3 } },
        humble: { text: 'I take full responsibility. We weren\'t good enough today.', effects: { morale: -3, boardConfidence: 2, fanMood: 5 } },
        deflect: { text: 'Some decisions didn\'t go our way. I won\'t say more than that.', effects: { morale: 0, boardConfidence: -4, fanMood: -3 } },
      },
      proOption: { tone: 'analytical', text: 'I\'ve already reviewed the data. We lost control in the middle third — that\'s fixable by Tuesday.', effects: { morale: 6, boardConfidence: 3, fanMood: 4 } },
    },
    {
      question: 'The fans are frustrated. Are you worried about your position?',
      options: {
        confident: { text: 'Not at all. I know exactly what this team is capable of.', effects: { morale: 8, boardConfidence: -3, fanMood: 2 } },
        humble: { text: 'I understand their frustration. We owe them better performances.', effects: { morale: -2, boardConfidence: 4, fanMood: 6 } },
        deflect: { text: 'I\'m focused on the training ground, not speculation.', effects: { morale: 2, boardConfidence: 0, fanMood: -2 } },
      },
    },
    {
      question: 'You conceded early and never recovered. Is there a mentality problem in this squad?',
      options: {
        confident: { text: 'Absolutely not. This group has character. One setback doesn\'t change that.', effects: { morale: 6, boardConfidence: -2, fanMood: 2 } },
        humble: { text: 'We need to be more resilient. Going behind can\'t mean the game is over.', effects: { morale: -1, boardConfidence: 3, fanMood: 4 } },
        deflect: { text: 'It\'s easy to read too much into one result. We move on.', effects: { morale: 1, boardConfidence: -1, fanMood: -2 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve identified a pattern in our set-piece defending. We\'ll drill it intensively this week and the data suggests we can fix it quickly.', effects: { morale: 5, boardConfidence: 4, fanMood: 3 } },
    },
    {
      question: 'Your defence looked all over the place today. Are you considering changes at the back?',
      options: {
        confident: { text: 'I back my defenders. They\'ve been excellent all season and one bad day won\'t change my mind.', effects: { morale: 7, boardConfidence: -3, fanMood: 1 } },
        humble: { text: 'We made individual errors that were punished. We\'ll look at everything this week.', effects: { morale: -2, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'Team selection is my business. I don\'t discuss it publicly.', effects: { morale: 0, boardConfidence: -1, fanMood: -3 } },
      },
    },
    {
      question: 'You\'ve now lost three of your last five. Is this a crisis?',
      options: {
        confident: { text: 'Crisis? That word gets thrown around too easily. We have the quality to turn this around quickly.', effects: { morale: 6, boardConfidence: -3, fanMood: 2 } },
        humble: { text: 'I won\'t sugarcoat it — results haven\'t been acceptable. We need to look at ourselves honestly.', effects: { morale: -2, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'Labels like that don\'t help anyone. We focus on the next game and go from there.', effects: { morale: 1, boardConfidence: -1, fanMood: -2 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve drilled down into the stats and the margins are tiny. Small adjustments in transitions will make a big difference — we\'re implementing changes this week.', effects: { morale: 5, boardConfidence: 4, fanMood: 3 } },
    },
    {
      question: 'Your substitutions didn\'t seem to have the desired impact today. Do you regret any of your decisions?',
      options: {
        confident: { text: 'I stand by every decision I made. Sometimes the bounces just don\'t go your way.', effects: { morale: 5, boardConfidence: -2, fanMood: 1 } },
        humble: { text: 'Hindsight is a wonderful thing. I\'ll review everything and learn from it.', effects: { morale: -1, boardConfidence: 3, fanMood: 4 } },
        deflect: { text: 'I\'d rather not go into specific decisions. We win and lose as a team.', effects: { morale: 1, boardConfidence: 0, fanMood: -1 } },
      },
    },
  ],
  post_draw: [
    {
      question: 'A draw today. Is that a fair result?',
      options: {
        confident: { text: 'We should have won that. We created enough chances.', effects: { morale: 4, boardConfidence: 0, fanMood: 2 } },
        humble: { text: 'A point away from home is always valuable in this league.', effects: { morale: 5, boardConfidence: 2, fanMood: 3 } },
        deflect: { text: 'The table will tell the story at the end of the season.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
    {
      question: 'You had a late equaliser ruled out. Do you feel hard done by?',
      options: {
        confident: { text: 'We were the better side and the officials let us down. Simple as that.', effects: { morale: 5, boardConfidence: -1, fanMood: 4 } },
        humble: { text: 'Decisions go for you and against you over a season. We need to put ourselves in positions where it doesn\'t matter.', effects: { morale: 6, boardConfidence: 3, fanMood: 2 } },
        deflect: { text: 'I haven\'t seen it back yet, so I won\'t comment on the decision.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
    {
      question: 'Both teams cancelled each other out. Is this a sign you need more creativity?',
      options: {
        confident: { text: 'We had the chances to win. It\'s about being more ruthless in the final third.', effects: { morale: 4, boardConfidence: 1, fanMood: 3 } },
        humble: { text: 'There\'s always room to improve. We\'ll work on creating better openings in training.', effects: { morale: 5, boardConfidence: 3, fanMood: 2 } },
        deflect: { text: 'You can\'t win every game. A draw against a good side is no disaster.', effects: { morale: 3, boardConfidence: 1, fanMood: 1 } },
      },
      proOption: { tone: 'strategic', text: 'We knew they\'d sit deep and congest the middle. We\'re developing new rotational patterns to break down low blocks.', effects: { morale: 6, boardConfidence: 4, fanMood: 3 } },
    },
    {
      question: 'You dominated possession but couldn\'t find the breakthrough. Is that frustrating?',
      options: {
        confident: { text: 'If we keep performing like that, the goals will come. We were the better side by a distance.', effects: { morale: 5, boardConfidence: 1, fanMood: 3 } },
        humble: { text: 'We need to be more clinical. Creating chances is one thing, finishing them is another.', effects: { morale: 4, boardConfidence: 3, fanMood: 2 } },
        deflect: { text: 'Football is unpredictable. On another day we score three or four.', effects: { morale: 2, boardConfidence: 1, fanMood: 1 } },
      },
    },
    {
      question: 'Your goalkeeper kept you in it with some big saves. Is a draw a good result considering?',
      options: {
        confident: { text: 'That\'s why we have a top keeper. But we should have been better in front of him.', effects: { morale: 4, boardConfidence: 0, fanMood: 2 } },
        humble: { text: 'He was fantastic. Honestly, a point might be a fair reflection given how the game played out.', effects: { morale: 6, boardConfidence: 2, fanMood: 3 } },
        deflect: { text: 'Goalkeepers make saves, that\'s their job. We move on to the next one.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
  ],
  pre_big_match: [
    {
      question: 'A huge match coming up. How are you preparing the squad?',
      options: {
        confident: { text: 'We fear no one. We\'re going there to win.', effects: { morale: 10, boardConfidence: 3, fanMood: 8 } },
        humble: { text: 'We respect the opponent but believe in our quality.', effects: { morale: 6, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'It\'s another game. We treat every match the same.', effects: { morale: 2, boardConfidence: 1, fanMood: -1 } },
      },
    },
    {
      question: 'This is a local derby with a lot of history. What does this fixture mean to you and the club?',
      options: {
        confident: { text: 'Derbies are about pride and bragging rights. We intend to deliver both.', effects: { morale: 9, boardConfidence: 2, fanMood: 10 } },
        humble: { text: 'We know what it means to the supporters. We\'ll give everything for them.', effects: { morale: 7, boardConfidence: 3, fanMood: 7 } },
        deflect: { text: 'Emotions run high in these games, but we have to stay professional and focused.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'Your opponents are top of the table. Do you see this as a free hit or a chance to make a statement?',
      options: {
        confident: { text: 'A statement. We\'re going to show everyone we belong at this level.', effects: { morale: 10, boardConfidence: 4, fanMood: 9 } },
        humble: { text: 'They\'re top for a reason, but on any given day anything can happen in football.', effects: { morale: 5, boardConfidence: 4, fanMood: 3 } },
        deflect: { text: 'Whether they\'re first or last, our preparation stays the same.', effects: { morale: 2, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'visionary', text: 'We\'ve studied their patterns extensively. Every team has tendencies they can\'t hide, and we\'ve built a specific game plan to exploit theirs.', effects: { morale: 8, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'Your squad depth will be tested this week with injuries and suspensions. Are you concerned?',
      options: {
        confident: { text: 'Not at all. We have quality throughout the squad and whoever comes in will do a job.', effects: { morale: 8, boardConfidence: 3, fanMood: 6 } },
        humble: { text: 'It\'s a challenge, but it\'s also an opportunity for others to stake their claim.', effects: { morale: 6, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Every team deals with this throughout the season. It\'s nothing new.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'The atmosphere is expected to be hostile away from home. How do you prepare your players mentally for that?',
      options: {
        confident: { text: 'We thrive in hostile environments. The noise just fires us up.', effects: { morale: 10, boardConfidence: 3, fanMood: 8 } },
        humble: { text: 'We talk about staying composed and focused on our game. Block out the noise and trust the process.', effects: { morale: 6, boardConfidence: 4, fanMood: 3 } },
        deflect: { text: 'Atmosphere is for the fans. The players just concentrate on what happens between the white lines.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve simulated high-pressure scenarios in training this week. The sports psychologist has worked with the squad on maintaining concentration under duress.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
    },
  ],
  transfer_rumour: [
    {
      question: 'There are rumours of interest in one of your key players. Can you comment?',
      options: {
        confident: { text: 'No one is leaving. This squad is going places together.', effects: { morale: 10, boardConfidence: 2, fanMood: 6 } },
        humble: { text: 'Every player has a price, but we\'re not actively looking to sell.', effects: { morale: -2, boardConfidence: 5, fanMood: -2 } },
        deflect: { text: 'I don\'t comment on speculation. Next question.', effects: { morale: 3, boardConfidence: 1, fanMood: 0 } },
      },
    },
    {
      question: 'Reports suggest a bid has been rejected for your captain. Is the club holding firm?',
      options: {
        confident: { text: 'He\'s the heart of this team. They\'d have to offer something extraordinary to even start a conversation.', effects: { morale: 8, boardConfidence: 1, fanMood: 8 } },
        humble: { text: 'We\'ve made our position clear. But ultimately these things are never entirely in your control.', effects: { morale: 0, boardConfidence: 4, fanMood: 1 } },
        deflect: { text: 'Transfer business is handled behind closed doors, not in press conferences.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
    },
    {
      question: 'With the transfer window open, are you looking to bring anyone in?',
      options: {
        confident: { text: 'We\'re always looking to improve. If the right player becomes available, we\'ll move fast.', effects: { morale: 6, boardConfidence: 3, fanMood: 7 } },
        humble: { text: 'We\'re happy with the squad, but you always keep an eye on the market.', effects: { morale: 4, boardConfidence: 4, fanMood: 3 } },
        deflect: { text: 'I won\'t be discussing targets. That\'s between me and the board.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve identified specific profile gaps in our squad through data analysis. If we can fill those gaps, we\'ll be much stronger.', effects: { morale: 7, boardConfidence: 5, fanMood: 5 } },
    },
    {
      question: 'There\'s talk of a swap deal involving two of your first-team players. Is there any truth to that?',
      options: {
        confident: { text: 'Both of those players are crucial to my plans. Nobody is going anywhere.', effects: { morale: 9, boardConfidence: 1, fanMood: 7 } },
        humble: { text: 'I\'ll always listen to proposals that could improve the squad, but nothing is agreed.', effects: { morale: -1, boardConfidence: 5, fanMood: 0 } },
        deflect: { text: 'Swap deals, cash deals, free agents — I don\'t discuss specifics with the media.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
    },
    {
      question: 'A rival manager has publicly praised your star player. Do you think they\'re trying to unsettle him?',
      options: {
        confident: { text: 'They can say what they like. He\'s happy here and he\'s going nowhere. End of story.', effects: { morale: 8, boardConfidence: 2, fanMood: 8 } },
        humble: { text: 'It\'s flattering for the lad, but his focus is here. We\'ve spoken and he\'s committed.', effects: { morale: 5, boardConfidence: 3, fanMood: 4 } },
        deflect: { text: 'I can\'t control what other managers say. I focus on my own squad.', effects: { morale: 3, boardConfidence: 1, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve built a project around key players and the data shows we\'re on an upward trajectory. Smart players want to be part of that.', effects: { morale: 7, boardConfidence: 5, fanMood: 5 } },
    },
  ],
  poor_form: [
    {
      question: 'Your team has been struggling recently. What\'s the plan to turn things around?',
      options: {
        confident: { text: 'The quality is there. We just need a spark and we\'ll go on a run.', effects: { morale: 6, boardConfidence: -2, fanMood: 3 } },
        humble: { text: 'We\'re working on it every day on the training ground. Hard work fixes everything.', effects: { morale: 4, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'We need some time. Rome wasn\'t built in a day.', effects: { morale: 0, boardConfidence: -3, fanMood: -4 } },
      },
    },
    {
      question: 'Some fans are calling for your head on social media. How do you respond to that?',
      options: {
        confident: { text: 'Noise on the internet doesn\'t affect me. I know what I\'m doing and results will come.', effects: { morale: 5, boardConfidence: -3, fanMood: -2 } },
        humble: { text: 'The fans have every right to be frustrated. It\'s on me to deliver better results.', effects: { morale: -1, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'I don\'t do social media. I focus on what happens on the pitch.', effects: { morale: 1, boardConfidence: 0, fanMood: -1 } },
      },
    },
    {
      question: 'Are you worried about being dragged into a relegation battle at this rate?',
      options: {
        confident: { text: 'Relegation? We\'re far too good for that. The table will sort itself out.', effects: { morale: 7, boardConfidence: -4, fanMood: 2 } },
        humble: { text: 'We have to be honest about our situation. Every point matters from here on.', effects: { morale: 2, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'It\'s too early to look at the table. There are plenty of games left.', effects: { morale: 0, boardConfidence: -1, fanMood: -2 } },
      },
      proOption: { tone: 'analytical', text: 'Our underlying numbers are actually better than the results suggest. The expected goals data shows we\'ve been unlucky. Regression to the mean will kick in.', effects: { morale: 5, boardConfidence: 4, fanMood: 3 } },
    },
    {
      question: 'Your senior players seem to have lost their edge. Is it time to give youth a chance?',
      options: {
        confident: { text: 'My experienced players have delivered before and they\'ll deliver again. I won\'t panic.', effects: { morale: 5, boardConfidence: -2, fanMood: 1 } },
        humble: { text: 'Everyone has to earn their place. If young players are training better, they\'ll get opportunities.', effects: { morale: 3, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'Selection matters are for me to decide. I\'ll pick whoever gives us the best chance.', effects: { morale: 1, boardConfidence: 0, fanMood: -1 } },
      },
    },
    {
      question: 'Confidence looks shot out there. How do you rebuild belief in a struggling squad?',
      options: {
        confident: { text: 'You keep backing them. This group has the talent — we just need that one result to turn everything around.', effects: { morale: 7, boardConfidence: -2, fanMood: 3 } },
        humble: { text: 'We go back to basics. Simple football, clean sheets, and build from there. Confidence returns with results.', effects: { morale: 4, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'I\'m not going to discuss the mental state of my players publicly. That stays in-house.', effects: { morale: 0, boardConfidence: -1, fanMood: -2 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve restructured training this week to focus on quick wins — small-sided games, shooting drills. The psychology of success starts with feeling good in practice.', effects: { morale: 6, boardConfidence: 4, fanMood: 3 } },
    },
  ],
  good_form: [
    {
      question: 'The team is flying right now. What\'s behind this great run?',
      options: {
        confident: { text: 'This is just the beginning. We can do even better.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'Team spirit and hard work. Everyone is pulling in the same direction.', effects: { morale: 12, boardConfidence: 3, fanMood: 6 } },
        deflect: { text: 'Let\'s stay grounded. Plenty of football left to play.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'You\'re in the promotion places. Is it too early to talk about going up?',
      options: {
        confident: { text: 'Promotion is the target and we\'re right on track. This squad can handle the pressure.', effects: { morale: 9, boardConfidence: 4, fanMood: 10 } },
        humble: { text: 'We\'re in a good position but there\'s a long way to go. We just keep taking it week by week.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'I\'m not looking at the table yet. Ask me again in April.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'Your young players have been outstanding recently. Is this the future of the club?',
      options: {
        confident: { text: 'We\'ve got the best academy in the division. These kids are going to be stars.', effects: { morale: 8, boardConfidence: 6, fanMood: 9 } },
        humble: { text: 'They\'ve taken their chance brilliantly, but the experienced lads around them deserve credit for guiding them.', effects: { morale: 10, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'We don\'t think about age. If you\'re good enough, you\'re old enough.', effects: { morale: 4, boardConfidence: 2, fanMood: 2 } },
      },
      proOption: { tone: 'visionary', text: 'We\'ve invested heavily in youth development infrastructure. What you\'re seeing now is the first wave of a long-term project that will define this club for years.', effects: { morale: 9, boardConfidence: 7, fanMood: 7 } },
    },
    {
      question: 'The fans are dreaming of silverware. Are you allowing yourself to think about trophies?',
      options: {
        confident: { text: 'Why not? We\'re playing the best football in this division. If not us, then who?', effects: { morale: 9, boardConfidence: 4, fanMood: 10 } },
        humble: { text: 'Dreams are for the fans. My job is to prepare the team game by game and see where it takes us.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'There\'s a lot of football between now and the end of the season. I\'m not thinking that far ahead.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'Rival managers are starting to call you title contenders publicly. Does that add pressure?',
      options: {
        confident: { text: 'Pressure is a privilege. It means we\'re doing something right and they\'re worried about us.', effects: { morale: 10, boardConfidence: 5, fanMood: 9 } },
        humble: { text: 'It\'s nice to hear, but we\'re focused on our own journey. What others say doesn\'t change our approach.', effects: { morale: 8, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Other managers can say what they like. It makes no difference to how we prepare.', effects: { morale: 4, boardConfidence: 2, fanMood: 2 } },
      },
      proOption: { tone: 'visionary', text: 'External noise is just validation of the project we\'re building. The data backs it up — our squad metrics are trending in the right direction across every category.', effects: { morale: 9, boardConfidence: 6, fanMood: 6 } },
    },
  ],
  promotion_race: [
    {
      question: 'You\'re right in the promotion mix. How are you managing the pressure on the squad?',
      options: {
        confident: { text: 'Pressure? This is what we\'ve been building towards all season. The lads are loving every minute.', effects: { morale: 10, boardConfidence: 5, fanMood: 9 } },
        humble: { text: 'We take it one game at a time. The table looks after itself if you focus on performances.', effects: { morale: 8, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'There\'s a long way to go yet. I refuse to get drawn into the promotion talk.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve split the remaining fixtures into blocks. Each block has a points target — the players know exactly what\'s needed and when.', effects: { morale: 9, boardConfidence: 7, fanMood: 6 } },
    },
    {
      question: 'Automatic promotion is within reach. Is that the target or would you settle for playoffs?',
      options: {
        confident: { text: 'Automatic. We don\'t want the lottery of the playoffs. We\'re good enough to go up as champions.', effects: { morale: 11, boardConfidence: 4, fanMood: 10 } },
        humble: { text: 'Any promotion would be a fantastic achievement. We\'ll take whatever route gets us there.', effects: { morale: 7, boardConfidence: 5, fanMood: 5 } },
        deflect: { text: 'I don\'t set public targets. That only creates unnecessary pressure.', effects: { morale: 3, boardConfidence: 3, fanMood: 1 } },
      },
    },
    {
      question: 'Several of your players have attracted interest from clubs in the league above. Is that a distraction?',
      options: {
        confident: { text: 'If we go up, those players will be playing at that level anyway. There\'s no better project than this one.', effects: { morale: 9, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'It\'s flattering for the lads, but their heads are firmly here. We have unfinished business.', effects: { morale: 7, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'I don\'t engage with speculation about individual players during the business end of the season.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
    },
    {
      question: 'Your recent results have been inconsistent. Are nerves creeping in as the finish line approaches?',
      options: {
        confident: { text: 'Not nerves — hunger. Every team around us is feeling the heat too. We handle it better than most.', effects: { morale: 8, boardConfidence: 3, fanMood: 7 } },
        humble: { text: 'It would be strange if the players felt nothing at this stage. The key is channelling that energy positively.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'Inconsistency is normal in a long season. I\'m not reading anything into a couple of results.', effects: { morale: 2, boardConfidence: 1, fanMood: -1 } },
      },
      proOption: { tone: 'analytical', text: 'Our underlying performance metrics are actually improving. The results haven\'t fully reflected that yet, but the process is right and outcomes will follow.', effects: { morale: 7, boardConfidence: 6, fanMood: 4 } },
    },
    {
      question: 'The stadium has been packed recently. What does that support mean to you and the team?',
      options: {
        confident: { text: 'We feed off it. When this place is rocking, we\'re almost unbeatable. Keep coming, keep singing.', effects: { morale: 10, boardConfidence: 3, fanMood: 10 } },
        humble: { text: 'The fans have been incredible. They deserve promotion as much as anyone in that dressing room.', effects: { morale: 9, boardConfidence: 4, fanMood: 8 } },
        deflect: { text: 'Good atmosphere helps, but ultimately it\'s what happens on the pitch that decides things.', effects: { morale: 4, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'If you secure promotion, how ready is the squad to compete at the higher level?',
      options: {
        confident: { text: 'This squad is ready right now. We won\'t just survive up there — we\'ll compete.', effects: { morale: 10, boardConfidence: 4, fanMood: 9 } },
        humble: { text: 'We\'d need to strengthen, but the core group has shown they have the quality and mentality for it.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
        deflect: { text: 'Let\'s get promoted first before we start planning for next season.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'visionary', text: 'We\'ve already started scenario-planning for both outcomes. The recruitment pipeline and tactical evolution are mapped out for the next two seasons regardless.', effects: { morale: 8, boardConfidence: 7, fanMood: 5 } },
    },
  ],
  relegation_battle: [
    {
      question: 'Your team is in a relegation fight. How do you keep the dressing room together?',
      options: {
        confident: { text: 'We have too much quality to go down. The table is tight and a couple of wins changes everything.', effects: { morale: 8, boardConfidence: -2, fanMood: 4 } },
        humble: { text: 'Honesty. We\'re in a scrap and everyone needs to accept that and fight for their lives.', effects: { morale: 4, boardConfidence: 5, fanMood: 5 } },
        deflect: { text: 'I keep things calm. Panic never helped anyone in this situation.', effects: { morale: 2, boardConfidence: 0, fanMood: -1 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve mapped out every remaining fixture and identified the points total needed. The players know exactly what the target is — it makes it tangible, not abstract.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'The board is getting nervous. Have they given you any ultimatums?',
      options: {
        confident: { text: 'The board knows what I\'m doing. They hired me for situations exactly like this.', effects: { morale: 7, boardConfidence: -3, fanMood: 3 } },
        humble: { text: 'We\'ve had honest conversations. They understand the challenges and we\'re working together to fix things.', effects: { morale: 3, boardConfidence: 6, fanMood: 3 } },
        deflect: { text: 'What happens between me and the board stays private. My focus is on the pitch.', effects: { morale: 1, boardConfidence: 1, fanMood: -1 } },
      },
    },
    {
      question: 'Do you regret not strengthening the squad in the transfer window?',
      options: {
        confident: { text: 'Not at all. The players in this squad are good enough. They need to show it on the pitch.', effects: { morale: 6, boardConfidence: -2, fanMood: 1 } },
        humble: { text: 'Hindsight is easy. We tried to bring people in but the right deals weren\'t there. We work with what we have.', effects: { morale: 3, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Transfer windows are done. There\'s no point looking backwards. We focus on what\'s ahead.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
    {
      question: 'Some players look like they\'ve already given up. How do you motivate a squad in freefall?',
      options: {
        confident: { text: 'Given up? No. I see a group fighting for every ball. The character in that dressing room is not in question.', effects: { morale: 9, boardConfidence: -3, fanMood: 3 } },
        humble: { text: 'It\'s tough mentally. We\'re bringing in extra support and working on the psychological side as much as the football.', effects: { morale: 5, boardConfidence: 5, fanMood: 5 } },
        deflect: { text: 'I won\'t discuss individual players\' mentality publicly. That wouldn\'t help anyone.', effects: { morale: 0, boardConfidence: 0, fanMood: -2 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve simplified the game plan to give the players clarity. When you\'re struggling, complexity is the enemy. Simple structure, clear roles, maximum effort.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'Mathematically you can still survive. But realistically, what do you think?',
      options: {
        confident: { text: 'Forget mathematics — I believe in this group. Stranger things have happened in football.', effects: { morale: 10, boardConfidence: -2, fanMood: 6 } },
        humble: { text: 'It\'s going to be incredibly tough, I won\'t lie. But as long as there\'s a chance, we fight.', effects: { morale: 5, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'I don\'t deal in hypotheticals. We focus on the next game and only the next game.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
  ],
  new_signing: [
    {
      question: 'You\'ve just completed a signing. What does this player bring to the squad?',
      options: {
        confident: { text: 'He\'s exactly what we needed. Quality, experience, and an immediate upgrade on what we had.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'He\'s a good addition. He\'ll need time to settle in, but we think he can really contribute.', effects: { morale: 5, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'We identified a need and filled it. That\'s smart business, nothing more.', effects: { morale: 3, boardConfidence: 3, fanMood: 1 } },
      },
      proOption: { tone: 'analytical', text: 'The data profile was a perfect match for our system. His pressing metrics and chance creation numbers in the final third are exactly what our model identified as the missing piece.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'Some fans think you overpaid. Was this signing worth the investment?',
      options: {
        confident: { text: 'Quality costs money. When the fans see him play, they\'ll know it was a bargain.', effects: { morale: 7, boardConfidence: 3, fanMood: 7 } },
        humble: { text: 'The market dictates prices, not us. But we believe he\'ll give us great value over the life of his contract.', effects: { morale: 5, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'Transfer fees are between the clubs. I judge players by what they do on the pitch.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
    },
    {
      question: 'How quickly can we expect to see the new signing in the starting lineup?',
      options: {
        confident: { text: 'He\'s fit, he\'s hungry, and he could go straight into the side. Competition for places just got fierce.', effects: { morale: 6, boardConfidence: 4, fanMood: 8 } },
        humble: { text: 'We\'ll integrate him carefully. There\'s a settling-in period and we need to respect that.', effects: { morale: 4, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'Team selection is always based on training performance. He\'ll be treated no differently.', effects: { morale: 3, boardConfidence: 3, fanMood: 1 } },
      },
    },
    {
      question: 'Does this signing signal your ambition to the rest of the league?',
      options: {
        confident: { text: 'Absolutely. We\'re building something serious here and this proves we mean business.', effects: { morale: 9, boardConfidence: 5, fanMood: 10 } },
        humble: { text: 'It shows we\'re committed to improving, step by step. But one player alone doesn\'t win a league.', effects: { morale: 6, boardConfidence: 5, fanMood: 5 } },
        deflect: { text: 'We make signings to improve the squad, not to send signals to anyone else.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'visionary', text: 'This fits into a three-window recruitment plan we mapped out at the start. Each signing builds on the last — it\'s a deliberate, systematic squad evolution.', effects: { morale: 8, boardConfidence: 7, fanMood: 6 } },
    },
    {
      question: 'Your current players in that position might be worried now. How do you handle that conversation?',
      options: {
        confident: { text: 'If they\'re worried, good. Healthy competition raises everyone\'s level.', effects: { morale: 5, boardConfidence: 4, fanMood: 6 } },
        humble: { text: 'I\'ve spoken to them personally. Nobody loses their place without a fair fight for it.', effects: { morale: 7, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Private conversations between me and my players stay private.', effects: { morale: 2, boardConfidence: 2, fanMood: 0 } },
      },
    },
  ],
  injury_crisis: [
    {
      question: 'Multiple first-team players are sidelined. How severely does this affect your plans?',
      options: {
        confident: { text: 'This is why you build a deep squad. The next man steps up — simple as that.', effects: { morale: 8, boardConfidence: 3, fanMood: 6 } },
        humble: { text: 'It\'s a real blow, I won\'t pretend otherwise. But injuries are part of football and we have to adapt.', effects: { morale: 4, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'I\'m not going to make excuses. We deal with whatever hand we\'re dealt.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve run squad depth analysis and rotated the schedule to manage workload. The science says we can maintain 90% performance output even with these absences.', effects: { morale: 7, boardConfidence: 6, fanMood: 4 } },
    },
    {
      question: 'Is there a training or fitness issue behind so many injuries at once?',
      options: {
        confident: { text: 'No. These are contact injuries and bad luck, not a systemic problem.', effects: { morale: 5, boardConfidence: 2, fanMood: 3 } },
        humble: { text: 'We\'re reviewing everything with the medical team. If something needs to change, we\'ll change it.', effects: { morale: 3, boardConfidence: 6, fanMood: 5 } },
        deflect: { text: 'I don\'t discuss medical matters in detail. Our staff are excellent and I trust them completely.', effects: { morale: 2, boardConfidence: 2, fanMood: 0 } },
      },
    },
    {
      question: 'Are you considering dipping into the loan market to cover the gaps?',
      options: {
        confident: { text: 'We don\'t need emergency signings. The young lads coming through are ready — this is their moment.', effects: { morale: 9, boardConfidence: 2, fanMood: 7 } },
        humble: { text: 'We\'re keeping all options open. If the right player is available to help in the short term, we\'d look at it.', effects: { morale: 4, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'Transfer decisions are made privately. We\'ll do whatever\'s best for the club.', effects: { morale: 2, boardConfidence: 2, fanMood: 0 } },
      },
    },
    {
      question: 'Your captain is among the injured. Who steps up as leader now?',
      options: {
        confident: { text: 'We have leaders all over the pitch. One man doesn\'t carry this squad.', effects: { morale: 7, boardConfidence: 3, fanMood: 5 } },
        humble: { text: 'He\'s a huge loss on and off the pitch. But others have to show their leadership qualities now.', effects: { morale: 5, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'The armband goes to the next in line. That\'s been planned for a long time.', effects: { morale: 3, boardConfidence: 3, fanMood: 1 } },
      },
      proOption: { tone: 'strategic', text: 'We identified a leadership matrix at the start of the season. Four players share captaincy responsibilities across different game phases — it\'s distributed leadership, not one-man dependency.', effects: { morale: 8, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'Fans are worried this injury run could derail the season. What\'s your message to them?',
      options: {
        confident: { text: 'Stay the faith. This is a test and we\'ll come through it stronger. Every great season has a crisis chapter.', effects: { morale: 9, boardConfidence: 2, fanMood: 8 } },
        humble: { text: 'It\'s a difficult period but we\'re doing everything to get players back as quickly and safely as possible.', effects: { morale: 5, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'Worry doesn\'t help. We focus on what we can control and take it week by week.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
  ],
  derby_preview: [
    {
      question: 'The big derby is this weekend. What does this fixture mean to you personally?',
      options: {
        confident: { text: 'I live for these games. The atmosphere, the intensity — it\'s why you become a manager.', effects: { morale: 10, boardConfidence: 3, fanMood: 10 } },
        humble: { text: 'I know what it means to the supporters and the community. We\'ll do everything to bring them joy.', effects: { morale: 8, boardConfidence: 4, fanMood: 7 } },
        deflect: { text: 'It\'s three points like any other game. I try not to get caught up in the hype.', effects: { morale: 3, boardConfidence: 2, fanMood: -2 } },
      },
      proOption: { tone: 'visionary', text: 'Derbies define legacies. I want this group of players to be remembered as the team that dominated this rivalry for years to come.', effects: { morale: 11, boardConfidence: 5, fanMood: 9 } },
    },
    {
      question: 'Their manager has been talking a big game in the press this week. Any response?',
      options: {
        confident: { text: 'Let them talk. We\'ll do our talking on the pitch. They\'ll be quiet enough after 90 minutes.', effects: { morale: 9, boardConfidence: 3, fanMood: 9 } },
        humble: { text: 'Every manager has their own style. I respect them but we\'re fully focused on our own preparation.', effects: { morale: 6, boardConfidence: 4, fanMood: 3 } },
        deflect: { text: 'I don\'t read what other managers say. My energy goes into the training ground.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
    },
    {
      question: 'The form book goes out the window in derbies. Does that concern you?',
      options: {
        confident: { text: 'That suits us perfectly. We thrive when the pressure is on and emotions are high.', effects: { morale: 9, boardConfidence: 3, fanMood: 8 } },
        humble: { text: 'It can be unpredictable, yes. But good preparation gives you the best chance regardless of the occasion.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'I don\'t believe in those clichés. The better team on the day will win.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'Actually the data tells a different story. Derby outcomes correlate strongly with set-piece efficiency and second-ball wins. We\'ve drilled both relentlessly this week.', effects: { morale: 7, boardConfidence: 6, fanMood: 4 } },
    },
    {
      question: 'There have been ugly scenes at this fixture in the past. How are you managing the emotional side?',
      options: {
        confident: { text: 'My players are professionals. They\'ll be fired up but disciplined. We don\'t need to be told how to behave.', effects: { morale: 7, boardConfidence: 4, fanMood: 6 } },
        humble: { text: 'We\'ve spoken about keeping our composure. Passion is great, but not at the cost of discipline.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'That\'s ancient history. This is a new squad and a new chapter.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
    {
      question: 'A derby win could define the season for the fans. Do you embrace that expectation or try to block it out?',
      options: {
        confident: { text: 'We embrace it. This squad wants to be remembered. Big players show up in big moments.', effects: { morale: 11, boardConfidence: 4, fanMood: 10 } },
        humble: { text: 'The fans\' passion is the lifeblood of the club. We owe them a performance worthy of it.', effects: { morale: 8, boardConfidence: 4, fanMood: 7 } },
        deflect: { text: 'One game doesn\'t define a season. But we\'ll give absolutely everything to win it.', effects: { morale: 4, boardConfidence: 3, fanMood: 2 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve studied their defensive structure extensively. There are three specific patterns we\'ve drilled to exploit their high line. The players know exactly what to do.', effects: { morale: 9, boardConfidence: 6, fanMood: 6 } },
    },
  ],
};

/** Pick a press conference appropriate to the context */
export function generatePressConference(context: PressConference['context'], proUser = false): PressConference {
  const pool = QUESTIONS[context];
  const chosen = pick(pool);
  const baseOptions: [PressOption, PressOption, PressOption] = [
    { tone: 'confident', text: chosen.options.confident.text, effects: chosen.options.confident.effects },
    { tone: 'humble', text: chosen.options.humble.text, effects: chosen.options.humble.effects },
    { tone: 'deflect', text: chosen.options.deflect.text, effects: chosen.options.deflect.effects },
  ];

  if (proUser && chosen.proOption) {
    return {
      id: crypto.randomUUID(),
      context,
      question: chosen.question,
      options: [...baseOptions, { tone: chosen.proOption.tone, text: chosen.proOption.text, effects: chosen.proOption.effects }],
    };
  }

  return {
    id: crypto.randomUUID(),
    context,
    question: chosen.question,
    options: baseOptions,
  };
}

/** Extra context data for richer press conference selection */
export interface PressContextExtras {
  leaguePosition?: number;
  totalTeams?: number;
  recentSigning?: boolean;
  injuredCount?: number;
  isDerby?: boolean;
}

/** Determine what kind of press conference to show based on game state */
export function getPressContext(
  won: boolean | null,
  lost: boolean | null,
  recentForm: ('W' | 'D' | 'L')[],
  hasListedPlayers: boolean,
  opponentReputation?: number,
  playerReputation?: number,
  extras?: PressContextExtras,
): PressConference['context'] {
  // Post-match always takes priority
  if (won === true) return 'post_win';
  if (lost === true) return 'post_loss';
  if (won === false && lost === false) return 'post_draw';

  // Pre-match or weekly contexts
  const last5 = recentForm.slice(-5);
  const losses = last5.filter(r => r === 'L').length;
  const wins = last5.filter(r => r === 'W').length;

  // New signing takes immediate priority (one-time event)
  if (extras?.recentSigning) return 'new_signing';

  // Derby preview before reputation-based big match
  if (extras?.isDerby && Math.random() < PRESS_DERBY_PREVIEW_CHANCE) return 'derby_preview';

  // Injury crisis
  if (extras?.injuredCount && extras.injuredCount >= PRESS_INJURY_CRISIS_MIN) return 'injury_crisis';

  // Transfer rumours
  if (hasListedPlayers && Math.random() < PRESS_TRANSFER_RUMOUR_CHANCE) return 'transfer_rumour';

  // League position contexts (only when position data available)
  if (extras?.leaguePosition && extras?.totalTeams) {
    if (extras.leaguePosition <= PRESS_PROMOTION_RACE_TOP_N && wins >= 2) return 'promotion_race';
    if (extras.leaguePosition > extras.totalTeams - PRESS_RELEGATION_BATTLE_BOTTOM_N) return 'relegation_battle';
  }

  if (losses >= PRESS_POOR_FORM_LOSSES) return 'poor_form';
  if (wins >= PRESS_GOOD_FORM_WINS) return 'good_form';
  if (opponentReputation && playerReputation && opponentReputation >= playerReputation + PRESS_BIG_MATCH_REP_GAP) return 'pre_big_match';

  // Default to form-based
  return wins > losses ? 'good_form' : 'poor_form';
}
