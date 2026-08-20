/**
 * The Clubhouse — the ground itself, the sponsors on its fence, and the books.
 *
 * One screen rather than three because at this scale they are one subject: the
 * upgrade you want costs the money you have not got, which is why the sponsor
 * on the next tab matters. Splitting them would hide the trade-off that is the
 * whole point.
 *
 * WHAT CHANGED, AND WHY. This screen used to be ten stacked `GlassPanel`s, one
 * per upgrade, each carrying a flavour sentence AND an effect sentence — 955
 * characters of catalogue describing things the player could not see and could
 * not check. It is now the ground, drawn (`SundayGround`), over one panel of
 * ten one-line rows. Buying something changes the picture; the row that is open
 * shows the NUMBER it moves (pitch 38 → 52, upkeep £9 → £12, from
 * `sundayUpgradePreview`, which reads the same helpers the buy action does)
 * rather than a sentence claiming it. The prose survives one line at a time on
 * the open row, which is where it was always worth reading.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { StatChip, SundayCrest } from '@/components/game/sunday/SundayBits';
import { SundayGround } from '@/components/game/sunday/SundayGround';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/helpers';
import { getSundayPersonality } from '@/config/sundayLeague';
import { SUNDAY_ICON, SUNDAY_UPGRADE_ICON } from '@/config/sundayIcons';
import type { SundayUpgradeId } from '@/types/game';
import { splitLedger, sundayUpgradeUpkeep, sundayWeeklyBurn } from '@/utils/sunday/finance';
import {
  sundayUpgradePreview, sundayUpgradeScene,
  type SundayUpgradeStat,
} from '@/utils/sunday/view';

const VenueIcon = SUNDAY_ICON.venue;
const RepIcon = SUNDAY_ICON.reputation;

/** Which glyph stands for each number an upgrade moves. */
const STAT_ICON: Record<SundayUpgradeStat, React.ElementType> = {
  pitch: SUNDAY_ICON.pitch,
  reputation: SUNDAY_ICON.reputation,
  morale: SUNDAY_ICON.morale,
  upkeep: SUNDAY_ICON.expense,
};

const STAT_LABEL: Record<SundayUpgradeStat, string> = {
  pitch: 'sunday.club.statPitch',
  reputation: 'sunday.club.statReputation',
  morale: 'sunday.club.statMorale',
  upkeep: 'sunday.club.statUpkeep',
};

type Tab = 'upgrades' | 'sponsors' | 'books';

