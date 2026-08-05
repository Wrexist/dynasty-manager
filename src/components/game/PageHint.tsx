import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { getFlag, setFlag } from '@/store/helpers/persistence';
import { useGameStore } from '@/store/gameStore';

interface PageHintProps {
  screen: string;
  title: string;
  body: string;
}

export function PageHint({ screen, title, body }: PageHintProps) {
  const { t } = useTranslation();
  const hidePageHints = useGameStore(s => s.settings.hidePageHints);
  const storageKey = `dynasty-hint-${screen}-shown`;
  const [visible, setVisible] = useState(() => !getFlag(storageKey));

  // Mark the hint as seen on first view, so it appears exactly once per screen.
  // Previously the flag was only written on an explicit X-dismiss, which meant
  // leaving the page without closing it made the hint reappear every visit.
  useEffect(() => {
    if (visible && !hidePageHints) setFlag(storageKey);
  }, [visible, hidePageHints, storageKey]);

  if (hidePageHints) return null;

  const dismiss = () => {
    setVisible(false);
    setFlag(storageKey);
  };

  // AnimatePresence stays mounted with the hint conditionally inside it —
  // returning null above it removed the whole subtree before the exit
  // animation could play, making `exit` dead code.
  return (
    <AnimatePresence>
      {visible && (
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
            aria-label={t('pageHint.dismissHint')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
