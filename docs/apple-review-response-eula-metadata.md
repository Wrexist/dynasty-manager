# Apple App Review Response — Terms of Use (EULA) in Metadata

> Guideline 3.1.2(a) — Auto-renewable subscription: functional Terms of Use
> (EULA) link required in the app's metadata.
>
> Before resubmitting: update the **App Description** field in App Store
> Connect to the copy in `APP_STORE_LISTING.md`, then paste the reply below
> into the App Review message thread.

---

## What was wrong

The live **App Description** did not contain a functional Terms of Use (EULA)
link. The in-app subscription flow already renders one — footer of
`src/pages/SubscribeOnboarding.tsx`, opening
`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` in the
system browser — but Apple requires the link in the **metadata** as well, and
the Description field still held the `[INSERT URL]` placeholders.

## What we fixed

- **App Description** now ends with both required links (see
  `APP_STORE_LISTING.md`):
  - Privacy Policy: `https://wrexist.github.io/dynasty-manager/privacy.html`
  - Terms of Use (EULA): `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- These mirror `src/config/legal.ts` (`TERMS_URL` / `PRIVACY_URL`), the same
  URLs already linked from the in-app paywall — so metadata and binary now
  agree.
- We use Apple's **standard EULA**, which Apple accepts, so no custom license
  agreement is uploaded to App Store Connect.

---

## Reply to App Review

Hi App Review Team,

Thank you for the feedback. We have added a functional Terms of Use (EULA) link
to the app's metadata.

The **App Description** now includes a link to Apple's standard Terms of Use
(EULA) at
`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`, alongside
our Privacy Policy at
`https://wrexist.github.io/dynasty-manager/privacy.html`. Both links resolve
and open in the browser.

For reference, the same Terms of Use (EULA) and Privacy Policy links are also
presented inside the in-app subscription purchase flow (footer of the Dynasty
Pro paywall), in addition to the metadata.

We use Apple's standard EULA and have not uploaded a custom license agreement.

Thanks again for the review.

Best,
The Dynasty Manager team
