/**
 * The Club — identity, what the money could buy, sponsors, and the books.
 *
 * One screen rather than three because at this scale they are one subject: the
 * upgrade you want costs the money you have not got, which is why the sponsor
 * on the next panel matters. Splitting them would hide the trade-off that is
 * the whole point.
 */
import { useMemo, useState } from 'react';
import { Banknote, Landmark, MapPin, Receipt, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { StatChip, SundayCrest } from '@/components/game/sunday/SundayBits';
import { SundayEventModal } from '@/components/game/sunday/SundayEventModal';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/helpers';
import {
  SUNDAY_UPGRADES, getSundayPersonality, sundayUpgradeCost,
} from '@/config/sundayLeague';
import { splitLedger, sundayWeeklyBurn } from '@/utils/sunday/finance';

type Tab = 'upgrades' | 'sponsors' | 'books';

const SundayClub = () => {
  const { t } = useTranslation();
  const sunday = useGameStore(s => s.sunday);
  const { buyUpgrade, acceptSponsor, declineSponsor } = useGameStore(useShallow(s => ({
    buyUpgrade: s.buySundayUpgrade,
    acceptSponsor: s.acceptSundaySponsor,
    declineSponsor: s.declineSundaySponsor,
  })));
  const [tab, setTab] = useState<Tab>('upgrades');

  const totals = useMemo(() => {
    if (!sunday) return { income: 0, expenses: 0 };
    return splitLedger(sunday.ledger.flatMap(l => l.lines));
  }, [sunday]);

  if (!sunday) return null;
  const personality = getSundayPersonality(sunday.identity.personality);
  const burn = sundayWeeklyBurn(sunday.divisionId, sunday.upgrades);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'upgrades', label: t('sunday.club.upgrades'), icon: Wrench },
    { key: 'sponsors', label: t('sunday.club.sponsors'), icon: Banknote },
    { key: 'books', label: t('sunday.club.finances'), icon: Receipt },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SundayEventModal />
      <SectionHeader title={t('sunday.club.title')} icon={Landmark} />

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
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {sunday.identity.venue} · {sunday.identity.town}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatChip label={t('sunday.club.personality')} value={personality.name} />
          <StatChip
            label={t('sunday.hub.balance')}
            value={formatMoney(sunday.balance)}
            tone={sunday.balance < 0 ? 'bad' : sunday.balance < 100 ? 'warn' : 'good'}
          />
        </div>
        <p className="text-micro text-muted-foreground">{t('sunday.club.weeklyBurn', { n: burn })}</p>
      </GlassPanel>

      {/* Tabs */}
      <div className="flex gap-1.5" role="tablist" aria-label={t('sunday.club.title')}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex-1 px-3 py-2 rounded-full border text-caption font-semibold min-h-[44px] inline-flex items-center justify-center gap-1.5',
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
          {SUNDAY_UPGRADES.map(u => {
            const level = sunday.upgrades.find(x => x.id === u.id)?.level ?? 0;
            const maxed = level >= u.maxLevel;
            const cost = sundayUpgradeCost(u.id, level);
            const locked = sunday.reputation < u.minReputation;
            const affordable = sunday.balance >= cost;
            return (
              <GlassPanel key={u.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-foreground">
                      {u.name}
                      {level > 0 && (
                        <span className="ml-2 text-micro font-medium text-primary">{t('sunday.club.owned', { n: level })}</span>
                      )}
                    </p>
                    <p className="text-caption text-muted-foreground leading-relaxed mt-0.5">{u.description}</p>
                    <p className="text-micro text-muted-foreground/80 mt-1">{u.effectText}</p>
                  </div>
                  <LiquidButton
                    tone={maxed ? 'default' : affordable && !locked ? 'primary' : 'default'}
                    disabled={maxed || locked || !affordable}
                    className="shrink-0 px-3 py-2"
                    onClick={() => { void buyUpgrade(u.id).then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); }); }}
                  >
                    <span className="text-micro whitespace-nowrap">
                      {maxed ? t('sunday.club.maxed') : locked ? t('sunday.club.locked') : t('sunday.club.buy', { n: cost })}
                    </span>
                  </LiquidButton>
                </div>
              </GlassPanel>
            );
          })}
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
                <LiquidButton tone="primary" className="flex-1 py-2" onClick={() => {
                  void acceptSponsor(offer.id).then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); });
                }}>
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

          {sunday.ledger.length === 0 ? (
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

export default SundayClub;
