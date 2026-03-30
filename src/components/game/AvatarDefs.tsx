/**
 * Shared SVG <defs> for PlayerAvatar components.
 * Render once per parent <svg> to avoid duplicating filters/gradients per player.
 */

export function AvatarDefs() {
  return (
    <defs>
      {/* Soft shadow filter for ground shadows */}
      <filter id="avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" />
      </filter>

      {/* Rim light filter for head highlight */}
      <filter id="avatar-rim" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.15" />
      </filter>
    </defs>
  );
}
