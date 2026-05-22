import { motion, AnimatePresence } from 'framer-motion';
import { Globe, CheckCircle, XCircle, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useGameStore } from '@/store/gameStore';
import { getNation } from '@/data/nations';
import { FlagIcon } from '@/components/game/FlagIcon';

export function NationalTeamOfferModal() {
  const showNationalTeamOffer = useGameStore(s => s.showNationalTeamOffer);
  const nationalTeamOffer = useGameStore(s => s.nationalTeamOffer);
  const managerNationality = useGameStore(s => s.managerNationality);
  const acceptNationalTeamOffer = useGameStore(s => s.acceptNationalTeamOffer);
  const declineNationalTeamOffer = useGameStore(s => s.declineNationalTeamOffer);

  const open = showNationalTeamOffer && nationalTeamOffer?.status === 'pending' && !!managerNationality;
  useScrollLock(open);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(panelRef, open);
  useEscapeClose(declineNationalTeamOffer, open);

  if (!open || !managerNationality) return null;

  const nation = getNation(managerNationality);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" style={{ touchAction: 'none' }} />

          {/* Modal */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${managerNationality} national team manager offer`}
            className="relative bg-card/95 backdrop-blur-xl border-2 border-teal-500/50 rounded-2xl max-w-sm w-full p-6 overflow-hidden shadow-[0_0_50px_rgba(20,184,166,0.15)]"
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-primary/5 pointer-events-none" />

            {/* Close button */}
            <button
              onClick={declineNationalTeamOffer}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative text-center space-y-4">
              {/* Flag + Icon */}
              <motion.div
                className="flex justify-center"
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.15 }}
              >
                <div
                  className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-white/10"
                  style={{ backgroundColor: nation?.color || '#333' }}
                >
                  <FlagIcon nationality={managerNationality} fill />
                </div>
              </motion.div>

              {/* Badge */}
              <motion.div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Globe className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">International Offer</span>
              </motion.div>

              {/* Title */}
              <motion.h2
                className="text-xl font-black font-display text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {managerNationality}
              </motion.h2>

              {/* Message */}
              <motion.div
                className="bg-muted/30 rounded-xl p-4 border border-border/30 text-left"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-sm text-foreground/90 leading-relaxed">
                  The <span className="font-semibold text-foreground">{managerNationality} Football Association</span> has been
                  impressed by your potential and would like to offer you the position
                  of <span className="font-semibold text-teal-400">national team manager</span>.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  You will manage both your club and country simultaneously.
                </p>
              </motion.div>

              {/* Details */}
              <motion.div
                className="grid grid-cols-2 gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</p>
                  <p className="text-sm font-semibold text-foreground">Head Coach</p>
                </div>
                <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Commitment</p>
                  <p className="text-sm font-semibold text-foreground">Dual Role</p>
                </div>
              </motion.div>

              {/* Buttons */}
              <motion.div
                className="flex gap-3 pt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  className="flex-1 h-11 font-bold gap-2 bg-teal-600 hover:bg-teal-500 text-white"
                  onClick={acceptNationalTeamOffer}
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-11 font-bold gap-2"
                  onClick={declineNationalTeamOffer}
                >
                  <XCircle className="w-4 h-4" />
                  Decline
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
