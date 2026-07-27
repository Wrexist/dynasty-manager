import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      /**
       * Seven-step type scale — the ONLY sizes new UI should reach for.
       * Replaces the ad-hoc `text-[8px]`…`text-[36px]` sprawl. 11px is the
       * hard floor: anything smaller reads as unfinished on a 375px screen
       * and is the loudest "hobbyist" signal an App Store reviewer picks up.
       */
      fontSize: {
        micro: ['11px', { lineHeight: '14px' }],
        caption: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        title: ['16px', { lineHeight: '22px' }],
        h3: ['20px', { lineHeight: '26px' }],
        h2: ['24px', { lineHeight: '30px' }],
        hero: ['36px', { lineHeight: '40px' }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /**
         * Medal tiers. These map to vars declared in `src/index.css` :root
         * that `.game-theme` deliberately does NOT override — unlike
         * `--primary`, which flips to emerald in-game. Use `text-gold` /
         * `bg-gold/15` for anything that must read as gold on EVERY screen
         * (trophies, Ballon d'Or, gold-tier achievements/sponsors).
         * `text-primary` in-game is GREEN.
         */
        gold: "hsl(var(--gold))",
        silver: "hsl(var(--silver))",
        bronze: "hsl(var(--bronze))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /**
       * Elevation + rim scale, seeded from the liquid-glass stack in
       * `src/components/game/GlassPanel.tsx`. Use these instead of writing a
       * fresh `shadow-[...]` arbitrary value — the audit found dozens of
       * near-identical hand-rolled stacks that drift apart over time.
       *
       *   rim          — 1px inner hairline stroke, no depth
       *   elev-1..3    — ambient depth only (chips → cards → floating)
       *   glass        — the full GlassPanel stack (rim + top highlight +
       *                  bottom shade + drop). Prefer <GlassPanel>.
       *   glass-danger — same, warmer rim for destructive sections
       *   glow-primary — themed focus/active glow (GREEN in-game)
       *   glow-gold    — trophy/reward glow (gold on every screen)
       *   sheet        — bottom-sheet / modal lift
       */
      boxShadow: {
        rim: "0 0 0 1px rgba(255,255,255,0.06) inset",
        "elev-1": "0 1px 2px -1px rgba(0,0,0,0.35)",
        "elev-2": "0 6px 16px -10px rgba(0,0,0,0.45)",
        "elev-3": "0 14px 36px -18px rgba(0,0,0,0.55)",
        glass:
          "0 0 0 1px rgba(255,255,255,0.06) inset, inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.32), 0 10px 28px -16px rgba(0,0,0,0.4)",
        "glass-danger":
          "0 0 0 1px rgba(255,120,120,0.12) inset, inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.32), 0 10px 28px -16px rgba(0,0,0,0.45)",
        "glow-primary": "0 0 20px hsl(var(--primary) / 0.3)",
        "glow-gold": "0 0 20px hsl(var(--gold) / 0.3)",
        sheet: "0 -8px 40px -12px rgba(0,0,0,0.7)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
