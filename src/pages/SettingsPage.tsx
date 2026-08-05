import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SaveStatusIndicator } from '@/components/game/SaveStatusIndicator';
import { Save, Download, Trash2, Zap, Eye, RotateCcw, HelpCircle, Crown, RefreshCw, ExternalLink, Mail, MessageSquare, Vibrate, FileText, Shield, ShieldAlert, Home, AlertTriangle, Lightbulb, ShieldCheck, MonitorSmartphone, BookOpen, Users, Bug, ChartBar, Sparkles, Gauge, Bell, Clapperboard, Volume2, Share2, Upload, Newspaper } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { infoToast, successToast, errorToast } from '@/utils/gameToast';
import { hapticMedium } from '@/utils/haptics';
import { formatMoney } from '@/utils/helpers';
import {
  removeFlag,
  clearFlagsByPrefix,
  deleteAllDynastyData,
  readCommunityPackSlotPref,
  writeCommunityPackSlotPref,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  readNotificationsEnabled,
  writeNotificationsEnabled,
  STORAGE_KEYS,
} from '@/store/helpers/persistence';
import { getNotificationPermission, requestNotificationPermission, scheduleEngagementReminders, cancelAllEngagementReminders } from '@/utils/notifications';
import { restorePurchases, openSubscriptionManagement, getCustomerInfo, extractSubscriptionInfo } from '@/utils/purchases';
import { triggerTestError } from '@/utils/sentry';
import { refreshAnalyticsConsent, track } from '@/utils/analytics';
import { exportSlotJson, importJsonToSlot } from '@/utils/saveBackup';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { PRODUCTS } from '@/config/monetization';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { openExternalUrl } from '@/utils/externalUrl';
import { SAVE_CONFIRMATION_MS } from '@/config/ui';
import { MATCH_SPEEDS } from '@/config/matchSpeed';
import { hasUnseenWhatsNew, LATEST_RELEASE } from '@/data/whatsNew';
import { CAPTURE_SCENARIOS } from '@/config/captureScenarios';

const APP_VERSION = `v${__APP_VERSION__} · Football Edition`;

// Dev-tools gate. `import.meta.env.DEV` is false in TestFlight/App Store
// (production) builds, so also honour a VITE_DEV_TOOLS build flag — set it in
// the iOS TestFlight workflow (`dev_tools` input) to ship a testing build with
// the Developer section, and leave it unset for real releases.
const DEV_TOOLS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true';

/** Section wrapper — thin adapter that adds the settings-standard padding +
 *  title around the shared GlassPanel primitive. Every section on this page
 *  uses the same liquid-glass surface via GlassPanel; this helper just keeps
 *  the section title styling DRY. */
function SettingsSection({ title, children, tone = 'default' }: {
  title?: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <GlassPanel className="p-4" tone={tone}>
      {title && (
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">{title}</h3>
      )}
      {children}
    </GlassPanel>
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
            // `left-0` anchors the knob at the track's inner-left edge.
            // Without it, buttons' default `text-align: center` lands the
            // knob's static x-position in the middle of the track, and the
            // translate then pushes it past the right rim on the ON state.
            'absolute left-0 top-[2px] w-[18px] h-[18px] rounded-full transition-transform',
            'bg-gradient-to-b from-white to-white/80',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_4px_-1px_rgba(0,0,0,0.35)]',
            value ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  );
}

export type SettingsVariant = 'title' | 'in-game';

