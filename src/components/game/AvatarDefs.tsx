/**
 * Shared SVG <defs> for avatar components.
 * Kept minimal — badge-based avatars handle their own gradients.
 */

export function AvatarDefs() {
  return (
    <defs>
      <filter id="avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" />
      </filter>
    </defs>
  );
}
