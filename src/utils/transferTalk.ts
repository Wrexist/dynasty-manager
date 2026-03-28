import type { TransferTalk, TransferTalkOption } from '@/types/game';
import {
  TRANSFER_TALK_CONVINCE_BASE_CHANCE,
  TRANSFER_TALK_CONVINCE_LOYALTY_BONUS,
  TRANSFER_TALK_REFUSE_MORALE_PENALTY,
  TRANSFER_TALK_REFUSE_TEAM_MORALE_HIT,
  TRANSFER_TALK_EMPATHIZE_MORALE_BOOST,
  TRANSFER_TALK_PROMISE_MORALE_BOOST,
} from '@/config/gameBalance';

export function buildTransferTalk(
  player: { id: string; firstName: string; lastName: string; personality?: { loyalty: number; ambition: number } },
  reason: 'low_morale' | 'ambition',
): TransferTalk {
  const loyalty = player.personality?.loyalty ?? 10;
  const convinceChance = Math.min(0.85, TRANSFER_TALK_CONVINCE_BASE_CHANCE + (loyalty / 20) * TRANSFER_TALK_CONVINCE_LOYALTY_BONUS);
  const convincePct = Math.round(convinceChance * 100);

  const body = reason === 'low_morale'
    ? `${player.firstName} ${player.lastName} walks into your office looking frustrated. "Boss, I've not been happy here for a while now. I need a change of scenery — I want to move on."`
    : `${player.firstName} ${player.lastName} knocks on your door. "Gaffer, I feel like I've achieved everything I can here. I think it's time for a new challenge — I'd like you to let me go."`;

  const options: TransferTalkOption[] = [
    {
      label: 'I understand how you feel',
      text: 'Listen to their concerns and acknowledge their wish to leave. You\'ll list them for sale.',
      tone: 'empathize',
      effects: { morale: TRANSFER_TALK_EMPATHIZE_MORALE_BOOST, listForSale: true },
    },
    {
      label: 'You\'re central to my plans',
      text: `Try to convince the player to stay and fight for their place. (${convincePct}% chance)`,
      tone: 'convince',
      effects: { withdrawChance: convinceChance },
    },
    {
      label: 'I\'ll find you the right move',
      text: 'Promise to actively find a suitable destination. The player appreciates your honesty.',
      tone: 'promise',
      effects: { morale: TRANSFER_TALK_PROMISE_MORALE_BOOST, listForSale: true },
    },
    {
      label: 'You\'re going nowhere',
      text: 'Refuse the request outright. The player will be unhappy and it may affect the squad.',
      tone: 'refuse',
      effects: { morale: -TRANSFER_TALK_REFUSE_MORALE_PENALTY, teamMorale: -TRANSFER_TALK_REFUSE_TEAM_MORALE_HIT },
    },
  ];

  return { playerId: player.id, playerName: `${player.firstName} ${player.lastName}`, reason, body, options };
}
