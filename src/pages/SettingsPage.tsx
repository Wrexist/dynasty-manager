import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { Save, Download, Trash2, Zap, Eye, RotateCcw, HelpCircle, Crown, RefreshCw, ExternalLink, Mail, MessageSquare, Vibrate, FileText, Shield, ShieldAlert, Home, AlertTriangle, Lightbulb, ShieldCheck, MonitorSmartphone, BookOpen, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { infoToast, successToast, errorToast } from '@/utils/gameToast';
import {
  removeFlag,
  clearFlagsByPrefix,
  deleteAllDynastyData,
  readCommunityPackSlotPref,
  writeCommunityPackSlotPref,
} from '@/store/helpers/persistence';
import { restorePurchases, openSubscriptionManagement, getCustomerInfo, extractSubscriptionInfo } from '@/utils/purchases';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { PRODUCTS } from '@/config/monetization';
import { SAVE_CONFIRMATION_MS } from '@/config/ui';
import { MATCH_SPEEDS } from '@/config/matchSpeed';

const APP_VERSION = 'v1.0.0 · Football Edition';

/**
 * Liquid-glass section wrapper — inset light highlights, specular crescent,
 * edge refraction streaks. Matches the CommunityPackPopup treatment so the
 * Settings surface reads as thick, polished glass end-to-end.
 */
function LiquidSection({ title, children, tone = 'default' }: {
  title?: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl p-4',
        'bg-gradient-to-br from-[hsl(222_35%_14%/0.65)] via-[hsl(222_28%_10%/0.7)] to-[hsl(222_40%_7%/0.75)]',
        'backdrop-blur-2xl backdrop-saturate-150',
        tone === 'danger'
          ? 'shadow-[0_0_0_0.5px_rgba(255,110,110,0.18)_inset,inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.4),0_16px_40px_-18px_rgba(0,0,0,0.6)]'
          : 'shadow-[0_0_0_0.5px_rgba(255,255,255,0.14)_inset,inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.4),0_16px_40px_-18px_rgba(0,0,0,0.6)]',
      )}
    >
      {/* Top specular crescent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 60%)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Edge refraction */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,0.08) 100%)',
        }}
      />
      <div className="relative">
        {title && (
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">{title}</h3>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Liquid-glass button — translucent capsule with specular top rim, inset
 * bottom shadow, haptic-ready focus ring. `tone` tunes the surface:
 *   - default: neutral glass
 *   - primary: gold gradient (primary CTA)
 *   - amber / destructive: tinted glass for warnings
 */
type LiquidButtonTone = 'default' | 'primary' | 'amber' | 'destructive';

function LiquidButton({
  children,
  onClick,
  tone = 'default',
  disabled,
  className,
  'aria-label': ariaLabel,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: LiquidButtonTone;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  type?: 'button' | 'submit';
}) {
  const toneClasses: Record<LiquidButtonTone, string> = {
    default:
      'bg-white/6 text-foreground/90 border-white/15 hover:bg-white/10 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.3),0_6px_16px_-8px_rgba(0,0,0,0.5)]',
    primary:
      'bg-gradient-to-b from-primary/95 to-primary/75 text-primary-foreground border-primary/40 hover:from-primary hover:to-primary/80 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.35),0_10px_22px_-8px_hsl(43_96%_46%/0.55)]',
    amber:
      'bg-amber-400/10 text-amber-200 border-amber-400/35 hover:bg-amber-400/15 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3),0_6px_16px_-8px_rgba(0,0,0,0.45)]',
    destructive:
      'bg-destructive/15 text-red-300 border-destructive/35 hover:bg-destructive/20 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.35),0_6px_16px_-8px_rgba(0,0,0,0.45)]',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative w-full h-11 rounded-2xl font-semibold text-sm border backdrop-blur-xl backdrop-saturate-150',
        'active:scale-[0.98] transition-transform',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        disabled && 'opacity-50 cursor-not-allowed',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Reusable toggle row with label, description, and liquid-glass pill switch.
 * Knob has a subtle specular highlight on top; track shows a gold glow when on.
 */
function ToggleRow({ icon: Icon, label, description, value, onChange }: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-foreground leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{description}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={onChange}
        className={cn(
          'relative w-11 h-6 rounded-full shrink-0 transition-colors border backdrop-blur-md',
          value
            ? 'bg-gradient-to-b from-primary/90 to-primary/70 border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(0,0,0,0.3),0_0_18px_-4px_hsl(43_96%_46%/0.55)]'
            : 'bg-white/5 border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.3)]',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all',
            'bg-gradient-to-b from-white to-white/80',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_4px_-1px_rgba(0,0,0,0.35)]',
            value ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  );
}

const SettingsPage = () => {
  const settings = useGameStore(s => s.settings);
  const monetization = useGameStore(s => s.monetization);
  const activeSlot = useGameStore(s => s.activeSlot);
  const currentCommunityPack = useGameStore(s => s.communityPackEnabled);
  const updateSettings = useGameStore(s => s.updateSettings);
  const flushSave = useGameStore(s => s.flushSave);
  const loadGame = useGameStore(s => s.loadGame);
  const resetGame = useGameStore(s => s.resetGame);
  const setScreen = useGameStore(s => s.setScreen);
  const restoreEntitlements = useGameStore(s => s.restoreEntitlements);
  const updateSubscription = useGameStore(s => s.updateSubscription);
  const navigate = useNavigate();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(savedTimerRef.current); }, []);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  // The toggle controls the default for *future* new games on this slot. Seeded
  // from the per-slot localStorage pref; falls back to the current save's
  // communityPackEnabled when the pref hasn't been recorded yet (e.g. old saves
  // created before per-slot prefs existed).
  const [communityPackPref, setCommunityPackPref] = useState<boolean>(() => {
    const stored = readCommunityPackSlotPref(activeSlot);
    return stored === null ? currentCommunityPack === true : stored;
  });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'general'>('general');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const userIsPro = isPro(monetization);
  const hasActiveSub = isSubscriptionActive(monetization);

  const handleRestorePurchases = async () => {
    setRestoringPurchases(true);
    try {
      const granted = await restorePurchases();
      if (granted.length > 0) {
        restoreEntitlements(granted);
        successToast('Purchases Restored', `${granted.length} product${granted.length > 1 ? 's' : ''} restored.`);
      } else {
        infoToast('No Purchases Found', 'No previous purchases were found for this account.');
      }
      // Also sync subscription info
      const info = await getCustomerInfo();
      if (info) updateSubscription(extractSubscriptionInfo(info));
    } catch {
      errorToast('Restore Failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleManageSubscription = async () => {
    const opened = await openSubscriptionManagement();
    if (!opened) {
      errorToast('Not Available', 'Please visit your App Store or Play Store settings to manage your subscription.');
    }
  };

  const handleSave = () => {
    flushSave();
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), SAVE_CONFIRMATION_MS);
  };

  const handleSendFeedback = () => {
    const categoryLabels = { bug: 'Bug Report', feature: 'Feature Request', general: 'General Feedback' };
    const subject = encodeURIComponent(`[${categoryLabels[feedbackCategory]}] Dynasty Manager Feedback`);
    const body = encodeURIComponent(feedbackMessage.trim());
    window.open(`mailto:support@dynastymanager.com?subject=${subject}&body=${body}`, '_blank');
    successToast('Thank You!', 'Your email client has been opened with your feedback.');
    setFeedbackMessage('');
    setFeedbackCategory('general');
    setFeedbackOpen(false);
  };

  const handleReturnToMenu = () => {
    flushSave();
    navigate('/');
  };

  const handleReset = () => {
    resetGame();
    setShowResetConfirm(false);
  };

  const handleDeleteAllData = () => {
    deleteAllDynastyData();
    setShowDeleteDataConfirm(false);
    navigate('/');
    setTimeout(() => {
      successToast('Data Deleted', 'All game data has been permanently removed from this device.');
    }, 100);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground tracking-tight">Settings</h2>

      {/* ─── Gameplay ─── */}
      <LiquidSection title="Gameplay">
        <div className="space-y-4">
          {/* Match Speed — glass segmented control */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">Match Speed</p>
                <p className="text-[10px] text-muted-foreground">How fast match events play out</p>
              </div>
            </div>
            <div className="flex p-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.28)]">
              {MATCH_SPEEDS.map(s => {
                const locked = s.pro && !userIsPro;
                const active = settings.matchSpeed === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => locked ? setScreen('shop') : updateSettings({ matchSpeed: s.value })}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-xs font-semibold transition-all',
                      locked
                        ? 'text-muted-foreground/40 cursor-default'
                        : active
                          ? 'bg-gradient-to-b from-primary/90 to-primary/70 text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.3),0_4px_12px_-4px_hsl(43_96%_46%/0.55)]'
                          : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {locked && <Crown className="w-2.5 h-2.5" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={ShieldCheck}
            label="Confirm all offers"
            description="Ask before accepting any transfer offer"
            value={settings.confirmAllOffers}
            onChange={() => updateSettings({ confirmAllOffers: !settings.confirmAllOffers })}
          />
        </div>
      </LiquidSection>

      {/* ─── Community Pack ─── */}
      <LiquidSection title="Community Pack">
        <ToggleRow
          icon={Users}
          label="Use Real Players (Community Pack)"
          description="Real-world squads, rotating transfer market, seven extra leagues, ratings from a community FC26 dataset."
          value={communityPackPref}
          onChange={() => {
            const next = !communityPackPref;
            setCommunityPackPref(next);
            writeCommunityPackSlotPref(activeSlot, next);
          }}
        />

        {/* Attribution card — matches CommunityPackPopup treatment so the
            disclaimer is identical everywhere the feature is surfaced. */}
        <div className="mt-3 rounded-xl p-3 bg-amber-500/8 border border-amber-400/30 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.25)]">
          <div className="flex gap-2.5">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-300 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                Community-sourced — not our data
              </p>
              <p className="text-[10px] leading-snug text-amber-100/85">
                Dynasty Manager didn't create the real-player pool; it's a
                community-compiled FC26 dataset loaded offline on your device.
                We are <strong>not affiliated with, endorsed by, or sponsored by</strong>
                {' '}EA SPORTS, the FC franchise, FIFA, or any club, league, or player.
                All names, ratings, and likenesses belong to their respective rights holders.
              </p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/70 leading-snug mt-3">
          Changing this applies to new games only — existing saves keep the setting they were started with.
        </p>
      </LiquidSection>

      {/* ─── Display & Accessibility ─── */}
      <LiquidSection title="Display & Accessibility">
        <div className="space-y-4">
          <ToggleRow
            icon={Eye}
            label="Show OVR on pitch"
            description="Display player ratings on the pitch view"
            value={settings.showOverallOnPitch}
            onChange={() => updateSettings({ showOverallOnPitch: !settings.showOverallOnPitch })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Lightbulb}
            label="Page hints"
            description="Show tips when visiting pages for the first time"
            value={!settings.hidePageHints}
            onChange={() => updateSettings({ hidePageHints: !settings.hidePageHints })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={MonitorSmartphone}
            label="Reduced motion"
            description="Minimize animations throughout the app"
            value={settings.reducedMotion}
            onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Vibrate}
            label="Haptic feedback"
            description="Vibrate on key actions (mobile only)"
            value={settings.hapticsEnabled !== false}
            onChange={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
          />
        </div>
      </LiquidSection>

      {/* ─── Data ─── */}
      <LiquidSection title="Data">
        <div className="space-y-3">
          <ToggleRow
            icon={RotateCcw}
            label="Auto-save"
            description="Automatically save after each week"
            value={settings.autoSave}
            onChange={() => updateSettings({ autoSave: !settings.autoSave })}
          />

          <div className="border-t border-white/10" />

          <div className="space-y-2">
            <LiquidButton onClick={handleSave}>
              <span className="flex items-center justify-start gap-3 px-3">
                <Save className="w-4 h-4" />
                {saved ? 'Game Saved!' : 'Save Game'}
              </span>
            </LiquidButton>
            <LiquidButton onClick={() => loadGame()}>
              <span className="flex items-center justify-start gap-3 px-3">
                <Download className="w-4 h-4" />
                Load Game
              </span>
            </LiquidButton>
            {!showMenuConfirm ? (
              <LiquidButton
                tone="amber"
                onClick={() => { setShowMenuConfirm(true); setShowResetConfirm(false); }}
              >
                <span className="flex items-center justify-start gap-3 px-3">
                  <Home className="w-4 h-4" />
                  Main Menu
                </span>
              </LiquidButton>
            ) : (
              <div className="flex gap-2">
                <LiquidButton tone="primary" className="flex-1" onClick={handleReturnToMenu}>
                  Save &amp; Exit
                </LiquidButton>
                <LiquidButton className="flex-1" onClick={() => setShowMenuConfirm(false)}>
                  Cancel
                </LiquidButton>
              </div>
            )}
            {!showResetConfirm ? (
              <LiquidButton
                tone="destructive"
                onClick={() => { setShowResetConfirm(true); setShowMenuConfirm(false); }}
              >
                <span className="flex items-center justify-start gap-3 px-3">
                  <Trash2 className="w-4 h-4" />
                  Reset Game
                </span>
              </LiquidButton>
            ) : (
              <div className="flex gap-2">
                <LiquidButton tone="destructive" className="flex-1" onClick={handleReset}>
                  Confirm Reset
                </LiquidButton>
                <LiquidButton className="flex-1" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </LiquidButton>
              </div>
            )}
          </div>
        </div>
      </LiquidSection>

      {/* ─── Help ─── */}
      <LiquidSection title="Help">
        <div className="space-y-2">
          <LiquidButton
            onClick={() => {
              removeFlag('dynasty-welcome-shown');
              clearFlagsByPrefix('dynasty-hint-');
              infoToast('Tutorial Reset', 'The welcome tutorial and page hints will show again.');
            }}
          >
            <span className="flex items-center justify-start gap-3 px-3">
              <HelpCircle className="w-4 h-4" />
              Replay Tutorial
            </span>
          </LiquidButton>
          <LiquidButton onClick={() => setScreen('help')}>
            <span className="flex items-center justify-start gap-3 px-3">
              <BookOpen className="w-4 h-4" />
              Game Guide
            </span>
          </LiquidButton>
        </div>
      </LiquidSection>

      {/* ─── Purchases & Subscription ─── */}
      <LiquidSection>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Purchases</h3>
          {userIsPro && (
            <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Crown className="w-3 h-3" /> Pro
            </span>
          )}
        </div>

        {/* Active Subscription Info */}
        {hasActiveSub && monetization.subscription && (
          <div className="rounded-2xl p-3 mb-3 space-y-1 bg-white/5 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {PRODUCTS[monetization.subscription.productId]?.name || 'Dynasty Pro'}
              </span>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold capitalize border border-primary/30">
                {monetization.subscription.tier}
              </span>
            </div>
            {monetization.subscription.expiresAt && (
              <p className="text-[10px] text-muted-foreground">
                {monetization.subscription.willRenew ? 'Renews' : 'Expires'}:{' '}
                {new Date(monetization.subscription.expiresAt).toLocaleDateString()}
              </p>
            )}
            {monetization.subscription.isInGracePeriod && (
              <p className="text-[10px] text-amber-400">
                Payment issue detected. Please update your payment method.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {hasActiveSub && (
            <LiquidButton onClick={handleManageSubscription}>
              <span className="flex items-center justify-start gap-3 px-3">
                <ExternalLink className="w-4 h-4" />
                Manage Subscription
              </span>
            </LiquidButton>
          )}
          <LiquidButton onClick={handleRestorePurchases} disabled={restoringPurchases}>
            <span className="flex items-center justify-start gap-3 px-3">
              <RefreshCw className={cn('w-4 h-4', restoringPurchases && 'animate-spin')} />
              {restoringPurchases ? 'Restoring…' : 'Restore Purchases'}
            </span>
          </LiquidButton>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          Restore previously purchased items from your App Store or Play Store account.
        </p>
      </LiquidSection>

      {/* ─── Support & Feedback ─── */}
      <LiquidSection title="Support">
        <div className="space-y-2">
          <LiquidButton
            onClick={() => window.open('mailto:support@dynastymanager.com?subject=Dynasty%20Manager%20Support', '_blank')}
          >
            <span className="flex items-center justify-start gap-3 px-3">
              <Mail className="w-4 h-4" />
              Contact Support
            </span>
          </LiquidButton>
          <LiquidButton onClick={() => setFeedbackOpen(true)}>
            <span className="flex items-center justify-start gap-3 px-3">
              <MessageSquare className="w-4 h-4" />
              Send Feedback
            </span>
          </LiquidButton>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          Report a bug, request a feature, or get help with a purchase.
        </p>
      </LiquidSection>

      {/* ─── Legal ─── */}
      <LiquidSection title="Legal">
        <div className="space-y-2">
          <LiquidButton onClick={() => window.open('/privacy-policy.html', '_blank')}>
            <span className="flex items-center justify-start gap-3 px-3">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </span>
          </LiquidButton>
          <LiquidButton onClick={() => window.open('/terms-of-service.html', '_blank')}>
            <span className="flex items-center justify-start gap-3 px-3">
              <FileText className="w-4 h-4" />
              Terms of Service
            </span>
          </LiquidButton>
        </div>
      </LiquidSection>

      {/* ─── Data Management (destructive) ─── */}
      <LiquidSection title="Data Management" tone="danger">
        {!showDeleteDataConfirm ? (
          <LiquidButton
            tone="destructive"
            onClick={() => { setShowDeleteDataConfirm(true); setShowResetConfirm(false); setShowMenuConfirm(false); }}
          >
            <span className="flex items-center justify-start gap-3 px-3">
              <AlertTriangle className="w-4 h-4" />
              Delete All My Data
            </span>
          </LiquidButton>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl p-3 bg-destructive/10 border border-destructive/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.3)]">
              <p className="text-xs text-red-300 font-semibold mb-1">This cannot be undone</p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                This will permanently delete all save games, career history, Hall of Managers records, and preferences from this device.
              </p>
            </div>
            <div className="flex gap-2">
              <LiquidButton tone="destructive" className="flex-1" onClick={handleDeleteAllData}>
                Delete Everything
              </LiquidButton>
              <LiquidButton className="flex-1" onClick={() => setShowDeleteDataConfirm(false)}>
                Cancel
              </LiquidButton>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          Remove all game data stored on this device. Subscription status is managed by your App Store or Play Store account.
        </p>
      </LiquidSection>

      {/* ─── About ─── */}
      <div className="flex flex-col items-center gap-1.5 py-3">
        <img
          src="/logo.png"
          alt="Dynasty Manager"
          className="w-12 h-12 drop-shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
        />
        <p className="text-xs text-foreground/80 font-semibold tracking-wide">Dynasty Manager</p>
        <p className="text-[10px] text-muted-foreground">{APP_VERSION}</p>
      </div>

      {/* Feedback Sheet — matching liquid-glass treatment */}
      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent
          side="bottom"
          className={cn(
            'rounded-t-3xl border-0 p-5',
            'bg-gradient-to-b from-[hsl(222_35%_14%/0.92)] via-[hsl(222_28%_10%/0.95)] to-[hsl(222_40%_7%/0.98)]',
            'backdrop-blur-2xl backdrop-saturate-150',
            'shadow-[0_0_0_0.5px_rgba(255,255,255,0.14)_inset,inset_0_1px_0_rgba(255,255,255,0.25),0_-20px_60px_-20px_rgba(0,0,0,0.7)]',
          )}
        >
          <SheetHeader>
            <SheetTitle className="font-display tracking-tight">Send Feedback</SheetTitle>
          </SheetHeader>

          <div className="px-1 pb-6">
            {/* Category pills — glass segmented control */}
            <div className="flex gap-2 mt-4 p-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.28)]">
              {(['bug', 'feature', 'general'] as const).map(cat => {
                const active = feedbackCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFeedbackCategory(cat)}
                    className={cn(
                      'flex-1 py-2 rounded-full text-xs font-semibold transition-all',
                      active
                        ? 'bg-gradient-to-b from-primary/90 to-primary/70 text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.3),0_4px_12px_-4px_hsl(43_96%_46%/0.55)]'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {cat === 'bug' ? 'Bug Report' : cat === 'feature' ? 'Feature Request' : 'General'}
                  </button>
                );
              })}
            </div>

            {/* Message textarea */}
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Tell us what's on your mind…"
              className="w-full mt-4 p-3 rounded-2xl bg-white/5 border border-white/15 backdrop-blur-md text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.3)]"
              rows={4}
            />

            {/* Send button */}
            <div className="mt-4">
              <LiquidButton
                tone="primary"
                onClick={handleSendFeedback}
                disabled={!feedbackMessage.trim()}
              >
                Send Feedback
              </LiquidButton>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SettingsPage;
