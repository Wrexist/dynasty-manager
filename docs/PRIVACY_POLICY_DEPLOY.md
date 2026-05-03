# Dynasty Manager — Privacy Policy Site

Standalone static page that hosts the public Privacy Policy required by Apple's
App Review process. Lives alongside other internal docs in this folder, but
`vercel.json` rewrites every request to `index.html`, so the internal markdown
files are not exposed to the public.

## Deploying to Vercel

1. In Vercel, click **Add New… → Project** and import the `dynasty-manager`
   repository.
2. On the configuration screen, set:
   - **Framework Preset:** `Other`
   - **Root Directory:** `docs`
   - **Build Command:** *(leave blank)*
   - **Output Directory:** *(leave blank — Vercel serves the folder as static)*
3. Click **Deploy**. Vercel returns a URL like
   `https://dynasty-manager-privacy.vercel.app`.
4. Optional: in **Settings → Domains**, attach a custom domain such as
   `privacy.dynastymanager.app`.
5. Paste the resulting URL into App Store Connect → **App Privacy → Privacy
   Policy URL**.

## Local preview

```bash
cd docs
npx serve .
# or just open docs/index.html directly in a browser
```

## Editing the policy

`index.html` is a single self-contained file — no build step. Update the
"Effective date" in the header whenever you make a material change, and keep
the disclosures in sync with the **App Privacy** answers in App Store Connect.

If a future build introduces analytics, ads, or App Tracking Transparency,
update sections **3** (Information We Do Not Collect) and **4** (App Tracking
Transparency) before that build ships.

## Why the rewrite?

`docs/` also contains internal markdown reports (release audits, balance
notes, etc.). The `vercel.json` rewrite rule sends every incoming path to
`index.html`, which means the deployed Vercel site only ever serves the
privacy policy — the markdown files in this folder remain repo-only and are
never reachable from the public Vercel URL.
