import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Briefcase, Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Mode = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: typeof Gamepad2;
  color: string;
  borderColor: string;
  iconColor: string;
  iconBg: string;
  route?: string;
  comingSoon?: boolean;
};

const modes: readonly Mode[] = [
  {
    id: 'sandbox',
    name: 'Sandbox Mode',
    tagline: 'Pick any club. Full freedom.',
    description: 'Choose any club from any league and take control immediately. No restrictions — build your dynasty your way.',
    icon: Gamepad2,
    color: 'from-emerald-500/20 to-emerald-600/5',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    route: '/select-club',
  },
  {
    id: 'career',
    name: 'Manager Career',
    tagline: 'Start small. Build a legacy.',
    description: 'Create your manager with unique traits and stats. Begin at a lower-league club, earn your reputation, and climb to the top.',
    icon: Briefcase,
    color: 'from-primary/20 to-primary/5',
    borderColor: 'border-primary/30 hover:border-primary/60',
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    route: '/create-manager',
  },
  {
    id: 'online',
    name: 'Online',
    tagline: 'Play with friends.',
    description: 'Compete head-to-head, share leagues, and build rivalries with friends across the globe. Multiplayer is on the way.',
    icon: Users,
    color: 'from-sky-500/15 to-sky-600/5',
    borderColor: 'border-sky-500/20',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    comingSoon: true,
  },
] as const;

const ModeSelect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { slot?: number; communityPackEnabled?: boolean }) || {};
  const slot = navState.slot || 1;
  const communityPackEnabled = navState.communityPackEnabled === true;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 safe-area-top safe-area-bottom">
      {/* Back button */}
      <div className="w-full max-w-xs">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-1.5 -ml-2"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mt-8 mb-8"
      >
        <h1 className="text-2xl font-black text-foreground tracking-tight font-display">Choose Your Mode</h1>
        <p className="text-sm text-muted-foreground mt-2">How do you want to play?</p>
      </motion.div>

      {/* Mode Cards */}
      <div className="w-full max-w-xs space-y-3.5">
        {modes.map((mode, idx) => {
          const disabled = mode.comingSoon;
          const handleClick = () => {
            if (disabled) {
              toast.info('Online mode is coming soon', {
                description: 'Play with friends in a future update.',
              });
              return;
            }
            if (mode.route) navigate(mode.route, { state: { slot, communityPackEnabled } });
          };

          return (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={handleClick}
              aria-disabled={disabled}
              className={cn(
                'group relative w-full text-left rounded-2xl p-5 border overflow-hidden',
                // Liquid-glass base — matches GlassPanel so cards feel uniform
                // with the rest of the app.
                'bg-gradient-to-br from-[hsl(222_35%_14%/0.65)] via-[hsl(222_28%_10%/0.7)] to-[hsl(222_40%_7%/0.78)]',
                'backdrop-blur-2xl backdrop-saturate-150',
                'shadow-[0_0_0_0.5px_rgba(255,255,255,0.14)_inset,inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.4),0_14px_36px_-16px_rgba(0,0,0,0.55)]',
                'transition-all duration-300 ease-out',
                !disabled && 'hover:-translate-y-0.5 active:scale-[0.98]',
                disabled && 'opacity-70 cursor-default',
                mode.borderColor,
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-br pointer-events-none',
                  'opacity-40 transition-opacity duration-300',
                  !disabled && 'group-hover:opacity-60',
                  mode.color,
                )}
              />

              {disabled && (
                <div className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30">
                  <Sparkles className="w-3 h-3 text-sky-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-200">
                    Coming Soon
                  </span>
                </div>
              )}

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                      'ring-1 ring-inset ring-white/5',
                      mode.iconBg,
                    )}
                  >
                    <mode.icon className={cn('w-5 h-5', mode.iconColor)} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-foreground leading-tight truncate">
                      {mode.name}
                    </h2>
                    <p className={cn('text-xs font-semibold mt-0.5', mode.iconColor)}>
                      {mode.tagline}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {mode.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ModeSelect;
