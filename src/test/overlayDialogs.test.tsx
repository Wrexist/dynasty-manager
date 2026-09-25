/**
 * Hand-rolled overlays behave as modal dialogs.
 *
 * Six motion/div overlays predated the dialog hooks: some had no role at all
 * (TransferApproach, FreeAgentSigningModal), none trapped focus (Tab walked
 * the dimmed page behind them and closing dropped focus on <body>), most
 * ignored Escape, and several had sub-44px buttons (36px `h-9`, a ~28px close
 * X, 24-40px CTAs). Each now declares role="dialog" + aria-modal with a
 * visible, id-referenced title, traps focus with `useFocusTrap` (which
 * restores it on close), closes on Escape where closing is harmless, and
 * keeps its buttons at 44px.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';

const notif = vi.hoisted(() => ({ pending: true, resolve: vi.fn() }));
vi.mock('@/utils/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/notifications')>();
  return {
    ...actual,
    isFirstWinPromptPending: () => notif.pending,
    subscribeFirstWinPrompt: () => () => {},
    resolveFirstWinPrompt: notif.resolve,
    requestNotificationPermission: vi.fn(async () => false),
  };
});
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
});

import { useGameStore } from '@/store/gameStore';
import { TransferApproach } from '@/components/game/TransferApproach';
import { ListForSaleModal } from '@/components/game/ListForSaleModal';
import { OptimizeResultModal } from '@/components/game/OptimizeResultModal';
import { TrophyCeremonyModal } from '@/components/game/TrophyCeremonyModal';
import { NotifPermissionModal } from '@/components/game/NotifPermissionModal';
import { FreeAgentSigningModal } from '@/components/transfer/FreeAgentSigningModal';

const CLUB_ID = 'manchester-city';

/** useFocusTrap moves focus on the next animation frame. */
function flushRaf() {
  return act(async () => {
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    await new Promise<void>(r => requestAnimationFrame(() => r()));
  });
}

/**
 * Mount `ui` while a button outside it holds focus, and check the modal
 * contract: a named, aria-modal dialog that takes focus on open and hands it
 * back to the opener when it goes away.
 */
async function expectModalDialog(ui: ReactElement, name: string | RegExp) {
  const opener = document.createElement('button');
  opener.textContent = 'opener';
  document.body.appendChild(opener);
  opener.focus();

  const view = render(ui);
  const dialog = screen.getByRole('dialog', { name });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  await flushRaf();
  expect(dialog.contains(document.activeElement), 'focus did not move into the dialog').toBe(true);

  view.unmount();
  expect(document.activeElement, 'focus was not restored to the opener').toBe(opener);
  opener.remove();
}

function pressEscape() {
  fireEvent.keyDown(document, { key: 'Escape' });
}

beforeEach(() => {
  notif.pending = true;
  notif.resolve.mockReset();
  useGameStore.getState().initGame(CLUB_ID);
  useGameStore.setState(s => ({ settings: { ...s.settings, soundEnabled: false } }));
});
afterEach(cleanup);

function rivalPlayerId(): string {
  const s = useGameStore.getState();
  const listed = new Set(s.transferMarket.map(l => l.playerId));
  const rival = Object.values(s.clubs).find(c => c.id !== CLUB_ID && c.playerIds.some(id => !listed.has(id)))!;
  return rival.playerIds.find(id => !listed.has(id))!;
}

function ownPlayer() {
  const s = useGameStore.getState();
  return s.players[s.clubs[CLUB_ID].playerIds[0]];
}

describe('TransferApproach', () => {
  it('is a focus-trapping modal dialog named by its title', async () => {
    await expectModalDialog(<TransferApproach playerId={rivalPlayerId()} onClose={() => {}} />, 'Approach Player');
  });

  it('closes on Escape and has a 44px close button', () => {
    const onClose = vi.fn();
    render(<TransferApproach playerId={rivalPlayerId()} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('min-w-11', 'min-h-11');
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ListForSaleModal', () => {
  it('traps focus and restores it on close', async () => {
    await expectModalDialog(
      <ListForSaleModal player={ownPlayer()} onClose={() => {}} onListed={() => {}} />,
      'List for Sale',
    );
  });
});

describe('OptimizeResultModal', () => {
  const result = { changes: 2, ovrDiff: 1, chemistryLabel: 'Good', chemistryBonus: 0.05 };

  it('is a focus-trapping modal dialog named by its heading', async () => {
    await expectModalDialog(<OptimizeResultModal result={result} onDismiss={() => {}} />, 'Lineup Optimised');
  });

  it('dismisses on Escape; Done is 44px', () => {
    const onDismiss = vi.fn();
    render(<OptimizeResultModal result={result} onDismiss={onDismiss} />);
    expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('h-11');
    pressEscape();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while closed', () => {
    const onDismiss = vi.fn();
    render(<OptimizeResultModal result={null} onDismiss={onDismiss} />);
    pressEscape();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('TrophyCeremonyModal', () => {
  it('is a focus-trapping modal dialog named by its title', async () => {
    await expectModalDialog(
      <TrophyCeremonyModal open onClose={() => {}} title="Champions!" subtitle="League title secured" confetti={false} />,
      'Champions!',
    );
  });

  it('closes on Escape; Continue is 44px', () => {
    const onClose = vi.fn();
    render(<TrophyCeremonyModal open onClose={onClose} title="Relegated" subtitle="Down we go" tone="somber" />);
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Down we go');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('h-11');
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('NotifPermissionModal', () => {
  it('is a focus-trapping modal dialog named by its heading', async () => {
    await expectModalDialog(<NotifPermissionModal />, 'Never miss a moment');
  });

  it('Escape is "Not now"; both actions are 44px', () => {
    render(<NotifPermissionModal />);
    expect(screen.getByRole('button', { name: 'Enable reminders' })).toHaveClass('h-11');
    for (const b of screen.getAllByRole('button', { name: 'Not now' })) {
      expect(b.className).toMatch(/(?:^|\s)(?:h-11|min-h-\[44px\])(?:\s|$)/);
    }
    pressEscape();
    expect(notif.resolve).toHaveBeenCalledTimes(1);
  });
});

describe('FreeAgentSigningModal', () => {
  function ui(overrides: Partial<Parameters<typeof FreeAgentSigningModal>[0]> = {}) {
    const s = useGameStore.getState();
    const p = ownPlayer();
    return (
      <FreeAgentSigningModal
        player={p}
        club={s.clubs[CLUB_ID]}
        offerWage={p.wage}
        offerYears={2}
        totalWeeks={46}
        onSetOfferWage={() => {}}
        onSetOfferYears={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        {...overrides}
      />
    );
  }

  it('is a focus-trapping modal dialog named by its title', async () => {
    const p = ownPlayer();
    await expectModalDialog(ui(), `Sign ${p.firstName} ${p.lastName}`);
  });

  it('Escape and a backdrop tap cancel; a tap inside the panel does not', () => {
    const onCancel = vi.fn();
    const { container } = render(ui({ onCancel }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    pressEscape();
    expect(onCancel).toHaveBeenCalledTimes(1);
    const backdrop = container.querySelector('.bg-black\\/60') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('has 44px buttons, a pressed state on the length picker and a labelled wage slider', () => {
    render(ui());
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('h-11');
    const two = screen.getByRole('button', { name: '2 years' });
    expect(two).toHaveClass('min-h-11');
    expect(two).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1 year' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Weekly Wage')).toHaveAttribute('type', 'range');
  });
});
