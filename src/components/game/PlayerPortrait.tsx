import { memo, useState } from 'react';

/** Separate from card artwork so rating filters never recolor a player's face.
 * Transparent cutouts are feathered into the shield; no image is fetched
 * for unresolved identities. A keyed instance retries only when the URL changes.
 */
export const PlayerPortrait = memo(function PlayerPortrait({ src, chip, frame }: { src: string; chip: boolean; frame: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none select-none" style={chip ? undefined : {
      WebkitMaskImage: `url(${frame})`, maskImage: `url(${frame})`,
      WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
    }}>
    <div className="absolute" style={{
      top: chip ? '1%' : '9%', left: '25%', width: '70%', height: chip ? '52%' : '49%',
      WebkitMaskImage: 'radial-gradient(ellipse 65% 80% at 52% 35%, black 48%, transparent 85%)',
      maskImage: 'radial-gradient(ellipse 65% 80% at 52% 35%, black 48%, transparent 85%)',
    }}>
      <img src={src} alt="" draggable={false} decoding="async" loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover object-top"
      />
    </div>
    </div>
  );
});
