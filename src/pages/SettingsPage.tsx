import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Save, Download, Trash2, Zap, Eye, RotateCcw, HelpCircle, Crown, RefreshCw, ExternalLink, Mail, MessageSquare, Vibrate, FileText, Shield, Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { infoToast, successToast, errorToast } from '@/utils/gameToast';
import { removeFlag, clearFlagsByPrefix, deleteAllDynastyData } from '@/store/helpers/persistence';
import { restorePurchases, openSubscriptionManagement, getCustomerInfo, extractSubscriptionInfo } from '@/utils/purchases';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { PRODUCTS } from '@/config/monetization';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { SAVE_CONFIRMATION_MS } from '@/config/ui';

const APP_VERSION = 'v1.0.0 · Football Edition';

const SettingsPage = () => {
  const settings = useGameStore(s => s.settings);
  const monetization = useGameStore(s => s.monetization);
  const updateSettings = useGameStore(s => s.updateSettings);
  const saveGame = useGameStore(s => s.saveGame);
  const loadGame = useGameStore(s => s.loadGame);
  const resetGame = useGameStore(s => s.resetGame);
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
    saveGame();
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
    saveGame();
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
    // Small delay to ensure navigation completes before showing toast
    setTimeout(() => {
      successToast('Data Deleted', 'All game data has been permanently removed from this device.');
    }, 100);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground">Settings</h2>

      {/* Save & Load */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Game Data</h3>
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
      </GlassPanel>

      {/* Match Speed */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Match Speed</h3>
        <div className="flex gap-2">
          {(['normal', 'fast', 'instant'] as const).map(speed => (
            <button
              key={speed}
              onClick={() => updateSettings({ matchSpeed: speed })}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold capitalize transition-all',
                settings.matchSpeed === speed
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              )}
            >
              {speed === 'fast' && <Zap className="w-3.5 h-3.5" />}
              {speed}
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* UI Preferences */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Display</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Show OVR on pitch</span>
            </div>
            <button
              onClick={() => updateSettings({ showOverallOnPitch: !settings.showOverallOnPitch })}
              className={cn(
                'w-10 h-6 rounded-full transition-colors relative',
                settings.showOverallOnPitch ? 'bg-primary' : 'bg-muted/50'
              )}
            >
              <div className={cn(
                'w-4 h-4 bg-white rounded-full absolute top-1 transition-transform',
                settings.showOverallOnPitch ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Auto-save</span>
            </div>
            <button
              onClick={() => updateSettings({ autoSave: !settings.autoSave })}
              className={cn(
                'w-10 h-6 rounded-full transition-colors relative',
                settings.autoSave ? 'bg-primary' : 'bg-muted/50'
              )}
            >
              <div className={cn(
                'w-4 h-4 bg-white rounded-full absolute top-1 transition-transform',
                settings.autoSave ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Vibrate className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Haptic feedback</span>
            </div>
            <button
              onClick={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
              className={cn(
                'w-10 h-6 rounded-full transition-colors relative',
                settings.hapticsEnabled !== false ? 'bg-primary' : 'bg-muted/50'
              )}
            >
              <div className={cn(
                'w-4 h-4 bg-white rounded-full absolute top-1 transition-transform',
                settings.hapticsEnabled !== false ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
        </div>
      </GlassPanel>

      {/* Purchases & Subscription */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Purchases</h3>
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

      {/* Support (Customer Center Fallback) */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Support</h3>
        <Button
          variant="secondary"
          className="w-full justify-start gap-3 h-11"
          onClick={() => window.open('mailto:support@dynastymanager.com?subject=Dynasty%20Manager%20Support', '_blank')}
        >
          <Mail className="w-4 h-4" />
          Contact Support
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2">
          Having trouble with a purchase or subscription? Contact us for help.
        </p>
        <div className="flex gap-3 mt-3">
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline hover:text-foreground transition-colors">Terms of Service</a>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline hover:text-foreground transition-colors">Privacy Policy</a>
        </div>
      </GlassPanel>

      {/* Feedback */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Feedback</h3>
        <Button
          variant="secondary"
          className="w-full justify-start gap-3 h-11"
          onClick={() => setFeedbackOpen(true)}
        >
          <MessageSquare className="w-4 h-4" />
          Send Feedback
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2">
          Report a bug, request a feature, or share your thoughts.
        </p>
      </GlassPanel>

      {/* Help */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Help</h3>
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
      </GlassPanel>

      {/* Delete All Data (Apple account deletion requirement) */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Data Management</h3>
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

      {/* Legal */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Legal</h3>
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

      {/* About */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Dynasty Manager</h3>
        <p className="text-xs text-muted-foreground">{APP_VERSION}</p>
        <p className="text-[10px] text-muted-foreground mt-2">Built with React, TypeScript, and Tailwind CSS</p>
      </GlassPanel>

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
