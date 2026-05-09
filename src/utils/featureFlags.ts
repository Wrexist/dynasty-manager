// Build-time flag used for App Store screenshot builds.
// When VITE_DISABLE_IAP=1 the Shop entry is hidden and the Shop page is a
// no-op. Reset by unsetting the env variable and rebuilding.
export const IAP_DISABLED = import.meta.env.VITE_DISABLE_IAP === '1';
