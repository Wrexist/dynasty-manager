/**
 * Per-advance popup cap.
 *
 * The presentation queue already showed one overlay at a time, but never
 * capped how many one advance could chain: after a match the player could be
 * walked through press conference → celebration → achievement → digest →
 * storyline → pack offer before touching the game again. The cap spends
 * `BLOCKING_POPUPS_PER_ADVANCE` per advance, decisions first; informational
 * popups past it become inbox messages, offers wait for the next advance.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  planPresentation, OVERLAY_OVERFLOW, PRESENTATION_ORDER, type OverlayId, type PresentationLedger,
} from '@/utils/presentationQueue';
import {
  PresentationQueueProvider, usePresentationSlot, usePresentationOverflow, resetPresentationLedger,
} from '@/hooks/usePresentationQueue';
import { BLOCKING_POPUPS_PER_ADVANCE } from '@/config/gameBalance';
import { useGameStore } from '@/store/gameStore';
import { digestNote, farewellNotes, gemNote, midSeasonNote } from '@/utils/overlayInbox';

const CAP = BLOCKING_POPUPS_PER_ADVANCE;
const empty = (): PresentationLedger => ({ shown: new Set(), suppressed: new Set() });
const canFileAll = () => true;

describe('planPresentation — the cap', () => {
  it('caps blocking popups at two per advance', () => {
    expect(CAP).toBe(2);
  });

  it('lets the first two informational popups through', () => {
    const ledger = { shown: new Set<string>(), suppressed: new Set<string>() };
    const registered = ['weeklyDigest', 'celebration', 'achievement'];
    let plan = planPresentation(registered, ledger, CAP, canFileAll);
    expect(plan).toEqual({ active: 'weeklyDigest', overflow: [] });
    ledger.shown.add('weeklyDigest');
    plan = planPresentation(['celebration', 'achievement'], ledger, CAP, canFileAll);
    expect(plan).toEqual({ active: 'celebration', overflow: [] });
  });

  it('files the third informational popup instead of showing it', () => {
    const ledger = { shown: new Set(['weeklyDigest', 'celebration']), suppressed: new Set<string>() };
    const plan = planPresentation(['achievement', 'farewell'], ledger, CAP, canFileAll);
    expect(plan.active).toBeNull();
    expect(plan.overflow).toEqual(['achievement', 'farewell']);
  });

  it('spends the budget on decisions first', () => {
    // The post-match chain from the audit: a press conference and a storyline
    // take the two slots; the digest and the celebration go to the inbox.
    const ledger = { shown: new Set<string>(), suppressed: new Set<string>() };
    const registered = ['celebration', 'weeklyDigest', 'storyline', 'pressConference', 'achievement', 'packOffer'];
    let plan = planPresentation(registered, ledger, CAP, canFileAll);
    expect(plan.active).toBe('pressConference');
    ledger.shown.add('pressConference');
    plan = planPresentation(registered.filter(id => id !== 'pressConference'), ledger, CAP, canFileAll);
    expect(plan.active).toBe('storyline');
    ledger.shown.add('storyline');
    plan = planPresentation(['celebration', 'weeklyDigest', 'achievement', 'packOffer'], ledger, CAP, canFileAll);
    expect(plan.active).toBeNull();
    expect(plan.overflow).toEqual(['weeklyDigest', 'celebration', 'achievement', 'packOffer']);
  });

  it('never squeezes out a decision, even past the cap', () => {
    const ledger = { shown: new Set(['weeklyDigest', 'celebration']), suppressed: new Set<string>() };
    for (const id of ['nationalTeamOffer', 'pressConference', 'storyline', 'transferTalk']) {
      expect(planPresentation([id], ledger, CAP, canFileAll).active).toBe(id);
    }
  });

  it('never files a trophy lift or the daily streak reward', () => {
    const ledger = { shown: new Set(['weeklyDigest', 'celebration']), suppressed: new Set<string>() };
    expect(planPresentation(['trophyLift'], ledger, CAP, canFileAll).active).toBe('trophyLift');
    expect(planPresentation(['dailyReward'], ledger, CAP, canFileAll).active).toBe('dailyReward');
  });

  it('shows an informational popup nobody can file rather than losing it', () => {
    const ledger = { shown: new Set(['weeklyDigest', 'celebration']), suppressed: new Set<string>() };
    const plan = planPresentation(['farewell'], ledger, CAP, () => false);
    expect(plan).toEqual({ active: 'farewell', overflow: [] });
  });

  it('keeps an already-shown popup on screen', () => {
    const ledger = { shown: new Set(['weeklyDigest', 'celebration']), suppressed: new Set<string>() };
    expect(planPresentation(['celebration'], ledger, CAP, canFileAll).active).toBe('celebration');
  });

  it('skips suppressed popups for the rest of the advance', () => {
    const ledger = { shown: new Set<string>(), suppressed: new Set(['packOffer']) };
    expect(planPresentation(['packOffer'], ledger, CAP, canFileAll)).toEqual({ active: null, overflow: [] });
  });

  it('has a policy for every overlay it orders', () => {
    for (const id of PRESENTATION_ORDER) expect(OVERLAY_OVERFLOW[id]).toBeDefined();
    // Every decision sits ahead of every non-decision, or the cap could
    // spend the budget before reaching one.
    const decisions: OverlayId[] = ['nationalTeamOffer', 'pressConference', 'storyline', 'transferTalk'];
    const lastDecision = Math.max(...decisions.map(id => PRESENTATION_ORDER.indexOf(id)));
    const firstOther = PRESENTATION_ORDER.findIndex(id => !decisions.includes(id));
    expect(lastDecision).toBeLessThan(firstOther);
    for (const id of decisions) expect(OVERLAY_OVERFLOW[id]).toBe('never');
  });

  it('is empty-safe', () => {
    expect(planPresentation([], empty(), CAP, canFileAll)).toEqual({ active: null, overflow: [] });
  });
});

// ── The coordinator ──

interface Filed { id: OverlayId }
const filed: Filed[] = [];

/** A fake overlay: wants the screen until dismissed or filed. */
function Fake({ id, fileable = true }: { id: OverlayId; fileable?: boolean }) {
  const [wants, setWants] = useState(true);
  const active = usePresentationSlot(id, wants);
  usePresentationOverflow(id, () => {
    if (!fileable) return;
    filed.push({ id });
    setWants(false);
  });
  if (!wants || !active) return null;
  return <button type="button" onClick={() => setWants(false)}>{id}</button>;
}

