// Fail before archive/upload rather than ship a store that cannot initialize.
const key = (process.env.VITE_REVENUECAT_API_KEY_IOS || process.env.VITE_REVENUECAT_API_KEY || '');
if (!/^appl_[A-Za-z0-9]+$/.test(key)) {
  console.error('::error::Set a production iOS RevenueCat public SDK key (appl_ prefix). Missing, test and Android keys cannot ship.');
  process.exitCode = 1;
} else {
  console.log('Production iOS RevenueCat key format verified (store configuration still requires device testing).');
}
