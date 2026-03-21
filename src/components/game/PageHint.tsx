import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { getFlag, setFlag } from '@/store/helpers/persistence';

interface PageHintProps {
  screen: string;
  title: string;
  body: string;
}

export function PageHint({ screen, title, body }: PageHintProps) {
  const storageKey = `dynasty-hint-${screen}-shown`;
  const [visible, setVisible] = useState(() => !getFlag(storageKey));

  const dismiss = () => {
    setVisible(false);
    setFlag(storageKey);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-primary/5 border border-primary/15 rounded-xl p-3 mb-3"
      >
        <div className="flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary mb-0.5">{title}</p>
            <p className="text-[11px] text-primary/70 leading-relaxed">{body}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-primary/40 hover:text-primary/70 transition-colors shrink-0"
            aria-label="Dismiss hint"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