function dismissVisible(id: string) {
  act(() => { screen.getByText(id).click(); });
}

describe('PresentationQueueProvider — per-advance cap', () => {
  beforeEach(() => {
    resetPresentationLedger();
    filed.length = 0;
    useGameStore.setState({ season: 1, week: 10 });
  });

  it('shows two popups for one advance and files the rest to the inbox', () => {
    render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
        <Fake id="achievement" />
        <Fake id="farewell" />
      </PresentationQueueProvider>,
    );
    expect(screen.getByText('weeklyDigest')).toBeTruthy();
    dismissVisible('weeklyDigest');
    expect(screen.getByText('celebration')).toBeTruthy();
    dismissVisible('celebration');
    // Budget spent: the other two never appear, and both were filed.
    expect(screen.queryByText('achievement')).toBeNull();
    expect(screen.queryByText('farewell')).toBeNull();
    expect(filed.map(f => f.id).sort()).toEqual(['achievement', 'farewell']);
  });

  it('files each overflowed popup exactly once', () => {
    render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
        <Fake id="achievement" />
      </PresentationQueueProvider>,
    );
    dismissVisible('weeklyDigest');
    dismissVisible('celebration');
    expect(filed.filter(f => f.id === 'achievement')).toHaveLength(1);
  });

  it('still shows a decision after the budget is spent', () => {
    render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
      </PresentationQueueProvider>,
    );
    dismissVisible('weeklyDigest');
    dismissVisible('celebration');
    render(<PresentationQueueProvider><Fake id="pressConference" /></PresentationQueueProvider>);
    expect(screen.getByText('pressConference')).toBeTruthy();
  });

  it('keeps the budget across a provider remount within the same advance', () => {
    // GameShell remounts the provider on every navigation; a budget held in
    // React state would reset each time the player tapped away and back.
    const first = render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
      </PresentationQueueProvider>,
    );
    dismissVisible('weeklyDigest');
    dismissVisible('celebration');
    first.unmount();
    render(<PresentationQueueProvider><Fake id="gemReveal" /></PresentationQueueProvider>);
    expect(screen.queryByText('gemReveal')).toBeNull();
    expect(filed.map(f => f.id)).toEqual(['gemReveal']);
  });

  it('gives the next advance a fresh budget', () => {
    const first = render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
      </PresentationQueueProvider>,
    );
    dismissVisible('weeklyDigest');
    dismissVisible('celebration');
    first.unmount();
    act(() => { useGameStore.setState({ week: 11 }); });
    render(<PresentationQueueProvider><Fake id="gemReveal" /></PresentationQueueProvider>);
    expect(screen.getByText('gemReveal')).toBeTruthy();
    expect(filed).toHaveLength(0);
  });

  it('defers an offer past the cap instead of filing it', () => {
    const first = render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
      </PresentationQueueProvider>,
    );
    dismissVisible('weeklyDigest');
    dismissVisible('celebration');
    first.unmount();
    render(<PresentationQueueProvider><Fake id="packOffer" /></PresentationQueueProvider>);
    expect(screen.queryByText('packOffer')).toBeNull();
    // An offer in the inbox would be spam: nothing is filed.
    expect(filed).toHaveLength(0);
  });

  it('shows an informational popup whose owner registered no converter', () => {
    function Unconverted({ id }: { id: OverlayId }) {
      const active = usePresentationSlot(id, true);
      return active ? <span>{id}</span> : null;
    }
    const first = render(
      <PresentationQueueProvider>
        <Fake id="weeklyDigest" />
        <Fake id="celebration" />
      </PresentationQueueProvider>,
    );
    dismissVisible('weeklyDigest');
    dismissVisible('celebration');
    first.unmount();
    render(<PresentationQueueProvider><Unconverted id="farewell" /></PresentationQueueProvider>);
    expect(screen.getByText('farewell')).toBeTruthy();
  });
});

