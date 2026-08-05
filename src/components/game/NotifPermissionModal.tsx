/**
 * First-win notification permission ask (G5).
 *
 * Surfaced once, at the first-win emotional peak, instead of never. The match
 * flow flags eligibility via the `notifications` external signal; this modal
 * subscribes, routes itself through the presentation queue (so it never stacks
 * on the win celebration), and only appears on native where reminders exist.
 *
 * Choosing "Enable" requests OS permission and records the opt-in; "Not now"
 * simply marks the one-time prompt shown (opt-in stays unanswered, so the
 * Settings toggle still works later). Either way it never re-appears.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import {
  isFirstWinPromptPending,
  subscribeFirstWinPrompt,
  resolveFirstWinPrompt,
  requestNotificationPermission,
} from '@/utils/notifications';
import { writeNotificationsEnabled } from '@/store/helpers/persistence';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { track } from '@/utils/analytics';

export function NotifPermissionModal() {
  const { t } = useTranslation();
  const pending = useSyncExternalStore(
    subscribeFirstWinPrompt,
    isFirstWinPromptPending,
    isFirstWinPromptPending,
  );
  const isNative = Capacitor.isNativePlatform();

  // Off-device (web/dev) there are no OS reminders, so silently retire the
  // prompt if it ever gets flagged — keeps the module signal from lingering.
  useEffect(() => {
    if (pending && !isNative) resolveFirstWinPrompt();
  }, [pending, isNative]);

  const wants = pending && isNative;
  const active = usePresentationSlot('notifPrompt', wants);
  const visible = wants && active;
  useScrollLock(visible);

  const handleEnable = useCallback(async () => {
    hapticLight();
    let granted = false;
    try {
      granted = await requestNotificationPermission();
    } catch { /* treat as denied */ }
    writeNotificationsEnabled(granted);
    if (granted) hapticSuccess();
    track('notif_permission_prompt', { action: 'enable', granted });
    resolveFirstWinPrompt();
  }, []);

  const handleDismiss = useCallback(() => {
    hapticLight();
    track('notif_permission_prompt', { action: 'dismiss', granted: false });
    resolveFirstWinPrompt();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={handleDismiss} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('notifPermissionModal.enableMatchReminders')}
            className="relative bg-card/95 backdrop-blur-xl border border-primary/40 rounded-2xl max-w-sm w-full p-6 overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.12)]"
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t('notifPermissionModal.notNow')}
              className="absolute top-1 right-1 z-10 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]">
                <Bell className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black font-display text-foreground">Never miss a moment</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Great win! Turn on reminders and we&apos;ll nudge you about your next big match,
                pending transfer offers and your daily streak — no spam, just your season.
              </p>
              <div className="space-y-2 pt-1">
                <Button className="w-full" onClick={() => { void handleEnable(); }}>
                  Enable reminders
                </Button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full h-9 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
