/**
 * The four Sunday tactics, drawn instead of described.
 *
 * WHAT WAS WRONG. Each tactic carried a two-sentence `description` and the
 * teamsheet printed the selected one under the four buttons — 150 characters of
 * prose explaining a shape, on a phone, above the list you actually came to
 * use. Prose is the wrong medium for "everybody behind the ball": a picture of
 * two banks of four says it in one glance and in every language.
 *
 * WHAT THESE ARE. Four inline SVGs on a 48x34 half-pitch, one per tactic id,
 * showing the IDEA rather than the formation — the formation is already on the
 * card as `4-4-2`. Route One is a ball launched at a target man; Park the Bus
 * is a wall in front of the keeper; Chaos Ball is everybody running the same
 * way; Proper Football is three men and the triangle between them.
 *
 * NO ANIMATION, NO BLUR, NO STATE. Four of these render at once inside tap
 * targets on a scrolling page. They are pure geometry with `currentColor` for
 * the active tint, which is what lets one component be both the selected card's
 * gold diagram and the other three's muted one without a colour prop.
 *
 * `aria-hidden` throughout: the card beside it already carries the tactic's
 * name and tagline, so announcing the drawing would repeat what was just read.
 *
 * THE ARROWHEAD IS `useId`-SCOPED, and it has to be. A `<marker>` resolves
 * `currentColor` against ITS OWN document position, not against the element
 * that references it — so four SVGs sharing one hard-coded marker id would all
 * draw the first-mounted card's arrowheads, in the first-mounted card's colour.
 * Same rule, same reason, as `SundayFace`'s rule 3.
 */
import { memo, useId } from 'react';
import { cn } from '@/lib/utils';
import type { SundayTacticId } from '@/types/game';

/** The frame every diagram is drawn in. Wider than tall, like the top third of
 *  a pitch seen from behind the goal you are attacking. */
const W = 48;
const H = 34;

/** A player. Small enough that eleven would fit, so four reads as "some of the
 *  team" rather than "the whole side". */
function Man({ x, y, filled = true }: { x: number; y: number; filled?: boolean }) {
  return (
    <circle
      cx={x} cy={y} r={2.1}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 0.8}
    />
  );
}

/** A run, a pass or a punt. `dashed` for a ball in the air. */
function Arrow({ d, dashed, marker }: { d: string; dashed?: boolean; marker: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeDasharray={dashed ? '2 1.6' : undefined}
      markerEnd={`url(#${marker})`}
    />
  );
}

const SHAPES: Record<SundayTacticId, (marker: string) => React.ReactNode> = {
  // GK on his line, a punt over everyone, a big lad waiting, two men chasing.
  'route-one': marker => (
    <>
      <Man x={24} y={30} />
      <Arrow d="M 24 27.5 Q 24 8 24 6.4" dashed marker={marker} />
      <Man x={24} y={5} />
      <Man x={13} y={13} filled={false} />
      <Man x={35} y={13} filled={false} />
      <Arrow d="M 14.5 11.5 L 21 7.4" marker={marker} />
      <Arrow d="M 33.5 11.5 L 27 7.4" marker={marker} />
    </>
  ),
  // Everybody home. Two banks in front of the keeper, one man marooned.
  // No arrows: the whole point is that nobody goes anywhere.
  'park-the-bus': () => (
    <>
      <Man x={24} y={4.5} filled={false} />
      <Man x={7} y={17} /><Man x={18} y={17} /><Man x={30} y={17} /><Man x={41} y={17} />
      <Man x={7} y={25} /><Man x={18} y={25} /><Man x={30} y={25} /><Man x={41} y={25} />
      <path
        d="M 3 13.5 L 45 13.5"
        stroke="currentColor" strokeWidth={0.9} strokeDasharray="2 2" opacity={0.55}
      />
      <Man x={24} y={31} />
    </>
  ),
  // No shape. Everybody, including the ones who should not, running at the goal.
  'chaos-ball': marker => (
    <>
      <Man x={8} y={26} /><Man x={19} y={29} /><Man x={30} y={26} /><Man x={41} y={29} />
      <Arrow d="M 8 23.5 L 8 8" marker={marker} />
      <Arrow d="M 19 26.5 L 21.5 9" marker={marker} />
      <Arrow d="M 30 23.5 L 28 8" marker={marker} />
      <Arrow d="M 41 26.5 L 40 9" marker={marker} />
      <Man x={24} y={4} filled={false} />
    </>
  ),
  // Three men and the triangle between them. The ball goes round, not over.
  'proper-football': marker => (
    <>
      <Man x={10} y={27} />
      <Man x={38} y={27} />
      <Man x={24} y={9} />
      <Arrow d="M 12.4 26.2 L 35.4 26.2" marker={marker} />
      <Arrow d="M 37.2 24.8 L 25.6 11.2" marker={marker} />
      <Arrow d="M 22.2 11.4 L 11.2 24.6" marker={marker} />
    </>
  ),
};

/**
 * @param tactic  which of the four to draw
 * @param className  the tint. `currentColor` is the ink, so the caller's
 *                   `text-primary` / `text-muted-foreground` selects it.
 */
export const SundayTacticDiagram = memo(function SundayTacticDiagram({
  tactic, className,
}: {
  tactic: SundayTacticId;
  className?: string;
}) {
  const marker = `sunday-tactic-arrow-${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('w-full h-auto', className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 6 6" refX="4.6" refY="3"
          markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse"
        >
          <path d="M 0.6 0.8 L 5 3 L 0.6 5.2 z" fill="currentColor" />
        </marker>
      </defs>
      {/* The goal you are attacking, at the top — so "forward" is up in all
          four drawings and the four can be compared at a glance. */}
      <rect
        x={17} y={0.6} width={14} height={2.4}
        fill="none" stroke="currentColor" strokeWidth={0.7} opacity={0.4}
      />
      <g opacity={0.95}>{SHAPES[tactic](marker)}</g>
    </svg>
  );
});