// ── Filing ──

describe('fileOverflowToInbox', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('celtic');
  });

  it('posts the notes to the inbox, unread, stamped with the current week', () => {
    const before = useGameStore.getState().messages.length;
    const { week, season } = useGameStore.getState();
    useGameStore.getState().fileOverflowToInbox('celebration', [{ type: 'general', title: 'Top of the Table!', body: 'You lead the league.' }]);
    const { messages } = useGameStore.getState();
    expect(messages.length).toBe(before + 1);
    expect(messages[0]).toMatchObject({ title: 'Top of the Table!', read: false, week, season });
  });

  it('clears the store-backed popup it filed, so it stops asking for the screen', () => {
    useGameStore.setState({
      weeklyDigest: {
        incomeEarned: 100, expensesPaid: 50, injuriesThisWeek: ['Kane'], recoveriesThisWeek: [], offersReceived: 1,
        moraleChange: 0, playerDevelopment: [], trainingGains: [], scoutReportsCompleted: 0, contractWarnings: [],
        objectiveProgress: [],
      },
      pendingGemReveal: { playerId: 'x', region: 'Asia' },
      pendingFarewell: [{ playerId: 'p', playerName: 'Old Timer', seasonsServed: 9, stats: [] }],
    });
    const s = useGameStore.getState();
    s.fileOverflowToInbox('weeklyDigest', [digestNote(s.weeklyDigest!, s.week)]);
    s.fileOverflowToInbox('gemReveal', [gemNote(s.pendingGemReveal!, undefined)]);
    s.fileOverflowToInbox('farewell', farewellNotes(s.pendingFarewell));
    const after = useGameStore.getState();
    expect(after.weeklyDigest).toBeNull();
    expect(after.pendingGemReveal).toBeNull();
    expect(after.pendingFarewell).toEqual([]);
    expect(after.messages.slice(0, 3).map(m => m.title)).toEqual([
      'Farewell, Old Timer', 'Hidden gem: A hidden gem', `Week ${s.week} summary`,
    ]);
  });
});

describe('overflow notes carry what the popup would have shown', () => {
  it('digest lists injuries, offers and completed objectives', () => {
    const note = digestNote({
      incomeEarned: 2_000_000, expensesPaid: 500_000, injuriesThisWeek: ['Kane', 'Saka'], recoveriesThisWeek: [],
      offersReceived: 2, moraleChange: -5, playerDevelopment: [], trainingGains: [], scoutReportsCompleted: 1,
      contractWarnings: ['Rice'], objectiveProgress: [{ title: 'Fire Power', completed: true, xpEarned: 10 }],
    }, 12);
    expect(note.title).toBe('Week 12 summary');
    expect(note.body).toMatch(/Kane, Saka/);
    expect(note.body).toMatch(/2 transfer offers/);
    expect(note.body).toMatch(/Rice/);
    expect(note.body).toMatch(/Fire Power/);
    expect(note.body).toMatch(/morale down 5/);
  });

  it('mid-season report names position, points and confidence', () => {
    expect(midSeasonNote({ position: 3, points: 41, boardConfidence: 67.4 }).body)
      .toBe('Halfway point: 3rd with 41 points. Board confidence stands at 67%.');
  });
});
