import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Save, Download, Trash2, Zap, Eye, RotateCcw, HelpCircle, Crown, RefreshCw, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { infoToast, successToast, errorToast } from '@/utils/gameToast';
import { removeFlag, clearFlagsByPrefix } from '@/store/helpers/persistence';
import { restorePurchases, openSubscriptionManagement, getCustomerInfo, extractSubscriptionInfo } from '@/utils/purchases';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { PRODUCTS } from '@/config/monetization';
import { SAVE_CONFIRMATION_MS } from '@/config/ui';

const APP_VERSION = 'v0.2 Alpha · Football Edition';

const SettingsPage = () => {
  const { settings, updateSettings, saveGame, loadGame, resetGame, monetization, restoreEntitlements, updateSubscription } = useGameStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(savedTimerRef.current); }, []);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
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

  const handleReset = () => {
    resetGame();
    setShowResetConfirm(false);
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
          {!showResetConfirm ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowResetConfirm(true)}
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
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold capitalize">
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

      {/* About */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Dynasty Manager</h3>
        <p className="text-xs text-muted-foreground">{APP_VERSION}</p>
        <p className="text-[10px] text-muted-foreground mt-2">Built with React, TypeScript, and Tailwind CSS</p>
      </GlassPanel>
    </div>
  );
};

export default SettingsPage;
