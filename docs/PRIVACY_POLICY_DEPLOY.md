# Dynasty Manager — Marketing & Support Site

Static marketing/support/privacy site that lives in `docs/`. Designed to be
deployed as its own Vercel project, separate from the React app at the
repo root.

## Pages

| Path | File | Purpose |
|---|---|---|
| `/` | `index.html` | Landing page — hero, features, stats, CTAs |
| `/privacy` | `privacy.html` | Privacy Policy (the URL Apple App Review requires) |
| `/support` | `support.html` | Support page — FAQ + contact emails |

`styles.css` holds the shared dark-glass styling so all three pages stay in
sync.

## Deploying to Vercel

This site must be deployed as its own Vercel project — **not** as the same
project that builds the React app at the repo root.

1. In Vercel, click **Add New… → Project** and import the `dynasty-manager`
   repository (you can import the same repo into multiple projects).
2. On the configuration screen:
   - **Framework Preset:** `Other`
   - **Root Directory:** `docs`
   - **Build Command:** *(leave blank — overriding off)*
   - **Output Directory:** *(leave blank)*
3. Click **Deploy**. Vercel returns a URL like
   `https://dynasty-manager-site.vercel.app`.
4. **Settings → Deployment Protection →** disable Vercel Authentication for
   production so Apple's reviewer (and the public) can reach the pages.
5. Optional: **Settings → Domains** → attach a custom domain such as
   `dynastymanager.app`.
6. Paste the resulting privacy URL into App Store Connect →
   **App Privacy → Privacy Policy URL** (e.g. `https://your-domain/privacy`).
7. Paste the support URL into App Store Connect → **App Information →
   Support URL** (e.g. `https://your-domain/support`).

### If `dynasty-manager-two.vercel.app` currently serves the React app

That project was created with Root Directory at the repo root, so Vercel
detected Vite and built the game. Two ways to fix it:

**A. Reconfigure that project to serve `docs/`:**
1. Settings → General → Root Directory → set to `docs` → Save.
2. Settings → General → Framework Preset → change to **Other**.
3. Build & Output Settings → leave Build Command and Output Directory
   blank (toggle "Override" on if needed and leave the value empty).
4. Deployments tab → latest deploy → ⋯ → **Redeploy**.

**B. Create a second Vercel project pointing to `docs/`:**
Follow the steps in *Deploying to Vercel* above, and leave the existing
project as the game preview. You'll have two URLs — one for the game,
one for marketing/privacy/support.

## Why redirects in `vercel.json`?

`docs/` also contains internal markdown reports (release audits, balance
notes, etc.) that ship with the repo. The `vercel.json` redirects send any
`*.md` or `*.json` request back to `/`, so the deployed Vercel site only
ever serves the three public pages plus `styles.css`. The internal docs
remain repo-only and are unreachable from the public URL.

## Local preview

```bash
cd docs
npx serve .
# then open http://localhost:3000
```

Or open `docs/index.html` directly in a browser (clean-URL routing won't
work, but the pages render fine).

## Editing

All three pages are self-contained HTML — no build step. Update the
"Effective date" on the privacy page whenever you make a material change,
and keep its disclosures in sync with the **App Privacy** answers in
App Store Connect.

If a future build introduces analytics, ads, or App Tracking Transparency,
update sections **3** and **4** of `privacy.html` before that build ships.
