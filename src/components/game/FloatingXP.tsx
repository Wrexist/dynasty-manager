import { AnimatePresence, motion } from 'framer-motion';

interface FloatingXPProps {
  amount: number;
  show: boolean;
}

export function FloatingXP({ amount, show }: FloatingXPProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          key="floating-xp"
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -24, scale: 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute right-2 top-0 text-[10px] font-bold text-primary drop-shadow-[0_0_4px_hsl(43_96%_46%/0.5)] pointer-events-none z-10"
        >
          +{amount} XP
        </motion.span>
      )}
    </AnimatePresence>
  );
}
