import type { PressConference, PressOption, PressResponseTone } from '@/types/game';
import { pick } from '@/utils/helpers';
import { PRESS_TRANSFER_RUMOUR_CHANCE, PRESS_POOR_FORM_LOSSES, PRESS_GOOD_FORM_WINS, PRESS_BIG_MATCH_REP_GAP } from '@/config/gameBalance';

interface QuestionDef {
  question: string;
  options: Record<PressResponseTone, { text: string; effects: PressOption['effects'] }>;
  proOption?: { tone: string; text: string; effects: PressOption['effects'] };
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
      options: [...baseOptions, { tone: chosen.proOption.tone as PressResponseTone, text: chosen.proOption.text, effects: chosen.proOption.effects }],
    };
  }

  return {
    id: crypto.randomUUID(),
    context,
    question: chosen.question,
    options: baseOptions,
  };
}

/** Determine what kind of press conference to show based on game state */
export function getPressContext(
  won: boolean | null,
  lost: boolean | null,
  recentForm: ('W' | 'D' | 'L')[],
  hasListedPlayers: boolean,
  opponentReputation?: number,
  playerReputation?: number,
): PressConference['context'] {
  // Post-match always takes priority
  if (won === true) return 'post_win';
  if (lost === true) return 'post_loss';
  if (won === false && lost === false) return 'post_draw';

  // Pre-match or weekly contexts
  const last5 = recentForm.slice(-5);
  const losses = last5.filter(r => r === 'L').length;
  const wins = last5.filter(r => r === 'W').length;

  if (hasListedPlayers && Math.random() < PRESS_TRANSFER_RUMOUR_CHANCE) return 'transfer_rumour';
  if (losses >= PRESS_POOR_FORM_LOSSES) return 'poor_form';
  if (wins >= PRESS_GOOD_FORM_WINS) return 'good_form';
  if (opponentReputation && playerReputation && opponentReputation >= playerReputation + PRESS_BIG_MATCH_REP_GAP) return 'pre_big_match';

  // Default to form-based
  return wins > losses ? 'good_form' : 'poor_form';
}