const SettingsBodyInner = ({ variant }: { variant: SettingsVariant }) => {
  const { t } = useTranslation();
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
  const resetEntitlementsForTesting = useGameStore(s => s.resetEntitlementsForTesting);
  const startCaptureScenario = useGameStore(s => s.startCaptureScenario);
  const gameStarted = useGameStore(s => s.gameStarted);
  const navigate = useNavigate();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingCaptureId, setPendingCaptureId] = useState<string | null>(null);
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

  // Device-global notification opt-in (not save-scoped). Toggling on requests
  // OS permission; if the user denies it, the toggle snaps back off.
  const [notificationsOn, setNotificationsOn] = useState<boolean>(() => readNotificationsEnabled() === true);
  const handleToggleNotifications = async () => {
    if (notificationsOn) {
      writeNotificationsEnabled(false);
      setNotificationsOn(false);
      await cancelAllEngagementReminders();
      track('reminders_disabled', {});
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      writeNotificationsEnabled(false);
      setNotificationsOn(false);
      errorToast('Notifications off', 'Enable notifications for Dynasty Manager in your device Settings to get reminders.');
      return;
    }
    writeNotificationsEnabled(true);
    setNotificationsOn(true);
    await scheduleEngagementReminders();
    track('reminders_enabled', {});
    successToast('Reminders on', 'We\'ll nudge you about your streak and live events.');
  };

  // Reconcile our opt-in with the OS permission on mount: if the user enabled
  // reminders but later revoked permission in the device settings, flip the
  // toggle back off so it reflects reality. 'unsupported' (web/dev) is left
  // untouched — only a real OS denial reconciles.
  useEffect(() => {
    if (readNotificationsEnabled() !== true) return;
    let cancelled = false;
    void getNotificationPermission().then(perm => {
      if (!cancelled && (perm === 'denied' || perm === 'prompt')) {
        writeNotificationsEnabled(false);
        setNotificationsOn(false);
      }
    });
    return () => { cancelled = true; };
  }, []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'general'>('general');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const redeemCode = useGameStore(s => s.redeemCode);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const handleRedeem = async () => {
    const code = redeemInput.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    try {
      const r = await redeemCode(code);
      if (r.ok) {
        hapticMedium();
        const label = r.rewardType === 'money' ? formatMoney(r.amount ?? 0) : `${r.amount} XP`;
        successToast('Code Redeemed', `Added ${label} to your game.`);
        setRedeemInput('');
      } else if (r.reason === 'already-used') {
        errorToast('Already Used', 'This code has already been redeemed on this device.');
      } else if (r.reason === 'no-game') {
        errorToast('No Active Game', 'Start or load a game before redeeming a code.');
      } else {
        errorToast('Invalid Code', 'That code isn\'t valid. Check it and try again.');
      }
    } finally {
      setRedeeming(false);
    }
  };
  // iOS keyboard height — used to lift the bottom sheet so the textarea
  // and Send button stay visible above the on-screen keyboard.
  const keyboardInset = useKeyboardInset();
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Analytics consent — device-level pref, lives outside the save. Seed from
  // localStorage; toggling writes back immediately.
  const [analyticsGranted, setAnalyticsGranted] = useState(() => readAnalyticsConsent() === 'granted');
  const userIsPro = isPro(monetization);
  const hasActiveSub = isSubscriptionActive(monetization);

  const handleRestorePurchases = async () => {
    setRestoringPurchases(true);
    try {
      const granted = await restorePurchases();
      if (granted.length > 0) restoreEntitlements(granted);

      // Sync the subscription BEFORE deciding what to tell the user.
      // `mapEntitlements` deliberately excludes subscription SKUs (they'd
      // outlive the sub in `entitlements`), so a monthly/annual customer's
      // restore legitimately returns `[]` — their Pro is recoverable only
      // through extractSubscriptionInfo. Toasting off `granted.length` alone
      // told every subscription-only customer "No Purchases Found" moments
      // before their sub was actually restored. This is the primary Restore
      // entry point for existing users, and the one App Review exercises.
      // SubscribeOnboarding already got this treatment; Settings never did.
      // Only write a confirmed, non-null sub so a transient/empty customerInfo
      // can't clear an active subscription.
      const info = await getCustomerInfo();
      const sub = extractSubscriptionInfo(info);
      if (sub) updateSubscription(sub);

      const proActive = isPro(useGameStore.getState().monetization);
      if (granted.length > 0) {
        successToast('Purchases Restored', `${granted.length} product${granted.length > 1 ? 's' : ''} restored.`);
      } else if (proActive) {
        successToast('Purchases Restored', 'Your Pro subscription is active.');
      } else {
        infoToast('No Purchases Found', 'No previous purchases were found for this account.');
      }
    } catch {
      errorToast('Restore Failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoringPurchases(false);
    }
  };

  // Dev-tools only: clear local Pro state and jump straight to the paywall so
  // the subscribe/restore flow can be re-exercised on device. Store-owned
  // products re-restore on the next launch, so this is non-destructive.
  const handleResetProForTesting = () => {
    resetEntitlementsForTesting();
    successToast('Pro reset (testing)', 'Local entitlements cleared. Owned products re-restore on next app launch.');
    navigate('/subscribe', { state: { returnTo: variant === 'in-game' ? '/game' : '/' } });
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

  // ── Back up & restore ──
  const importFileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  // Holds a chosen file's contents awaiting an explicit overwrite confirm.
  const [pendingImportText, setPendingImportText] = useState<string | null>(null);

  const handleExportSave = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Flush any queued autosave first so the exported bytes are current.
      flushSave();
      const res = await exportSlotJson(activeSlot);
      if (res.ok) {
        track('save_exported', { slot: activeSlot, method: res.method });
        hapticMedium();
        if (res.method === 'clipboard') {
          successToast('Backup Copied', 'Your save JSON is on the clipboard — paste it into Notes or a file to keep it safe.');
        } else {
          successToast('Backup Ready', 'Your save has been exported. Keep the file somewhere safe.');
        }
      } else if (res.error === 'no-save') {
        errorToast('Nothing to Export', 'There is no save in this slot yet.');
      } else if (res.error === 'cancelled') {
        // User dismissed the share sheet — no toast.
      } else {
        errorToast('Export Failed', 'Could not export your save on this device.');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so choosing the same file again re-fires onChange.
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setPendingImportText(text);
    } catch {
      errorToast('Import Failed', 'Could not read that file. Try exporting a fresh backup.');
    }
  };

  const handleConfirmImport = () => {
    if (pendingImportText === null) return;
    const res = importJsonToSlot(activeSlot, pendingImportText);
    setPendingImportText(null);
    if (!res.ok) {
      errorToast('Import Failed', res.message);
      return;
    }
    track('save_imported', { slot: activeSlot });
    // Reload the slot through the normal load path so the in-memory game
    // state swaps to the imported save.
    if (loadGame(activeSlot)) {
      hapticMedium();
      successToast('Save Imported', 'Your backup has been restored into this slot.');
    } else {
      errorToast('Import Failed', 'The save was written but could not be loaded. Try again.');
    }
  };

  const handleSendFeedback = () => {
    const categoryLabels = { bug: 'Bug Report', feature: 'Feature Request', general: 'General Feedback' };
    const subject = encodeURIComponent(`[${categoryLabels[feedbackCategory]}] Dynasty Manager Feedback`);
    const body = encodeURIComponent(feedbackMessage.trim());
    void openExternalUrl(`mailto:support@dynastymanager.com?subject=${subject}&body=${body}`);
    successToast('Thank You!', 'Your email client has been opened with your feedback.');
    setFeedbackMessage('');
    setFeedbackCategory('general');
    setFeedbackOpen(false);
  };

  const handleReturnToMenu = () => {
    hapticMedium();
    flushSave();
    navigate('/');
  };

  const handleReset = () => {
    hapticMedium();
    resetGame();
    setShowResetConfirm(false);
  };

  const handleDeleteAllData = () => {
    hapticMedium();
    deleteAllDynastyData();
    // deleteAllDynastyData wipes the 'dynasty-' localStorage keys (incl. the
    // notification opt-in), but scheduled OS reminders live outside the web
    // storage — cancel them too so a "claim your streak" notification can't
    // fire after the player has erased everything.
    void cancelAllEngagementReminders();
    setShowDeleteDataConfirm(false);
    navigate('/');
    setTimeout(() => {
      successToast('Data Deleted', 'All game data has been permanently removed from this device.');
    }, 100);
  };

  return (
    <div className={cn(variant === 'in-game' ? 'max-w-lg mx-auto px-4 py-4' : '', 'space-y-3')}>
      {variant === 'in-game' && (
        <h2 className="text-lg font-display font-bold text-foreground tracking-tight">Settings</h2>
      )}

      {/* ─── Gameplay ─── */}
      <SettingsSection title={t('settings.gameplay')}>
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
                    onClick={() => {
                      if (locked) {
                        if (variant === 'in-game') setScreen('shop');
                        else navigate('/subscribe', { state: { returnTo: '/' } });
                        return;
                      }
                      updateSettings({ matchSpeed: s.value });
                    }}
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
            label={t('settingsPage.confirmAllOffers')}
            description={t('settingsPage.askBeforeAcceptingAnyTransfer')}
            value={settings.confirmAllOffers}
            onChange={() => updateSettings({ confirmAllOffers: !settings.confirmAllOffers })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Newspaper}
            label={t('settingsPage.onlyInterruptForImportantWeeks')}
            description={t('settingsPage.showTheWeeklySummaryAs')}
            value={settings.digestOnlyWhenSignificant !== false}
            onChange={() => updateSettings({ digestOnlyWhenSignificant: settings.digestOnlyWhenSignificant === false })}
          />
        </div>
      </SettingsSection>

      {/* ─── Community Pack ─── (in-game only — depends on activeSlot) */}
      {variant === 'in-game' && (
      <SettingsSection title={t('settings.communityPack')}>
        <ToggleRow
          icon={Users}
          label={t('settingsPage.useRealPlayersCommunityPack')}
          description={t('settingsPage.realWorldSquadsRotatingTransfer')}
          value={communityPackPref}
          onChange={() => {
            const next = !communityPackPref;
            setCommunityPackPref(next);
            writeCommunityPackSlotPref(activeSlot, next);
            track(next ? 'community_pack_enabled' : 'community_pack_disabled', {});
          }}
        />

        {/* Attribution card — matches CommunityPackPopup treatment so the
            disclaimer is identical everywhere the feature is surfaced. */}
        <div className="mt-3 rounded-xl p-3 bg-amber-500/[0.08] border border-amber-400/30 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.25)]">
          <div className="flex gap-2.5">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-300 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                Community-sourced — not our data
              </p>
              <p className="text-[10px] leading-snug text-amber-100/85">
                Player data is community-sourced. Dynasty Manager didn't create
                the real-player pool; it's a community-compiled dataset loaded
                offline on your device. This app is <strong>not affiliated with
                or endorsed by</strong> any football league, club, player, or
                governing body. All names, ratings, and likenesses belong to
                their respective rights holders.
              </p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/70 leading-snug mt-3">
          Changing this applies to new games only — existing saves keep the setting they were started with.
        </p>
      </SettingsSection>
      )}

      {/* ─── Display & Accessibility ─── */}
      <SettingsSection title={t('settings.display')}>
        <div className="space-y-4">
          <ToggleRow
            icon={Eye}
            label={t('settingsPage.showOvrOnPitch')}
            description={t('settingsPage.displayPlayerRatingsOnThe')}
            value={settings.showOverallOnPitch}
            onChange={() => updateSettings({ showOverallOnPitch: !settings.showOverallOnPitch })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Lightbulb}
            label={t('settingsPage.pageHints')}
            description={t('settingsPage.showTipsWhenVisitingPages')}
            value={!settings.hidePageHints}
            onChange={() => updateSettings({ hidePageHints: !settings.hidePageHints })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Lightbulb}
            label={t('settingsPage.newCareerWalkthrough')}
            description={t('settingsPage.showTheGettingStartedChecklist')}
            value={!settings.hideOnboarding}
            onChange={() => updateSettings({ hideOnboarding: !settings.hideOnboarding })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={MonitorSmartphone}
            label={t('settingsPage.reducedMotion')}
            description={t('settingsPage.minimizeAnimationsThroughoutTheApp')}
            value={settings.reducedMotion}
            onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Gauge}
            label={t('settingsPage.performanceMode')}
            description={t('settingsPage.smootherOnOlderDevicesUses')}
            value={!!settings.performanceMode}
            onChange={() => updateSettings({ performanceMode: !settings.performanceMode })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Vibrate}
            label={t('settingsPage.hapticFeedback')}
            description={t('settingsPage.vibrateOnKeyActionsMobile')}
            value={settings.hapticsEnabled !== false}
            onChange={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
          />
          <ToggleRow
            icon={Volume2}
            label={t('settingsPage.soundEffects')}
            description={t('settingsPage.crowdWhistlesGoalsPacksAnd')}
            value={settings.soundEnabled !== false}
            onChange={() => updateSettings({ soundEnabled: settings.soundEnabled === false })}
          />

          <div className="border-t border-white/10" />

          <ToggleRow
            icon={Bell}
            label={t('settingsPage.reminders')}
            description={t('settingsPage.notifyMeAboutMyDaily')}
            value={notificationsOn}
            onChange={() => { void handleToggleNotifications(); }}
          />
        </div>
      </SettingsSection>

      {/* ─── Data ─── */}
      <SettingsSection title={t('settings.data')}>
        <div className="space-y-3">
          {variant === 'in-game' && (
            <>
              <SaveStatusIndicator />
              <div className="border-t border-white/10" />
            </>
          )}

          <ToggleRow
            icon={RotateCcw}
            label={t('settingsPage.autoSave')}
            description={t('settingsPage.automaticallySaveAfterEachWeek')}
            value={settings.autoSave}
            onChange={() => updateSettings({ autoSave: !settings.autoSave })}
          />

          {variant === 'in-game' && (
          <>
          <div className="border-t border-white/10" />

          <div className="space-y-2">
            <LiquidButton onClick={handleSave}>
              <span className="flex items-center justify-start gap-3 px-3">
                <Save className="w-4 h-4" />
                {saved ? 'Game Saved!' : 'Save Game'}
              </span>
            </LiquidButton>
            <LiquidButton
              onClick={() => {
                // loadGame() returns false on a missing/corrupt slot — a
                // silent failure here looked like the button did nothing.
                if (!loadGame()) {
                  errorToast('Load Failed', 'No save found in this slot, or the save could not be read.');
                }
              }}
            >
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
          </>
          )}
        </div>
      </SettingsSection>

      {/* ─── Back up & restore ─── (in-game only — operates on the active slot) */}
      {variant === 'in-game' && (
      <SettingsSection title={t('settings.backupRestore')}>
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Save a copy of this career to a file you control, or restore one on a
            new device. Importing overwrites the current slot — export first if
            you want to keep it.
          </p>
          <div className="space-y-2">
            <LiquidButton onClick={handleExportSave} disabled={exporting}>
              <span className="flex items-center justify-start gap-3 px-3">
                <Share2 className="w-4 h-4" />
                {exporting ? 'Exporting…' : 'Export Save'}
              </span>
            </LiquidButton>
            {pendingImportText === null ? (
              <LiquidButton onClick={() => importFileRef.current?.click()}>
                <span className="flex items-center justify-start gap-3 px-3">
                  <Upload className="w-4 h-4" />
                  Import Save
                </span>
              </LiquidButton>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-400/90 leading-snug flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  This replaces the save in slot {activeSlot}. This can't be undone.
                </p>
                <div className="flex gap-2">
                  <LiquidButton tone="destructive" className="flex-1" onClick={handleConfirmImport}>
                    Overwrite &amp; Import
                  </LiquidButton>
                  <LiquidButton className="flex-1" onClick={() => setPendingImportText(null)}>
                    Cancel
                  </LiquidButton>
                </div>
              </div>
            )}
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFileChosen}
            />
          </div>
        </div>
      </SettingsSection>
      )}

      {/* ─── Help ─── */}
      <SettingsSection title={t('settings.help')}>
        <div className="space-y-2">
          <LiquidButton
            onClick={() => {
              removeFlag(STORAGE_KEYS.WELCOME_SHOWN);
              clearFlagsByPrefix(STORAGE_KEYS.HINT_PREFIX);
              infoToast('Tutorial Reset', 'The welcome tutorial and page hints will show again.');
            }}
          >
            <span className="flex items-center justify-start gap-3 px-3">
              <HelpCircle className="w-4 h-4" />
              Replay Tutorial
            </span>
          </LiquidButton>
          {variant === 'in-game' && (
            <LiquidButton onClick={() => setScreen('help')}>
              <span className="flex items-center justify-start gap-3 px-3">
                <BookOpen className="w-4 h-4" />
                Game Guide
              </span>
            </LiquidButton>
          )}
          <LiquidButton onClick={() => variant === 'in-game' ? setScreen('whats-new') : navigate('/whats-new')}>
            <span className="flex items-center justify-start gap-3 px-3 w-full">
              <Sparkles className="w-4 h-4" />
              <span className="flex-1 text-left">What&apos;s New</span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium tabular-nums">
                <span>v{LATEST_RELEASE.version}</span>
                {hasUnseenWhatsNew() && (
                  <span
                    aria-label={t('settings.unreadUpdate')}
                    className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-background/90 animate-pulse"
                  />
                )}
              </span>
            </span>
          </LiquidButton>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.redeemCode')}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleRedeem(); }}
            placeholder={t('settings.enterCode')}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t('settings.redeemCodeAria')}
            className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-primary/40 backdrop-blur-md"
          />
          <LiquidButton tone="primary" className="shrink-0 w-auto px-5" onClick={() => void handleRedeem()} disabled={redeeming || !redeemInput.trim()}>
            {redeeming ? 'Redeeming…' : 'Redeem'}
          </LiquidButton>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 px-1">
          Got a code? Redeem it for in-game rewards. Each code works once per device.
        </p>
      </SettingsSection>

      {/* ─── Purchases & Subscription ─── */}
      <SettingsSection>
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
      </SettingsSection>

      {/* ─── Support & Feedback ─── */}
      <SettingsSection title={t('settings.support')}>
        <div className="space-y-2">
          <LiquidButton
            onClick={() => { void openExternalUrl('mailto:support@dynastymanager.com?subject=Dynasty%20Manager%20Support'); }}
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
      </SettingsSection>

      {/* ─── Legal ─── */}
      <SettingsSection title={t('settings.legal')}>
        <div className="space-y-2">
          <LiquidButton onClick={() => { void openExternalUrl(PRIVACY_URL); }}>
            <span className="flex items-center justify-start gap-3 px-3">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </span>
          </LiquidButton>
          <LiquidButton onClick={() => { void openExternalUrl(TERMS_URL); }}>
            <span className="flex items-center justify-start gap-3 px-3">
              <FileText className="w-4 h-4" />
              Terms of Service
            </span>
          </LiquidButton>
        </div>
      </SettingsSection>

      {/* ─── Privacy ─── */}
      <SettingsSection title={t('settings.privacy')}>
        <ToggleRow
          icon={ChartBar}
          label={t('settingsPage.shareAnonymousUsageStats')}
          description={t('settingsPage.helpImproveTheGameWe')}
          value={analyticsGranted}
          onChange={() => {
            const next = !analyticsGranted;
            setAnalyticsGranted(next);
            writeAnalyticsConsent(next ? 'granted' : 'denied');
            refreshAnalyticsConsent();
          }}
        />
      </SettingsSection>

      {/* ─── Data Management (destructive) ─── */}
      <SettingsSection title={t('settings.dataManagement')} tone="danger">
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
      </SettingsSection>

      {/* ─── Capture Studio (marketing footage) ─── */}
      <SettingsSection title={t('settings.captureStudio')}>
        <p className="text-[10px] text-muted-foreground leading-snug mb-3">
          Staged World Cup finals for screen-recording promo videos. Each scenario
          runs as a throwaway session — nothing in it is ever saved, and your
          saved games stay exactly as they are on disk.
          {gameStarted && ' Your current session will close — with auto-save OFF, anything since your last manual save is lost, so save first if you need it. Reload from the main menu afterwards.'}
        </p>
        <div className="space-y-2">
          {CAPTURE_SCENARIOS.map(sc => (
            pendingCaptureId === sc.id ? (
              <div key={sc.id} className="rounded-2xl p-3 bg-primary/10 border border-primary/30 backdrop-blur-md space-y-2">
                <p className="text-xs font-semibold text-foreground">{sc.title}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{sc.tagline}</p>
                <div className="flex gap-2">
                  <LiquidButton className="flex-1" onClick={() => {
                    const ok = startCaptureScenario(sc);
                    if (!ok) { errorToast('Scenario unavailable'); return; }
                    hapticMedium();
                    setPendingCaptureId(null);
                    if (variant === 'title') navigate('/game');
                  }}>
                    Start scenario
                  </LiquidButton>
                  <LiquidButton className="flex-1" onClick={() => setPendingCaptureId(null)}>
                    Cancel
                  </LiquidButton>
                </div>
              </div>
            ) : (
              <LiquidButton key={sc.id} onClick={() => setPendingCaptureId(sc.id)}>
                <span className="flex items-center justify-start gap-3 px-3 py-0.5 text-left">
                  <Clapperboard className="w-4 h-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm leading-tight">{sc.title}</span>
                    <span className="block text-[10px] text-muted-foreground leading-snug font-normal">{sc.tagline}</span>
                  </span>
                </span>
              </LiquidButton>
            )
          ))}
        </div>
      </SettingsSection>

      {/* ─── Developer (dev + dev-tools builds only) ─── */}
      {DEV_TOOLS_ENABLED && (
        <SettingsSection title={t('settings.developer')}>
          <LiquidButton tone="amber" onClick={handleResetProForTesting}>
            <span className="flex items-center justify-start gap-3 px-3">
              <RotateCcw className="w-4 h-4" />
              Reset Pro &amp; open paywall
            </span>
          </LiquidButton>
          <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
            Clears local Pro/entitlement state and opens the subscribe screen so
            the purchase &amp; restore flow can be re-tested. Non-destructive —
            store-owned products re-restore on the next app launch.
          </p>
          <div className="mt-3">
            <LiquidButton tone="amber" onClick={triggerTestError}>
              <span className="flex items-center justify-start gap-3 px-3">
                <Bug className="w-4 h-4" />
                Throw test error (Sentry)
              </span>
            </LiquidButton>
            <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
              Fires an uncaught error to verify the crash-reporting pipeline.
            </p>
          </div>
        </SettingsSection>
      )}

      {/* ─── About ─── */}
      <div className="flex flex-col items-center gap-1.5 py-3">
        <img
          src="/logo.webp"
          alt="Dynasty Manager"
          className="w-12 h-12 drop-shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
        />
        <p className="text-xs text-foreground/80 font-semibold tracking-wide">Dynasty Manager</p>
        <p className="text-[10px] text-muted-foreground">{APP_VERSION}</p>
      </div>

      {/* Feedback Sheet — matching liquid-glass treatment.
          `paddingBottom` adapts to the on-screen keyboard height so the
          textarea and Send button stay above the keyboard on iOS, where
          Capacitor's `resize: 'body'` keyboard mode leaves
          `position: fixed` overlays anchored at the viewport bottom.
          The `bottom` offset works in tandem so the sheet animates
          smoothly into place. */}
      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent
          side="bottom"
          style={{
            paddingBottom: keyboardInset > 0 ? keyboardInset + 24 : undefined,
            transition: 'padding-bottom 180ms ease-out',
          }}
          className={cn(
            'rounded-t-3xl border-0 p-5',
            'bg-gradient-to-b from-[hsl(222_35%_14%/0.92)] via-[hsl(222_28%_10%/0.95)] to-[hsl(222_40%_7%/0.98)]',
            'backdrop-blur-2xl backdrop-saturate-150',
            'shadow-[0_0_0_0.5px_rgba(255,255,255,0.14)_inset,inset_0_1px_0_rgba(255,255,255,0.25),0_-20px_60px_-20px_rgba(0,0,0,0.7)]',
            'max-h-[88vh] overflow-y-auto',
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
              ref={feedbackTextareaRef}
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              onFocus={() => {
                // Once the keyboard finishes opening (~250ms), pull the
                // textarea into view. Belt-and-braces alongside the
                // sheet-level padding fix — covers the case where the user
                // has typed enough text that the caret is below the fold.
                setTimeout(() => {
                  feedbackTextareaRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }, 280);
              }}
              placeholder={t('settings.feedbackPlaceholder')}
              aria-label={t('settings.feedbackAria')}
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

// Scoped ErrorBoundary so a save/load failure in this page (manual save,
// import/export, slot operations) renders a friendly fallback with telemetry
// tagged `settings`, instead of bombing the surrounding game shell.
const SettingsPage = () => (
  <ErrorBoundary scope="settings"><SettingsBodyInner variant="in-game" /></ErrorBoundary>
);

// Shared settings body — used by the in-game SettingsPage and the TitleScreen
// settings sheet so both surfaces stay in sync. The `variant` prop hides the
// in-game-only sections (Save/Load/Main Menu/Reset, Community Pack, Game Guide,
// SaveStatusIndicator) and routes match-speed-lock + What's New through the
// right navigation for each surface.
export const SettingsBody = ({ variant = 'in-game' }: { variant?: SettingsVariant } = {}) => (
  <ErrorBoundary scope="settings"><SettingsBodyInner variant={variant} /></ErrorBoundary>
);

export default SettingsPage;
