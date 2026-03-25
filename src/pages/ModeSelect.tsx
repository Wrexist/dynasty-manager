import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const modes = [
  {
    id: 'sandbox',
    name: 'Sandbox Mode',
    tagline: 'Pick any club. Full freedom.',
    description: 'Choose any club from any league and take control immediately. No restrictions — build your dynasty your way.',
    icon: Gamepad2,
    color: 'from-emerald-500/20 to-emerald-600/5',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/50',
    iconColor: 'text-emerald-400',
    route: '/select-club',
  },
  {
    id: 'career',
    name: 'Manager Career',
    tagline: 'Start small. Build a legacy.',
    description: 'Create your manager with unique traits and stats. Begin at a lower-league club, earn your reputation, and climb to the top.',
    icon: Briefcase,
    color: 'from-primary/20 to-primary/5',
    borderColor: 'border-primary/30 hover:border-primary/50',
    iconColor: 'text-primary',
    route: '/create-manager',
  },
] as const;

const ModeSelect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const slot = (location.state as { slot?: number })?.slot || 1;

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
        className="text-center mt-8 mb-10"
      >
        <h1 className="text-2xl font-black text-foreground tracking-tight font-display">Choose Your Mode</h1>
        <p className="text-sm text-muted-foreground mt-2">How do you want to play?</p>
      </motion.div>

      {/* Mode Cards */}
      <div className="w-full max-w-xs space-y-4">
        {modes.map((mode, idx) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.15, duration: 0.5 }}
            onClick={() => navigate(mode.route, { state: { slot } })}
            className={cn(
              'w-full text-left rounded-xl p-5 border transition-all duration-200',
              'bg-card/60 backdrop-blur-xl',
              'active:scale-[0.98]',
              mode.borderColor,
            )}
          >
            <div className={cn(
              'absolute inset-0 rounded-xl bg-gradient-to-br opacity-50 pointer-events-none',
              mode.color,
            )} />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', mode.iconColor, 'bg-current/10')}>
                  <mode.icon className={cn('w-5 h-5', mode.iconColor)} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{mode.name}</h2>
                  <p className={cn('text-xs font-semibold', mode.iconColor)}>{mode.tagline}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{mode.description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ModeSelect;
