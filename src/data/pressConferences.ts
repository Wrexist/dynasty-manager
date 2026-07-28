import type { PressConference, PressOption, PressResponseTone } from '@/types/game';
import { pick, safeRandomUUID } from '@/utils/helpers';
import { PRESS_TRANSFER_RUMOUR_CHANCE, PRESS_POOR_FORM_LOSSES, PRESS_GOOD_FORM_WINS, PRESS_BIG_MATCH_REP_GAP, PRESS_PROMOTION_RACE_TOP_N, PRESS_RELEGATION_BATTLE_BOTTOM_N, PRESS_INJURY_CRISIS_MIN, PRESS_DERBY_PREVIEW_CHANCE } from '@/config/gameBalance';

interface QuestionDef {
  question: string;
  options: Record<'confident' | 'humble' | 'deflect', { text: string; effects: PressOption['effects'] }>;
  proOption?: { tone: PressResponseTone; text: string; effects: PressOption['effects'] };
}

// Pool of press conference questions by context
export const QUESTIONS: Record<PressConference['context'], QuestionDef[]> = {
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
      proOption: { tone: 'analytical', text: 'The momentum data is undeniable but we keep the focus narrow. We track week-by-week metrics, not media narratives.', effects: { morale: 8, boardConfidence: 5, fanMood: 7 } },
    },
    {
      question: 'Your striker was clinical today. How important is his form to the team right now?',
      options: {
        confident: { text: 'He\'s the best in the division and he proved it again today.', effects: { morale: 7, boardConfidence: 4, fanMood: 9 } },
        humble: { text: 'He\'d be the first to say it\'s a team effort. We create the chances, he finishes them.', effects: { morale: 10, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'Individual performances matter less than the collective. The system works.', effects: { morale: 5, boardConfidence: 2, fanMood: 3 } },
      },
      proOption: { tone: 'analytical', text: 'His xG and conversion numbers are elite for this level. He\'s in the form of his life and we\'ve built our patterns around that strength.', effects: { morale: 9, boardConfidence: 5, fanMood: 8 } },
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
      proOption: { tone: 'analytical', text: 'Our underlying numbers have been climbing for weeks — the wins are starting to reflect that. Process before outcome, every time.', effects: { morale: 9, boardConfidence: 6, fanMood: 7 } },
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
    {
      question: 'The defence looked rock solid today. What\'s changed at the back?',
      options: {
        confident: { text: 'We\'ve built a fortress. Teams know they can\'t score against us easily.', effects: { morale: 7, boardConfidence: 5, fanMood: 7 } },
        humble: { text: 'The whole team defends as a unit. It starts from the front and everyone does their job.', effects: { morale: 10, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'One clean sheet doesn\'t make a season. We take each game as it comes.', effects: { morale: 4, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'strategic', text: 'We restructured the defensive line\'s pressing triggers in pre-season. The shape is more compact and the data shows opponents are getting fewer high-value chances.', effects: { morale: 8, boardConfidence: 6, fanMood: 6 } },
    },
    {
      question: 'Some fans are already talking about a title challenge. Is that realistic?',
      options: {
        confident: { text: 'Why not? Look at the squad we\'ve got. We fear nobody.', effects: { morale: 8, boardConfidence: 4, fanMood: 12 } },
        humble: { text: 'It\'s flattering but we\'re taking it one game at a time. A lot can change.', effects: { morale: 6, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'I don\'t listen to that noise. We focus on what we can control.', effects: { morale: 3, boardConfidence: 3, fanMood: -1 } },
      },
      proOption: { tone: 'analytical', text: 'The points-per-game projection is encouraging but it\'s a long season. We benchmark against title-winning sides week to week and adjust accordingly.', effects: { morale: 7, boardConfidence: 6, fanMood: 8 } },
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
      proOption: { tone: 'analytical', text: 'I\'ve already broken down the tape. The structural issue is fixable — small spacing tweaks in the press will change the outcome of these games.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } }
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
      proOption: { tone: 'analytical', text: 'The video is clear: we\'re losing one specific duel pattern. We\'ll drill it Monday and Tuesday — it\'s a fixable, identifiable issue.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
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
      proOption: { tone: 'strategic', text: 'In hindsight the data suggested a different change. We log every decision and learn from it — that\'s how the staff get better game by game.', effects: { morale: 5, boardConfidence: 4, fanMood: 3 } },
    },
    {
      question: 'The fans booed at full time. Do you understand their frustration?',
      options: {
        confident: { text: 'They\'re entitled to their opinion but they should trust the process. We\'ll turn this around.', effects: { morale: 3, boardConfidence: -1, fanMood: -3 } },
        humble: { text: 'Of course. They pay good money and deserve better. We owe them a response.', effects: { morale: -2, boardConfidence: 4, fanMood: 6 } },
        deflect: { text: 'I didn\'t hear anything. My focus was on the dressing room.', effects: { morale: 0, boardConfidence: 1, fanMood: -5 } },
      },
      proOption: { tone: 'analytical', text: 'Of course they\'re frustrated — so am I. But I\'ll show you the same data I show the players: we\'re trending the right way and the results will follow.', effects: { morale: 7, boardConfidence: 4, fanMood: 6 } },
    },
    {
      question: 'Are you concerned about the number of goals you\'re conceding?',
      options: {
        confident: { text: 'We\'re an attacking side. We\'ll outscore anyone on our day.', effects: { morale: 4, boardConfidence: -3, fanMood: 3 } },
        humble: { text: 'It\'s something we need to address urgently. We\'re working on it every day.', effects: { morale: -1, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'Football is a game of fine margins. We\'ll look at the data and adjust.', effects: { morale: 1, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'The xGA has dropped three weeks running — we\'re conceding bad-luck goals, not big chances. Stay the course and the numbers will normalise.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
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
      proOption: { tone: 'analytical', text: 'The xG was even, the underlying battle was even. A draw reflects the data — neither side did enough to deserve more.', effects: { morale: 6, boardConfidence: 4, fanMood: 4 } },
    },
    {
      question: 'You had a late equaliser ruled out. Do you feel hard done by?',
      options: {
        confident: { text: 'We were the better side and the officials let us down. Simple as that.', effects: { morale: 5, boardConfidence: -1, fanMood: 4 } },
        humble: { text: 'Decisions go for you and against you over a season. We need to put ourselves in positions where it doesn\'t matter.', effects: { morale: 6, boardConfidence: 3, fanMood: 2 } },
        deflect: { text: 'I haven\'t seen it back yet, so I won\'t comment on the decision.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'We don\'t spend energy on decisions we can\'t control. The staff will review the call internally and feed it into how we coach the patterns.', effects: { morale: 6, boardConfidence: 5, fanMood: 3 } },
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
      proOption: { tone: 'strategic', text: 'We\'re working on a new rotation against deep blocks — extra movement in the half-spaces. The pattern is coming, just needs more reps.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'Your goalkeeper kept you in it with some big saves. Is a draw a good result considering?',
      options: {
        confident: { text: 'That\'s why we have a top keeper. But we should have been better in front of him.', effects: { morale: 4, boardConfidence: 0, fanMood: 2 } },
        humble: { text: 'He was fantastic. Honestly, a point might be a fair reflection given how the game played out.', effects: { morale: 6, boardConfidence: 2, fanMood: 3 } },
        deflect: { text: 'Goalkeepers make saves, that\'s their job. We move on to the next one.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'His save percentage on high-value chances is among the best in the division. He\'s a system-defining asset and the metrics back that up.', effects: { morale: 8, boardConfidence: 5, fanMood: 6 } },
    },
    {
      question: 'You had chances to win it late on. Is a draw a missed opportunity?',
      options: {
        confident: { text: 'Absolutely. We should be finishing those chances. We were the better team.', effects: { morale: 5, boardConfidence: 1, fanMood: 5 } },
        humble: { text: 'We created chances which is positive, but we need to be more clinical.', effects: { morale: 7, boardConfidence: 3, fanMood: 3 } },
        deflect: { text: 'You could say the same about both sides. A draw was a fair result.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'We out-chanced them on big chances 4-1 in the last 20 minutes. Finishing variance evens out — keep generating that volume and the results will come.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'The second half was much better than the first. What changed at the break?',
      options: {
        confident: { text: 'I lit a fire under them. They knew what was expected and delivered.', effects: { morale: 6, boardConfidence: 3, fanMood: 6 } },
        humble: { text: 'We made some adjustments and the players responded brilliantly. Credit to them.', effects: { morale: 9, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'I\'d rather keep the tactical details between myself and the squad.', effects: { morale: 2, boardConfidence: 1, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'We adjusted to a back-three at the break and the data showed an immediate jump in territory and entries. The shape change won us the half outright.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'This is the third draw in a row now. Is that a pattern you\'re worried about?',
      options: {
        confident: { text: 'We\'re not losing, which tells you we\'re hard to beat. The wins will come.', effects: { morale: 5, boardConfidence: 2, fanMood: 3 } },
        humble: { text: 'It\'s frustrating. We\'re close to getting results but need to find that extra gear.', effects: { morale: 4, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'I don\'t look at patterns. Every match is different.', effects: { morale: 2, boardConfidence: 1, fanMood: -2 } },
      },
      proOption: { tone: 'analytical', text: 'The data shows we\'re winning the xG battle in all three draws. Regression to the mean will favour us — we just need to stay patient.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
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
      proOption: { tone: 'analytical', text: 'We\'ve modelled their last twelve matches and identified three repeatable triggers we can exploit. The squad has spent the week drilling those exact scenarios.', effects: { morale: 8, boardConfidence: 7, fanMood: 6 } },
    },
    {
      question: 'This is a local derby with a lot of history. What does this fixture mean to you and the club?',
      options: {
        confident: { text: 'Derbies are about pride and bragging rights. We intend to deliver both.', effects: { morale: 9, boardConfidence: 2, fanMood: 10 } },
        humble: { text: 'We know what it means to the supporters. We\'ll give everything for them.', effects: { morale: 7, boardConfidence: 3, fanMood: 7 } },
        deflect: { text: 'Emotions run high in these games, but we have to stay professional and focused.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'visionary', text: 'Derbies aren\'t won on emotion — they\'re won on the small details that emotion makes you forget. We\'ve prepared for the chaos so the players don\'t have to.', effects: { morale: 9, boardConfidence: 6, fanMood: 9 } },
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
      proOption: { tone: 'analytical', text: 'The fitness team has individualised load plans for every depth player. We know exactly who is fresh enough to start and who needs to come off the bench.', effects: { morale: 7, boardConfidence: 6, fanMood: 4 } },
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
    {
      question: 'Your record against the top sides this season has been mixed. What needs to change?',
      options: {
        confident: { text: 'We\'ve shown we can compete with anyone. The results will come if we keep performing.', effects: { morale: 6, boardConfidence: 2, fanMood: 5 } },
        humble: { text: 'We need to be braver in those big moments. Sometimes we\'ve been too cautious.', effects: { morale: 4, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'Records don\'t win you the next game. We prepare the same way regardless of the opponent.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve audited those games and identified the same recurring failure pattern. The plan this week is built specifically to break that pattern.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'The last meeting between these two sides was a fiery affair. Are you expecting the same intensity?',
      options: {
        confident: { text: 'We thrive in those battles. My players love the big occasion.', effects: { morale: 8, boardConfidence: 2, fanMood: 8 } },
        humble: { text: 'Both sides will be up for it. We just need to channel that energy the right way.', effects: { morale: 6, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'Every game has its own story. I\'m not interested in what happened last time.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve analysed their patterns extensively. They tend to start aggressively in these fixtures, so we\'ve prepared a game plan that absorbs that early pressure and exploits the spaces they leave.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
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
      proOption: { tone: 'strategic', text: 'Every senior player has a defined valuation and a defined role in the project. Outside interest doesn\'t change either of those things.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'Reports suggest a bid has been rejected for your captain. Is the club holding firm?',
      options: {
        confident: { text: 'He\'s the heart of this team. They\'d have to offer something extraordinary to even start a conversation.', effects: { morale: 8, boardConfidence: 1, fanMood: 8 } },
        humble: { text: 'We\'ve made our position clear. But ultimately these things are never entirely in your control.', effects: { morale: 0, boardConfidence: 4, fanMood: 1 } },
        deflect: { text: 'Transfer business is handled behind closed doors, not in press conferences.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'The valuation reflects his contribution to our system, not just his raw output. A bid that doesn\'t recognise that is a bid we don\'t entertain.', effects: { morale: 9, boardConfidence: 6, fanMood: 7 } },
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
      proOption: { tone: 'analytical', text: 'We model every potential swap on data fit and contract terms before it gets to my desk. If the numbers don\'t justify it, the conversation ends quickly.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
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
    {
      question: 'Your star player\'s contract is running down. Are you worried about losing him for nothing?',
      options: {
        confident: { text: 'He knows what we\'re building here. I\'m confident he\'ll stay.', effects: { morale: 5, boardConfidence: 3, fanMood: 6 } },
        humble: { text: 'These things are complicated. We\'ll respect whatever decision he makes.', effects: { morale: 3, boardConfidence: 4, fanMood: 2 } },
        deflect: { text: 'Contract situations are private. I won\'t be discussing it publicly.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'The negotiation is structured and ongoing. We\'ve got contingencies modelled either way — the project doesn\'t depend on one signature.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'Agents have been spotted at your last few matches. Is something brewing behind the scenes?',
      options: {
        confident: { text: 'Agents come to watch good teams. I take it as a compliment.', effects: { morale: 6, boardConfidence: 1, fanMood: 5 } },
        humble: { text: 'I\'m not aware of any approaches. My focus is purely on the football.', effects: { morale: 4, boardConfidence: 3, fanMood: 2 } },
        deflect: { text: 'I don\'t keep tabs on who\'s in the stands. That\'s not my department.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
      proOption: { tone: 'visionary', text: 'Agents come to matches because the project is attractive. That\'s a signal of where we\'re heading, not a problem to be managed.', effects: { morale: 7, boardConfidence: 5, fanMood: 5 } },
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
      proOption: { tone: 'analytical', text: 'I\'ve broken the slump down to one repeating defensive transition error. We\'ll drill it relentlessly this week — it\'s identifiable and fixable.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'Some fans are calling for your head on social media. How do you respond to that?',
      options: {
        confident: { text: 'Noise on the internet doesn\'t affect me. I know what I\'m doing and results will come.', effects: { morale: 5, boardConfidence: -3, fanMood: -2 } },
        humble: { text: 'The fans have every right to be frustrated. It\'s on me to deliver better results.', effects: { morale: -1, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'I don\'t do social media. I focus on what happens on the pitch.', effects: { morale: 1, boardConfidence: 0, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'I focus on what the data tells me, not the noise. The plan is the plan, the metrics are improving, and I trust the process.', effects: { morale: 6, boardConfidence: 6, fanMood: 3 } },
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
      proOption: { tone: 'analytical', text: 'The fitness data shows the senior core is carrying high cumulative load. A controlled rotation week, not a wholesale change, is what the numbers are asking for.', effects: { morale: 6, boardConfidence: 5, fanMood: 3 } },
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
    {
      question: 'There seems to be a disconnect between tactics and execution. Do you need to change your approach?',
      options: {
        confident: { text: 'The system works. The players know it works. We just need to execute better.', effects: { morale: 3, boardConfidence: -2, fanMood: 1 } },
        humble: { text: 'Maybe I need to simplify things. If the message isn\'t getting through, that\'s on me.', effects: { morale: 2, boardConfidence: 6, fanMood: 5 } },
        deflect: { text: 'I\'m not going to publicly dissect our tactical setup. We\'ll work on it behind closed doors.', effects: { morale: 0, boardConfidence: 1, fanMood: -2 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve simplified the in-possession patterns to give the players clearer reference points. Complexity is the enemy when confidence is low.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
    },
    {
      question: 'You\'ve scored just twice in the last five matches. Where are the goals going to come from?',
      options: {
        confident: { text: 'We\'re creating chances. Once one goes in, the floodgates will open.', effects: { morale: 5, boardConfidence: 0, fanMood: 3 } },
        humble: { text: 'It\'s a concern and we\'re working on finishing in training every single day.', effects: { morale: 1, boardConfidence: 4, fanMood: 3 } },
        deflect: { text: 'Goals are part of a bigger picture. The overall performance level is what matters.', effects: { morale: 1, boardConfidence: 1, fanMood: -2 } },
      },
      proOption: { tone: 'analytical', text: 'Our xG data tells me we should have scored six more goals in this run. The finishing will regress to the mean — the underlying numbers are actually encouraging.', effects: { morale: 5, boardConfidence: 5, fanMood: 4 } },
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
      proOption: { tone: 'analytical', text: 'The underlying metrics have been climbing for two months — the results have just caught up. This isn\'t variance, it\'s the system maturing.', effects: { morale: 8, boardConfidence: 6, fanMood: 6 } },
    },
    {
      question: 'You\'re in the promotion places. Is it too early to talk about going up?',
      options: {
        confident: { text: 'Promotion is the target and we\'re right on track. This squad can handle the pressure.', effects: { morale: 9, boardConfidence: 4, fanMood: 10 } },
        humble: { text: 'We\'re in a good position but there\'s a long way to go. We just keep taking it week by week.', effects: { morale: 7, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'I\'m not looking at the table yet. Ask me again in April.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'analytical', text: 'The points-per-game projection is exciting but I focus on the next match\'s expected difficulty, not the table. Process beats prediction every time.', effects: { morale: 6, boardConfidence: 5, fanMood: 4 } },
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
      proOption: { tone: 'visionary', text: 'I dream about it — but my job is to convert dreams into a process. The players know exactly what trophies cost in points, performance, and discipline.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
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
    {
      question: 'Your defensive record during this run has been outstanding. What\'s the secret?',
      options: {
        confident: { text: 'Organisation, discipline, and world-class defenders. Simple as that.', effects: { morale: 7, boardConfidence: 5, fanMood: 7 } },
        humble: { text: 'It\'s a team effort. Everyone from front to back is putting in the defensive work.', effects: { morale: 10, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'I don\'t like to focus on individual stats. The results speak for themselves.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'strategic', text: 'We restructured the rest-defence shape after the international break. Opponents are now getting their lowest-quality chances against us in over a year.', effects: { morale: 8, boardConfidence: 6, fanMood: 6 } },
    },
    {
      question: 'Players are queuing up to praise your man-management. What\'s your philosophy on handling a squad?',
      options: {
        confident: { text: 'I treat every player as an individual. Different buttons for different people.', effects: { morale: 9, boardConfidence: 5, fanMood: 6 } },
        humble: { text: 'I just try to create an environment where everyone feels valued. The players do the rest.', effects: { morale: 12, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'I\'d rather not reveal my methods. That\'s a competitive advantage I\'ll keep.', effects: { morale: 4, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'visionary', text: 'Modern management is about emotional intelligence. We use individual development plans, regular one-to-ones, and create a culture where players push each other rather than being pushed by me.', effects: { morale: 10, boardConfidence: 6, fanMood: 6 } },
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
      proOption: { tone: 'strategic', text: 'Automatic is the target. Playoffs are a financial and squad-cost we\'ve modelled and prefer to avoid — the data favours pushing for top two now.', effects: { morale: 8, boardConfidence: 7, fanMood: 7 } },
    },
    {
      question: 'Several of your players have attracted interest from clubs in the league above. Is that a distraction?',
      options: {
        confident: { text: 'If we go up, those players will be playing at that level anyway. There\'s no better project than this one.', effects: { morale: 9, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'It\'s flattering for the lads, but their heads are firmly here. We have unfinished business.', effects: { morale: 7, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'I don\'t engage with speculation about individual players during the business end of the season.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'Every key contract has been extended in advance for exactly this scenario. We\'re not negotiating from weakness when the lights are brightest.', effects: { morale: 9, boardConfidence: 7, fanMood: 6 } },
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
      proOption: { tone: 'visionary', text: 'A packed stadium is worth measurable points across a season. We\'ve quantified the home-advantage swing and we feed off it deliberately.', effects: { morale: 8, boardConfidence: 5, fanMood: 9 } },
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
    {
      question: 'Your rivals have been spending big in the window. Can you compete with that financial muscle?',
      options: {
        confident: { text: 'Money doesn\'t play football. We\'ve got something money can\'t buy — team spirit.', effects: { morale: 9, boardConfidence: 3, fanMood: 8 } },
        humble: { text: 'We have to be smart with our resources. We may not outspend them but we can outsmart them.', effects: { morale: 6, boardConfidence: 6, fanMood: 4 } },
        deflect: { text: 'I don\'t concern myself with what other clubs are doing. Our focus is internal.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'Our recruitment model targets value, not headlines. The squad cost-per-point is among the best in the league — that\'s how you compete without matching wage bills.', effects: { morale: 7, boardConfidence: 7, fanMood: 5 } },
    },
    {
      question: 'The fixture list looks brutal over the next month. How do you manage fatigue in a promotion run-in?',
      options: {
        confident: { text: 'We\'ve got the deepest squad in the division. Bring on the fixtures.', effects: { morale: 8, boardConfidence: 4, fanMood: 7 } },
        humble: { text: 'Rotation will be key. Everyone in the squad has a role to play.', effects: { morale: 7, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'We take it one game at a time. I don\'t look too far ahead.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'We\'ve modelled the fatigue data and identified which players need strategic rest weeks. The fitness team has individualised recovery plans for every squad member.', effects: { morale: 7, boardConfidence: 7, fanMood: 4 } },
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
      proOption: { tone: 'strategic', text: 'The board and I align on the survival plan and the metrics that signal it\'s working. We\'re reviewing those numbers together every week — there are no surprises.', effects: { morale: 6, boardConfidence: 7, fanMood: 4 } },
    },
    {
      question: 'Do you regret not strengthening the squad in the transfer window?',
      options: {
        confident: { text: 'Not at all. The players in this squad are good enough. They need to show it on the pitch.', effects: { morale: 6, boardConfidence: -2, fanMood: 1 } },
        humble: { text: 'Hindsight is easy. We tried to bring people in but the right deals weren\'t there. We work with what we have.', effects: { morale: 3, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Transfer windows are done. There\'s no point looking backwards. We focus on what\'s ahead.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
      proOption: { tone: 'analytical', text: 'We modelled the transfer market against squad needs and the ROI didn\'t justify a panic buy. We\'re committed to solving this with the players we have.', effects: { morale: 6, boardConfidence: 5, fanMood: 3 } },
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
      proOption: { tone: 'analytical', text: 'The points-needed model says it\'s tight but achievable. Every match has a clear target and the squad knows exactly what it takes from here.', effects: { morale: 7, boardConfidence: 6, fanMood: 4 } },
    },
    {
      question: 'You\'ve got a run of winnable fixtures coming up. Is this the moment to save your season?',
      options: {
        confident: { text: 'We\'re going to attack these games. This is where we turn it around.', effects: { morale: 7, boardConfidence: 3, fanMood: 7 } },
        humble: { text: 'There are no easy games at this level. We respect every opponent.', effects: { morale: 4, boardConfidence: 4, fanMood: 2 } },
        deflect: { text: 'Winnable? Every game is tough when you\'re down there. I don\'t subscribe to that thinking.', effects: { morale: 2, boardConfidence: 2, fanMood: -1 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve mapped each upcoming opponent\'s vulnerabilities and built the game plans accordingly. The fixture list is a weapon if you prepare correctly.', effects: { morale: 8, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'Some of your experienced players have been through relegation scraps before. Are they helping guide the younger lads?',
      options: {
        confident: { text: 'That experience is invaluable. They\'re leading by example every single day.', effects: { morale: 8, boardConfidence: 4, fanMood: 5 } },
        humble: { text: 'The senior group has been brilliant. They\'ve kept the dressing room calm and focused.', effects: { morale: 9, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'Everyone contributes in different ways. I don\'t single out individuals.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve deliberately paired experienced heads with the younger players in training groups. That mentoring structure means nobody feels isolated in the pressure.', effects: { morale: 8, boardConfidence: 6, fanMood: 4 } },
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
      proOption: { tone: 'analytical', text: 'Our model values him at this number based on age, role, and projected output. We\'re paying for what he\'ll deliver, not what the headline suggests.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'How quickly can we expect to see the new signing in the starting lineup?',
      options: {
        confident: { text: 'He\'s fit, he\'s hungry, and he could go straight into the side. Competition for places just got fierce.', effects: { morale: 6, boardConfidence: 4, fanMood: 8 } },
        humble: { text: 'We\'ll integrate him carefully. There\'s a settling-in period and we need to respect that.', effects: { morale: 4, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'Team selection is always based on training performance. He\'ll be treated no differently.', effects: { morale: 3, boardConfidence: 3, fanMood: 1 } },
      },
      proOption: { tone: 'strategic', text: 'We\'ve mapped his on-boarding into specific tactical phases. Bench rotation first, then targeted starts — the data tells us exactly when he\'s ready.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
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
      proOption: { tone: 'visionary', text: 'Healthy competition lifts the standard for everyone. The numbers prove it: squads with internal competition outperform — that\'s a feature of the project, not a threat.', effects: { morale: 8, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'The new signing reportedly chose you over several other clubs. What convinced him to come here?',
      options: {
        confident: { text: 'He could see the ambition and the project. This is the place to be right now.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'It was a team effort — the board, the staff, and the vision we presented. We sold the project well.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
        deflect: { text: 'You\'d have to ask him that. I\'m just glad he\'s here.', effects: { morale: 3, boardConfidence: 1, fanMood: 2 } },
      },
      proOption: { tone: 'visionary', text: 'He saw the data on our development pathway and the trajectory of the squad. Smart players choose projects with measurable upside — that\'s what we sold him.', effects: { morale: 9, boardConfidence: 7, fanMood: 7 } },
    },
    {
      question: 'How does this signing fit into your long-term vision for the club?',
      options: {
        confident: { text: 'He\'s a statement signing. It shows we mean business.', effects: { morale: 7, boardConfidence: 4, fanMood: 9 } },
        humble: { text: 'He fills a gap we identified. It\'s a sensible addition that makes us stronger.', effects: { morale: 5, boardConfidence: 6, fanMood: 3 } },
        deflect: { text: 'Long-term plans stay between me and the board. For now he\'s here to help us win games.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
      proOption: { tone: 'visionary', text: 'This signing represents the profile of player we want to build around — technically excellent, tactically intelligent, and hungry. He fits our three-year development model perfectly.', effects: { morale: 8, boardConfidence: 7, fanMood: 6 } },
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
      proOption: { tone: 'analytical', text: 'I\'ve audited the load and impact data with the medical team. The pattern points to bad luck, not methodology — but we\'ve still tightened recovery protocols.', effects: { morale: 6, boardConfidence: 6, fanMood: 4 } },
    },
    {
      question: 'Are you considering dipping into the loan market to cover the gaps?',
      options: {
        confident: { text: 'We don\'t need emergency signings. The young lads coming through are ready — this is their moment.', effects: { morale: 9, boardConfidence: 2, fanMood: 7 } },
        humble: { text: 'We\'re keeping all options open. If the right player is available to help in the short term, we\'d look at it.', effects: { morale: 4, boardConfidence: 5, fanMood: 3 } },
        deflect: { text: 'Transfer decisions are made privately. We\'ll do whatever\'s best for the club.', effects: { morale: 2, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'The loan market has been screened against our profile filters. We have two specific targets identified and ready to move on if the situation worsens.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
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
      proOption: { tone: 'analytical', text: 'We\'ve modelled every realistic squad availability scenario through the run-in. The points-per-game projection holds across all of them — the season is not derailed.', effects: { morale: 7, boardConfidence: 6, fanMood: 5 } },
    },
    {
      question: 'You\'ve been forced to play players out of position recently. How are they coping with that?',
      options: {
        confident: { text: 'They\'re top professionals. A good player can play anywhere and they\'ve proved that.', effects: { morale: 7, boardConfidence: 3, fanMood: 4 } },
        humble: { text: 'It\'s not ideal and I appreciate the sacrifice they\'re making. They\'re giving everything for the team.', effects: { morale: 9, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'Modern footballers need to be versatile. It\'s part of the game.', effects: { morale: 3, boardConfidence: 2, fanMood: 0 } },
      },
      proOption: { tone: 'strategic', text: 'We mapped every player\'s secondary positions in pre-season for exactly this scenario. The data shows minimal performance drop-off — versatility was built in by design.', effects: { morale: 7, boardConfidence: 6, fanMood: 4 } },
    },
    {
      question: 'Some of the younger players drafted in have actually looked impressive. Could this crisis be a blessing in disguise?',
      options: {
        confident: { text: 'Absolutely. They\'ve seized their chance and some of them won\'t be going back to the bench.', effects: { morale: 10, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'They\'ve been brilliant but the priority is getting everyone fit. Competition for places is healthy though.', effects: { morale: 8, boardConfidence: 4, fanMood: 5 } },
        deflect: { text: 'Every cloud has a silver lining. But I wouldn\'t wish injuries on anyone.', effects: { morale: 4, boardConfidence: 2, fanMood: 2 } },
      },
      proOption: { tone: 'analytical', text: 'The development data on two of these young players has exceeded projections. We were planning to integrate them next season anyway — this has accelerated a process that benefits the club long-term.', effects: { morale: 9, boardConfidence: 7, fanMood: 6 } },
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
      proOption: { tone: 'strategic', text: 'External noise is a variable we control by ignoring it. The squad\'s entire focus this week has been the data on their patterns — nothing else.', effects: { morale: 8, boardConfidence: 6, fanMood: 7 } },
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
      proOption: { tone: 'strategic', text: 'We\'ve coordinated with the staff and the club\'s safety team on every detail. On the pitch, we channel the emotion into structure — that\'s how derbies are won.', effects: { morale: 7, boardConfidence: 6, fanMood: 6 } },
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
    {
      question: 'Your captain has spoken about wanting to deliver a performance the fans will never forget. Is that the mentality across the squad?',
      options: {
        confident: { text: 'The dressing room is buzzing. Every single player wants to be the hero on derby day.', effects: { morale: 10, boardConfidence: 4, fanMood: 10 } },
        humble: { text: 'The captain speaks for all of us. The squad is united and desperate to put on a show.', effects: { morale: 9, boardConfidence: 4, fanMood: 7 } },
        deflect: { text: 'Actions speak louder than words. We\'ll let our football do the talking.', effects: { morale: 4, boardConfidence: 3, fanMood: 2 } },
      },
      proOption: { tone: 'visionary', text: 'A derby win lives in the data and the memory. We\'ve built the week\'s preparation around delivering both — the numbers say we\'re ready.', effects: { morale: 9, boardConfidence: 6, fanMood: 9 } },
    },
    {
      question: 'Ticket demand has been unprecedented for this one. Does a sellout crowd change the dynamic?',
      options: {
        confident: { text: 'A full house is exactly what we want. The atmosphere will be electric and we feed off that energy.', effects: { morale: 8, boardConfidence: 3, fanMood: 10 } },
        humble: { text: 'The fans deserve a big performance and we\'re going to give them one.', effects: { morale: 7, boardConfidence: 3, fanMood: 8 } },
        deflect: { text: 'Whether there\'s a thousand or fifty thousand, we prepare the same way.', effects: { morale: 3, boardConfidence: 2, fanMood: -2 } },
      },
      proOption: { tone: 'visionary', text: 'Derby days are what this club is about. These are the occasions that create lifelong memories. We owe it to every person in that stadium to leave everything on the pitch.', effects: { morale: 10, boardConfidence: 5, fanMood: 10 } },
    },
  ],
};

// ── Question recency memory ──
//
// A bare `pick(pool)` over 7–8 questions per context means back-to-back
// identical questions are likely (~1-in-7 every time, and the same context
// repeats after consecutive wins). This mirrors the `pickFreshLine` pattern
// already used for match commentary: remember the last few questions asked per
// context and exclude them from the draw.
//
// Deliberately module-level rather than store state: `generatePressConference`
// is called from 11 sites inside `matchActions.ts`, none of which thread extra
// arguments, and adding a persisted field would mean a save-schema bump for a
// cosmetic variety fix. The buffer therefore survives navigation and the whole
// app session but not a cold launch — which is exactly the window where
// repetition is noticeable. See the handoff note for the persisted version.

/** How many recently-asked questions to exclude per context. Kept below the
 *  smallest pool size so the exclusion set can never swallow a whole pool. */
export const PRESS_RECENT_MEMORY = 4;

const recentQuestions = new Map<PressConference['context'], string[]>();

/** Test/So-a-new-save-starts-fresh hook. */
export function resetPressConferenceMemory(): void {
  recentQuestions.clear();
}

/** Pick a question from `pool`, preferring ones not asked recently in this
 *  context, then record the choice in that context's ring buffer. */
function pickFreshQuestion(context: PressConference['context'], pool: QuestionDef[]): QuestionDef {
  const recent = recentQuestions.get(context) ?? [];
  const fresh = pool.filter(q => !recent.includes(q.question));
  const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
  // Cap at PRESS_RECENT_MEMORY, and never at or above the pool size — a pool
  // of 4 with a memory of 4 would exclude everything and defeat the point.
  const limit = Math.min(PRESS_RECENT_MEMORY, Math.max(0, pool.length - 1));
  recentQuestions.set(context, [...recent.filter(q => q !== chosen.question), chosen.question].slice(-limit));
  return chosen;
}

/** Pick a press conference appropriate to the context */
export function generatePressConference(context: PressConference['context'], proUser = false): PressConference {
  const pool = QUESTIONS[context];
  const chosen = pickFreshQuestion(context, pool);
  const baseOptions: [PressOption, PressOption, PressOption] = [
    { tone: 'confident', text: chosen.options.confident.text, effects: chosen.options.confident.effects },
    { tone: 'humble', text: chosen.options.humble.text, effects: chosen.options.humble.effects },
    { tone: 'deflect', text: chosen.options.deflect.text, effects: chosen.options.deflect.effects },
  ];

  if (proUser && chosen.proOption) {
    return {
      id: safeRandomUUID(),
      context,
      question: chosen.question,
      options: [...baseOptions, { tone: chosen.proOption.tone, text: chosen.proOption.text, effects: chosen.proOption.effects }],
      hasProOption: true,
    };
  }

  return {
    id: safeRandomUUID(),
    context,
    question: chosen.question,
    options: baseOptions,
    hasProOption: Boolean(chosen.proOption),
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
