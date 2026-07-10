/**
 * SubscribeOnboarding navigation guard.
 *
 * The subscription onboarding shows once per device at the start of the New
 * Game funnel (TitleScreen routes to '/subscribe' before '/mode-select' for
 * non-Pro users who haven't seen it — the owner's chosen placement). This
 * module holds the guard that keeps that flow from ever defaulting to save
 * slot 1 when navigation state is lost.
 */

export interface SubscribeNavState {
  slot?: number;
  returnTo?: string;
}

/**
 * True when `SubscribeOnboarding` was reached without a save slot AND without
 * an explicit in-app return context — i.e. a WKWebView reload / deep link on
 * `#/subscribe` that lost its navigation state. Proceeding would default the
 * slot to 1 and let the onboarding continuation (`returnTo: '/mode-select'`)
 * silently overwrite save slot 1, so the screen redirects to the title
 * instead. In-app upsells (Shop / Settings) pass an explicit `returnTo`
 * (`/game` or `/`) that never enters club setup, so they need no slot.
 */
export function subscribeSlotContextMissing(nav: SubscribeNavState): boolean {
  const returnTo = nav.returnTo || '/mode-select';
  return nav.slot == null && returnTo === '/mode-select';
}