const SundayClubhouse = () => {
  const { t } = useTranslation();
  const sunday = useGameStore(s => s.sunday);
  const { week, buyUpgrade, mothballUpgrade, acceptSponsor, declineSponsor } = useGameStore(useShallow(s => ({
    week: s.week,
    buyUpgrade: s.buySundayUpgrade,
    mothballUpgrade: s.mothballSundayUpgrade,
    acceptSponsor: s.acceptSundaySponsor,
    declineSponsor: s.declineSundaySponsor,
  })));
  const [tab, setTab] = useState<Tab>('upgrades');
  /** Which thing on the ground is open. Null until something is tapped, so the
   *  screen opens on the picture rather than on a form. */
  const [open, setOpen] = useState<SundayUpgradeId | null>(null);
  // Which purchase is mid-flight. The store actions are async, so without this
  // a double tap buys the upgrade twice or signs the sponsor twice.
  const [busy, setBusy] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!sunday) return { income: 0, expenses: 0 };
    // Money moved this week is already out of the account, so it belongs in the
    // headline figures even though its ledger entry has not been written yet.
    return splitLedger([...sunday.ledger.flatMap(l => l.lines), ...sunday.pendingLedger]);
  }, [sunday]);

  const scene = useMemo(() => (sunday ? sundayUpgradeScene(sunday) : null), [sunday]);
  const previews = useMemo(
    () => (sunday ? scene!.items.map(i => sundayUpgradePreview(sunday, week, i.id)) : []),
    [sunday, scene, week],
  );

  if (!sunday || !scene) return null;
  const personality = getSundayPersonality(sunday.identity.personality);
  const burn = sundayWeeklyBurn(sunday.divisionId, sunday.upgrades);
  const upkeep = sundayUpgradeUpkeep(sunday.divisionId, sunday.upgrades);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'upgrades', label: t('sunday.club.upgrades'), icon: SUNDAY_ICON.upgrade },
    { key: 'sponsors', label: t('sunday.club.sponsors'), icon: SUNDAY_ICON.sponsor },
    { key: 'books', label: t('sunday.club.finances'), icon: SUNDAY_ICON.ledger },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SectionHeader title={t('sunday.club.title')} icon={SUNDAY_ICON.clubhouse} />

      {/* Identity */}
      <GlassPanel className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <SundayCrest shortName={sunday.identity.shortName} color={sunday.identity.color} secondaryColor={sunday.identity.secondaryColor} size={44} />
          <div className="min-w-0">
            <p className="text-title font-display font-bold text-foreground truncate">{sunday.identity.name}</p>
            <p className="text-caption text-muted-foreground truncate">
              {t('sunday.club.nickname')} {sunday.identity.nickname}
            </p>
          </div>
        </div>
        <p className="text-caption text-muted-foreground flex items-center gap-1.5">
          <VenueIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {sunday.identity.venue} · {sunday.identity.town}
        </p>
        {/* Three chips rather than two chips and a sentence: "Roughly £34 a
            week to exist" was a whole line of prose carrying one number, and
            the number is the part anyone reads. */}
        <div className="grid grid-cols-3 gap-2">
          <StatChip label={t('sunday.club.personality')} value={personality.name} />
          <StatChip
            label={t('sunday.hub.balance')}
            value={formatMoney(sunday.balance)}
            tone={sunday.balance < 0 ? 'bad' : sunday.balance < 100 ? 'warn' : 'good'}
          />
          <StatChip label={t('sunday.club.burnLabel')} value={formatMoney(-burn)} tone="bad" />
        </div>
      </GlassPanel>

      {/* Tabs */}
      {/* Scrolls inside itself rather than shrinking the labels to ellipses —
          and rather than pushing the page sideways, which is what the old
          "What the money could buy" tab label did at 375px. */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" role="tablist" aria-label={t('sunday.club.title')}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex-1 shrink-0 px-2 py-2 rounded-full border text-caption font-semibold min-h-[44px] inline-flex items-center justify-center gap-1',
              tab === tb.key
                ? 'bg-primary/15 border-primary/50 text-primary'
                : 'bg-white/[0.04] border-white/10 text-muted-foreground',
            )}
          >
            <tb.icon className="w-3.5 h-3.5" aria-hidden />
            <span className="truncate">{tb.label}</span>
          </button>
        ))}
      </div>

      {tab === 'upgrades' && (
        <div className="space-y-2">
          <SundayGround
            items={scene.items}
            color={sunday.identity.color}
            secondaryColor={sunday.identity.secondaryColor}
            sponsorNames={sunday.sponsors.map(d => d.name)}
            selected={open}
            onSelect={id => setOpen(cur => (cur === id ? null : id))}
          />

          {/* ONE panel of ten rows, not ten panels. A card inside a card inside
              a tab was three nested surfaces deep, and the mothball button —
              full width, under a buy button that was not — made selling look
              like the primary action on every owned upgrade. */}
          <GlassPanel className="p-1.5">
            <ul className="divide-y divide-white/[0.06]">
              {previews.map(u => {
                const Icon = SUNDAY_UPGRADE_ICON[u.id];
                const isOpen = open === u.id;
                const buyable = !u.maxed && !u.locked && u.affordable;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(cur => (cur === u.id ? null : u.id))}
                      aria-expanded={isOpen}
                      aria-label={t('sunday.club.groundSpot', { name: u.name, n: u.level, max: u.maxLevel })}
                      className="w-full min-h-[44px] flex items-center gap-2.5 px-2 py-2 text-left"
                    >
                      <Icon
                        className={cn('w-4 h-4 shrink-0', u.owned ? 'text-primary' : 'text-muted-foreground')}
                        aria-hidden
                      />
                      <span className={cn('flex-1 min-w-0 truncate text-body', u.owned ? 'text-foreground font-semibold' : 'text-foreground/80')}>
                        {u.name}
                      </span>
                      {/* Level as pips: a row of ten "Level 2" labels is ten
                          words to read, and the shape of a filled pip row is
                          readable without reading. */}
                      <span className="inline-flex gap-0.5 shrink-0" aria-hidden>
                        {Array.from({ length: u.maxLevel }, (_, i) => (
                          <span
                            key={i}
                            className={cn('w-1.5 h-1.5 rounded-full', i < u.level ? 'bg-primary' : 'bg-white/15')}
                          />
                        ))}
                      </span>
                      {/* The price, or the reason there is no price. "Needs 30
                          standing" wrapped onto two lines here and grew every
                          locked row by 12px, so a locked row shows the standing
                          it wants as the reputation glyph and a number — the
                          sentence survives on the open row's dead button. */}
                      <span className={cn(
                        'shrink-0 text-micro font-semibold tabular-nums w-16 text-right whitespace-nowrap',
                        u.maxed ? 'text-muted-foreground'
                          : u.locked ? 'text-muted-foreground/70'
                            : u.affordable ? 'text-primary' : 'text-muted-foreground/70',
                      )}>
                        {u.maxed ? (
                          /* The pips are already all filled; "Nothing more to
                             buy" is nineteen characters saying so again. */
                          '—'
                        ) : u.locked ? (
                          <span className="inline-flex items-center gap-1 justify-end">
                            <RepIcon className="w-3 h-3 shrink-0" aria-hidden />
                            {u.minReputation}
                          </span>
                        ) : (
                          formatMoney(u.cost!)
                        )}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-2 pb-2.5 space-y-2">
                        <p className="text-caption text-muted-foreground leading-snug">{u.description}</p>

                        {/* The change, not a claim about the change. */}
                        {u.changes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {u.changes.map(c => {
                              const StatIcon = STAT_ICON[c.stat];
                              const money = c.stat === 'upkeep';
                              return (
                                <span
                                  key={c.stat}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 text-micro"
                                >
                                  <StatIcon className="w-3 h-3 shrink-0 text-muted-foreground" aria-hidden />
                                  <span className="text-muted-foreground">{t(STAT_LABEL[c.stat])}</span>
                                  <span className="tabular-nums text-muted-foreground/70">
                                    {money ? formatMoney(c.from) : c.from}
                                  </span>
                                  <span aria-hidden className="text-muted-foreground/50">→</span>
                                  <span className={cn(
                                    'tabular-nums font-semibold',
                                    c.stat === 'upkeep' ? 'text-amber-300' : 'text-emerald-300',
                                  )}>
                                    {money ? formatMoney(c.to) : c.to}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* The written claim survives only where no club number
                            reports the effect — a physio who heals faster, a
                            coach who improves the shape's fit. */}
                        {u.changes.length <= 1 && (
                          <p className="text-micro text-muted-foreground/80">{u.effectText}</p>
                        )}
                        {u.owned && (
                          <p className="text-micro text-amber-200/80">
                            {t('sunday.club.upkeep', {
                              n: sundayUpgradeUpkeep(sunday.divisionId, [{ id: u.id, level: u.level }]),
                            })}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <LiquidButton
                            tone={buyable ? 'primary' : 'default'}
                            disabled={!buyable}
                            busy={busy === `buy:${u.id}`}
                            className="flex-1 py-2.5"
                            onClick={() => {
                              if (busy) return;
                              setBusy(`buy:${u.id}`);
                              void buyUpgrade(u.id)
                                .then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); })
                                .finally(() => setBusy(null));
                            }}
                          >
                            <span className="text-micro whitespace-nowrap">
                              {u.maxed
                                ? t('sunday.club.maxed')
                                : u.locked
                                  ? t('sunday.club.locked', { n: u.minReputation })
                                  : t('sunday.club.buy', { n: u.cost })}
                            </span>
                          </LiquidButton>
                          {/* Selling is the escape valve, not the offer. It
                              reads as a link beside the button, which is the
                              weight it should always have had. */}
                          {u.owned && (
                            <button
                              type="button"
                              className="shrink-0 min-h-[44px] px-3 text-micro text-muted-foreground underline underline-offset-2"
                              onClick={() => {
                                void mothballUpgrade(u.id)
                                  .then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); });
                              }}
                            >
                              {t('sunday.club.mothball', { n: u.refund })}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </GlassPanel>

          <p className="px-1 text-micro text-muted-foreground tabular-nums">
            {t('sunday.club.statUpkeep')} · {formatMoney(-upkeep)}
          </p>
        </div>
      )}


      {tab === 'sponsors' && (
        <div className="space-y-2">
          {sunday.sponsorOffers.map(offer => (
            <GlassPanel key={offer.id} className="p-4 space-y-2">
              <SectionHeader level="section" title={offer.name} accessory={
                <span className="text-caption text-emerald-300">{t('sunday.club.sponsorWeekly', { n: offer.weekly })}</span>
              } />
              <p className="text-caption text-muted-foreground leading-relaxed">{offer.blurb}</p>
              <p className="text-caption text-foreground/80">{offer.conditionText}</p>
              <p className="text-micro text-muted-foreground">
                {t('sunday.club.sponsorOffer')} · {formatMoney(offer.signOn)}
              </p>
              <div className="flex gap-2">
                <LiquidButton
                  tone="primary"
                  className="flex-1 py-2"
                  busy={busy === `sponsor:${offer.id}`}
                  onClick={() => {
                    if (busy) return;
                    setBusy(`sponsor:${offer.id}`);
                    void acceptSponsor(offer.id)
                      .then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); })
                      .finally(() => setBusy(null));
                  }}
                >
                  <span className="text-micro">{t('sunday.club.accept')}</span>
                </LiquidButton>
                <LiquidButton className="flex-1 py-2" onClick={() => { void declineSponsor(offer.id); }}>
                  <span className="text-micro">{t('sunday.club.decline')}</span>
                </LiquidButton>
              </div>
            </GlassPanel>
          ))}

          {sunday.sponsors.length === 0 && sunday.sponsorOffers.length === 0 && (
            <GlassPanel className="p-6 text-center">
              <p className="text-body text-muted-foreground">{t('sunday.club.noSponsors')}</p>
            </GlassPanel>
          )}

          {sunday.sponsors.map(deal => (
            <GlassPanel key={deal.id} className="p-4 space-y-1.5">
              <SectionHeader level="section" title={deal.name} accessory={
                <span className="text-caption text-emerald-300">{t('sunday.club.sponsorWeekly', { n: deal.weekly })}</span>
              } />
              <p className="text-caption text-muted-foreground leading-relaxed">{deal.blurb}</p>
              {deal.condition !== 'none' && (
                <>
                  <p className="text-caption text-foreground/80">{deal.conditionText}</p>
                  <p className="text-micro text-muted-foreground">
                    {t('sunday.club.progress', { n: deal.conditionProgress, target: deal.conditionTarget })}
                  </p>
                </>
              )}
            </GlassPanel>
          ))}
        </div>
      )}

      {tab === 'books' && (
        <div className="space-y-2">
          <GlassPanel className="p-4">
            <div className="grid grid-cols-3 gap-2">
              <StatChip label={t('sunday.club.income')} value={formatMoney(totals.income)} tone="good" />
              <StatChip label={t('sunday.club.expenses')} value={formatMoney(-totals.expenses)} tone="bad" />
              <StatChip
                label={t('sunday.club.net')}
                value={formatMoney(totals.income - totals.expenses, { signed: true })}
                tone={totals.income - totals.expenses >= 0 ? 'good' : 'bad'}
              />
            </div>
          </GlassPanel>

          {/* This week, so far. Lines the manager has caused but the weekly
              settlement has not yet folded into an entry. */}
          {sunday.pendingLedger.length > 0 && (
            <GlassPanel className="p-3.5">
              <SectionHeader level="section" title={t('sunday.club.ledgerPending')} />
              <ul className="mt-2 space-y-1">
                {sunday.pendingLedger.map((line, i) => (
                  <li key={`${line.label}-${i}`} className="flex items-baseline gap-2 text-caption">
                    <span className="min-w-0 flex-1 text-muted-foreground truncate">{line.label}</span>
                    <span className={cn('font-semibold tabular-nums shrink-0', line.amount >= 0 ? 'text-emerald-300' : 'text-destructive')}>
                      {formatMoney(line.amount, { signed: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          )}

          {sunday.ledger.length === 0 && sunday.pendingLedger.length === 0 ? (
            <GlassPanel className="p-6 text-center">
              <p className="text-body text-muted-foreground">{t('sunday.club.noLedger')}</p>
            </GlassPanel>
          ) : (
            [...sunday.ledger].reverse().slice(0, 8).map(entry => (
              <GlassPanel key={`${entry.season}-${entry.week}`} className="p-3.5">
                <SectionHeader
                  level="section"
                  title={t('sunday.club.ledgerWeek', { week: entry.week })}
                  accessory={<span className="text-caption font-semibold text-foreground">{formatMoney(entry.balance)}</span>}
                />
                <ul className="mt-2 space-y-1">
                  {entry.lines.map((line, i) => (
                    <li key={`${line.label}-${i}`} className="flex items-baseline gap-2 text-caption">
                      <span className="min-w-0 flex-1 text-muted-foreground truncate">{line.label}</span>
                      <span className={cn('font-semibold tabular-nums shrink-0', line.amount >= 0 ? 'text-emerald-300' : 'text-destructive')}>
                        {formatMoney(line.amount, { signed: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SundayClubhouse;
