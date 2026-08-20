import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The project's custom `fontSize` scale from `tailwind.config.ts`.
 *
 * `tailwind-merge` ships with knowledge of Tailwind's DEFAULT scale only
 * (`text-xs`…`text-9xl`). A `text-*` class it does not recognise as a size is
 * filed under the `text-color` group instead — so `twMerge('text-h3
 * text-foreground')` used to return just `'text-foreground'`, silently
 * deleting the size from every `cn()` call that carried a size and a colour
 * together. That hit ~48 call sites, including `SectionHeader`, i.e. the
 * title of essentially every screen in the app.
 *
 * Registering the names in the `font-size` class group teaches the merger
 * that these are sizes: they no longer collide with colours, and they DO
 * collide with each other and with the stock scale (last one wins), which is
 * what `cn()` is for.
 *
 * Keep this list in sync with `theme.extend.fontSize` in `tailwind.config.ts`
 * — `src/test/cnFontSize.test.ts` fails if it drifts.
 */
export const CUSTOM_FONT_SIZES = [
  "micro",
  "caption",
  "body",
  "title",
  "h3",
  "h2",
  "hero",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...CUSTOM_FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
