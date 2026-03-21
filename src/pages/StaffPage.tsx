import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Users, Star, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole } from '@/types/game';

const SQUAD_SUB_NAV = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

const ROLE_LABELS: Record<StaffRole, string> = {
  'assistant-manager': 'Assistant Manager',
  'first-team-coach': 'First Team Coach',
  'fitness-coach': 'Fitness Coach',
  'goalkeeping-coach': 'GK Coach',
  'scout': 'Scout',
  'youth-coach': 'Youth Coach',
  'physio': 'Physio',
};

const ROLE_BENEFITS: Record<StaffRole, string> = {
  'assistant-manager': 'General training bonus',
  'first-team-coach': 'Improved training gains',
  'fitness-coach': 'Faster fitness recovery',
  'goalkeeping-coach': 'GK development boost',
  'scout': 'More scouting assignments',
  'youth-coach': 'Better youth intake quality',
  'physio': 'Shorter injury recovery',
};

const StaffPage = () => {
  const { staff, hireStaff, fireStaff } = useGameStore();
  const [confirmFireId, setConfirmFireId] = useState<string | null>(null);

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-foreground">Staff</h2>
          <span className="text-xs text-muted-foreground">{staff.members.length} staff members</span>
        </div>

        {/* Current Staff */}
        {staff.members.length === 0 ? (
          <GlassPanel className="p-6 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No staff hired yet</p>
            <p className="text-xs text-muted-foreground mt-1">Hire staff to improve training, recovery, and scouting</p>
          </GlassPanel>
        ) : (
          <div className="space-y-2">
            {staff.members.map(member => (
              <GlassPanel key={member.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn('w-3 h-3', i < Math.round(member.quality / 2) ? 'text-primary fill-primary' : 'text-muted-foreground/30')}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">{ROLE_BENEFITS[member.role]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">£{(member.wage / 1000).toFixed(0)}K/w</span>
                    {confirmFireId === member.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { fireStaff(member.id); setConfirmFireId(null); }} className="text-xs text-destructive font-bold py-2 px-2 min-h-[44px]">Confirm</button>
                        <button onClick={() => setConfirmFireId(null)} className="text-xs text-muted-foreground font-semibold py-2 px-2 min-h-[44px]">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmFireId(member.id)}
                        className="text-[10px] text-destructive hover:text-destructive/80 font-semibold transition-colors"
                      >
                        Release
                      </button>
                    )}
                  </div>
                </div>
              </GlassPanel>
            ))}
          </div>
        )}

        {/* Available Hires */}
        {staff.availableHires.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-foreground pt-2">Available to Hire</h3>
            <div className="space-y-2">
              {staff.availableHires.map(hire => (
                <GlassPanel key={hire.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{hire.firstName} {hire.lastName}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[hire.role]}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn('w-3 h-3', i < Math.round(hire.quality / 2) ? 'text-primary fill-primary' : 'text-muted-foreground/30')}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => hireStaff(hire.id)}
                        className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">£{(hire.wage / 1000).toFixed(0)}K/w</span>
                </GlassPanel>
              ))}
            </div>
          </>
        )}

        {/* Role Guide */}
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Staff Roles</h3>
          <div className="space-y-1.5">
            {(Object.entries(ROLE_LABELS) as [StaffRole, string][]).map(([role, label]) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground">{ROLE_BENEFITS[role]}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};

export default StaffPage;
