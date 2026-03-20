import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Save, Download, Trash2, Zap, Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const APP_VERSION = 'v0.2 Alpha · Football Edition';

const SettingsPage = () => {
  const { settings, updateSettings, saveGame, loadGame, resetGame } = useGameStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveGame();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
