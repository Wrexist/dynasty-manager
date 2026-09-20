# Pack store rotation

The permanent shelf contains Bronze, Silver, Gold, Elite, World Class and Legends.
Bronze and Silver each have one free daily open. The existing streak-based Rise
to Glory daily pack is retained separately. Gold reuses the Champions SKU and
cover; no new App Store products are introduced.

Three independent, epoch-aligned offer windows rotate the existing paid tiers:
4 hours (+3 cards), 12 hours (+2), and 24 hours (+1). Windows use the persisted
high-water clock. Reopening the store does not restart a timer. Advancing the
device clock can advance offers, but moving it backward cannot restore them.
The existing weekly themed edition remains available alongside these deals.

When concurrent windows feature the same product, each rail card sells its
stated bonus. The permanent shelf selects the largest available bonus, including
the existing weekly bonus. Bonuses do not stack. Bonus cards use the existing
guaranteed-floor bonus generation and the odds sheet includes that guarantee.

Before payment, the selected offer is revalidated. An expired offer stops the
purchase and asks the player to review the current offer. The bonus is persisted
with the pending purchase marker before StoreKit starts, then delivered only
after a confirmed charge. Recovery retains that bonus after expiration; legacy
markers receive standard contents. Squad capacity includes the entire bonus.

Offer popups can follow free pack reveals or appear during dashboard gaps after
a recent win / within an hour of expiration. They are suppressed in the first
two career weeks, during matches, and when the store or squad cannot accept the
purchase. Dashboard offers wait behind other presentation-queue overlays.
One offer is allowed per foreground session, at most two per day, with a six-hour
minimum gap. Win-triggered offers require no previous offer that day. Dismissal,
Escape, focus containment, reduced motion and scroll locking are supported.
Pending purchase recovery retains the existing service messages.

This is a feature branch, not a release submission. Device checks still need to
cover iPhone/iPad layouts, StoreKit interruptions and all four sandbox products.
Release versioning and App Store Connect metadata remain separate release tasks.
