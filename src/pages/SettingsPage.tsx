import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Save, Download, Trash2, Zap, Eye, RotateCcw, HelpCircle, Crown, RefreshCw, ExternalLink, Mail, MessageSquare, Vibrate, FileText, Shield, Home, AlertTriangle, Lightbulb, ShieldCheck, MonitorSmartphone, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { infoToast, successToast, errorToast } from '@/utils/gameToast';
import { removeFlag, clearFlagsByPrefix, deleteAllDynastyData } from '@/store/helpers/persistence';
import { restorePurchases, openSubscriptionManagement, getCustomerInfo, extractSubscriptionInfo } from '@/utils/purchases';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { PRODUCTS } from '@/config/monetization';
import { SAVE_CONFIRMATION_MS } from '@/config/ui';
import { MATCH_SPEEDS } from '@/config/matchSpeed';

const APP_VERSION = 'v1.0.0 · Football Edition';

/** Reusable toggle row with label, description, and switch */
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
        onClick={onChange}
        className={cn(
          'w-10 h-6 rounded-full transition-colors relative shrink-0',
          value ? 'bg-primary' : 'bg-muted/50'
        )}
      >
        <div className={cn(
          'w-4 h-4 bg-white rounded-full absolute top-1 transition-transform',
          value ? 'translate-x-5' : 'translate-x-1'
        )} />
      </button>
    </div>
  );
}

