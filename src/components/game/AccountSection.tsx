import { useEffect, useState } from 'react';
import { Apple, LogOut, UserCircle } from 'lucide-react';
import { LiquidButton } from '@/components/game/LiquidButton';
import { successToast, errorToast } from '@/utils/gameToast';
import { hapticMedium } from '@/utils/haptics';
import { getAuthInfo, appleSignInAvailable, signInWithApple, signOutCloud, type AuthInfo } from '@/utils/cloudAuth';

/**
 * Account / Sign in with Apple section (Online Slice 1, phase 1b).
 *
 * Rendered only when the cloud backend is configured (caller gates on
 * isCloudConfigured()). The "Sign in with Apple" button additionally shows only
 * on a real iOS build (appleSignInAvailable()); everywhere else the player is a
 * device-local guest. Signing in upgrades the anonymous identity to a durable
 * one so cloud saves survive reinstall / a new device.
 */
export function AccountSection() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const canApple = appleSignInAvailable();

  const refresh = () => { void getAuthInfo().then(setInfo); };
  useEffect(() => { refresh(); }, []);

  const onSignIn = async () => {
    hapticMedium();
    setBusy(true);
    const r = await signInWithApple();
    setBusy(false);
    if (r.ok) { successToast('Signed In', 'Your saves are now tied to your Apple ID — they survive a reinstall.'); refresh(); }
    else if (r.reason !== 'cancelled') errorToast('Sign-in Failed', 'Could not sign in with Apple. Please try again.');
  };

  const onSignOut = async () => {
    hapticMedium();
    setBusy(true);
    await signOutCloud();
    setBusy(false);
    successToast('Signed Out', 'Sign back in anytime to restore your cloud saves.');
    refresh();
  };

  const provider = info?.provider;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-sm text-foreground truncate">
          {provider === 'apple'
            ? `Signed in with Apple${info?.email ? ` · ${info.email}` : ''}`
            : 'Guest — backups stay on this device'}
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Sign in with Apple to keep your cloud saves if you reinstall or switch devices. As a guest, backups are tied to this install only.
      </p>
      {provider !== 'apple' && canApple && (
        <LiquidButton onClick={() => { void onSignIn(); }} disabled={busy}>
          <span className="flex items-center justify-start gap-3 px-3">
            <Apple className="w-4 h-4" />
            {busy ? 'Signing in…' : 'Sign in with Apple'}
          </span>
        </LiquidButton>
      )}
      {provider === 'apple' && (
        <LiquidButton onClick={() => { void onSignOut(); }} disabled={busy}>
          <span className="flex items-center justify-start gap-3 px-3">
            <LogOut className="w-4 h-4" />
            Sign Out
          </span>
        </LiquidButton>
      )}
    </div>
  );
}