const SettingsPage = () => {
  const settings = useGameStore(s => s.settings);
  const monetization = useGameStore(s => s.monetization);
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
      <h2 className="text-lg font-display font-bold text-foreground">Settings</h2>

      {/* ─── Gameplay ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Gameplay</h3>
        <div className="space-y-4">
          {/* Match Speed */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">Match Speed</p>
                <p className="text-[10px] text-muted-foreground">How fast match events play out</p>
              </div>
            </div>
            <div className="flex bg-muted/20 rounded-lg border border-border/30 p-0.5">
              {MATCH_SPEEDS.map(s => {
                const locked = s.pro && !userIsPro;
                return (
                  <button
                    key={s.value}
                    onClick={() => locked ? setScreen('shop') : updateSettings({ matchSpeed: s.value })}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-0.5 py-2.5 rounded-md text-xs font-semibold transition-all',
                      locked
                        ? 'text-muted-foreground/40 cursor-default'
                        : settings.matchSpeed === s.value
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {locked && <Crown className="w-2.5 h-2.5" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/20" />

          <ToggleRow
            icon={ShieldCheck}
            label="Confirm all offers"
            description="Ask before accepting any transfer offer"
            value={settings.confirmAllOffers}
            onChange={() => updateSettings({ confirmAllOffers: !settings.confirmAllOffers })}
          />
        </div>
      </GlassPanel>

      {/* ─── Display & Accessibility ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Display & Accessibility</h3>
        <div className="space-y-4">
          <ToggleRow
            icon={Eye}
            label="Show OVR on pitch"
            description="Display player ratings on the pitch view"
            value={settings.showOverallOnPitch}
            onChange={() => updateSettings({ showOverallOnPitch: !settings.showOverallOnPitch })}
          />

          <div className="border-t border-border/20" />

          <ToggleRow
            icon={Lightbulb}
            label="Page hints"
            description="Show tips when visiting pages for the first time"
            value={!settings.hidePageHints}
            onChange={() => updateSettings({ hidePageHints: !settings.hidePageHints })}
          />

          <div className="border-t border-border/20" />

          <ToggleRow
            icon={MonitorSmartphone}
            label="Reduced motion"
            description="Minimize animations throughout the app"
            value={settings.reducedMotion}
            onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
          />

          <div className="border-t border-border/20" />

          <ToggleRow
            icon={Vibrate}
            label="Haptic feedback"
            description="Vibrate on key actions (mobile only)"
            value={settings.hapticsEnabled !== false}
            onChange={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
          />
        </div>
      </GlassPanel>

      {/* ─── Data ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Data</h3>
        <div className="space-y-3">
          <ToggleRow
            icon={RotateCcw}
            label="Auto-save"
            description="Automatically save after each week"
            value={settings.autoSave}
            onChange={() => updateSettings({ autoSave: !settings.autoSave })}
          />

          <div className="border-t border-border/20" />

          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 h-11"
              onClick={handleSave}
            >
              <Save className="w-4 h-4" />
              {saved ? 'Game Saved!' : 'Save Game'}
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 h-11"
              onClick={() => loadGame()}
            >
              <Download className="w-4 h-4" />
              Load Game
            </Button>
            {!showMenuConfirm ? (
              <Button
                variant="secondary"
                className="w-full justify-start gap-3 h-11 text-amber-400 hover:text-amber-400 hover:bg-amber-400/10"
                onClick={() => { setShowMenuConfirm(true); setShowResetConfirm(false); }}
              >
                <Home className="w-4 h-4" />
                Main Menu
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-11"
                  onClick={handleReturnToMenu}
                >
                  Save & Exit
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 h-11"
                  onClick={() => setShowMenuConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
            {!showResetConfirm ? (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setShowResetConfirm(true); setShowMenuConfirm(false); }}
              >
                <Trash2 className="w-4 h-4" />
                Reset Game
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1 h-11"
                  onClick={handleReset}
                >
                  Confirm Reset
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 h-11"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* ─── Help ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Help</h3>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={() => {
              removeFlag('dynasty-welcome-shown');
              clearFlagsByPrefix('dynasty-hint-');
              infoToast('Tutorial Reset', 'The welcome tutorial and page hints will show again.');
            }}
          >
            <HelpCircle className="w-4 h-4" />
            Replay Tutorial
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={() => setScreen('help')}
          >
            <BookOpen className="w-4 h-4" />
            Game Guide
          </Button>
        </div>
      </GlassPanel>

      {/* ─── Purchases & Subscription ─── */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Purchases</h3>
          {userIsPro && (
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Crown className="w-3 h-3" /> Pro
            </span>
          )}
        </div>

        {/* Active Subscription Info */}
        {hasActiveSub && monetization.subscription && (
          <div className="bg-muted/20 rounded-lg p-3 mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {PRODUCTS[monetization.subscription.productId]?.name || 'Dynasty Pro'}
              </span>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold capitalize">
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
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 h-11"
              onClick={handleManageSubscription}
            >
              <ExternalLink className="w-4 h-4" />
              Manage Subscription
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={handleRestorePurchases}
            disabled={restoringPurchases}
          >
            <RefreshCw className={cn('w-4 h-4', restoringPurchases && 'animate-spin')} />
            {restoringPurchases ? 'Restoring...' : 'Restore Purchases'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Restore previously purchased items from your App Store or Play Store account.
        </p>
      </GlassPanel>

      {/* ─── Support & Feedback ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Support</h3>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={() => window.open('mailto:support@dynastymanager.com?subject=Dynasty%20Manager%20Support', '_blank')}
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={() => setFeedbackOpen(true)}
          >
            <MessageSquare className="w-4 h-4" />
            Send Feedback
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Report a bug, request a feature, or get help with a purchase.
        </p>
      </GlassPanel>

      {/* ─── Legal ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Legal</h3>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={() => window.open('/privacy-policy.html', '_blank')}
          >
            <Shield className="w-4 h-4" />
            Privacy Policy
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-11"
            onClick={() => window.open('/terms-of-service.html', '_blank')}
          >
            <FileText className="w-4 h-4" />
            Terms of Service
          </Button>
        </div>
      </GlassPanel>

      {/* ─── Data Management (destructive) ─── */}
      <GlassPanel className="p-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Data Management</h3>
        {!showDeleteDataConfirm ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => { setShowDeleteDataConfirm(true); setShowResetConfirm(false); setShowMenuConfirm(false); }}
          >
            <AlertTriangle className="w-4 h-4" />
            Delete All My Data
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-xs text-destructive font-semibold mb-1">This cannot be undone</p>
              <p className="text-[10px] text-muted-foreground">
                This will permanently delete all save games, career history, Hall of Managers records, and preferences from this device.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1 h-11"
                onClick={handleDeleteAllData}
              >
                Delete Everything
              </Button>
              <Button
                variant="secondary"
                className="flex-1 h-11"
                onClick={() => setShowDeleteDataConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Remove all game data stored on this device. Subscription status is managed by your App Store or Play Store account.
        </p>
      </GlassPanel>

      {/* ─── About ─── */}
      <div className="flex flex-col items-center gap-1.5 py-2">
        <img
          src="/logo.png"
          alt="Dynasty Manager"
          className="w-12 h-12 drop-shadow-[0_0_10px_hsl(var(--primary)/0.3)]"
        />
        <p className="text-xs text-muted-foreground font-semibold">Dynasty Manager</p>
        <p className="text-[10px] text-muted-foreground">{APP_VERSION}</p>
      </div>

      {/* Feedback Sheet */}
      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Send Feedback</SheetTitle>
          </SheetHeader>

          <div className="px-1 pb-6">
            {/* Category pills */}
            <div className="flex gap-2 mt-4">
              {(['bug', 'feature', 'general'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setFeedbackCategory(cat)}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all',
                    feedbackCategory === cat
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {cat === 'bug' ? 'Bug Report' : cat === 'feature' ? 'Feature Request' : 'General'}
                </button>
              ))}
            </div>

            {/* Message textarea */}
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              className="w-full mt-4 p-3 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
            />

            {/* Send button */}
            <Button
              className="w-full mt-4 h-11"
              disabled={!feedbackMessage.trim()}
              onClick={handleSendFeedback}
            >
              Send Feedback
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SettingsPage;
