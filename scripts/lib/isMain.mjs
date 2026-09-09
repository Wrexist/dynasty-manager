import { pathToFileURL } from 'node:url';

/** Compare file URLs correctly on Windows, including paths with spaces. */
export function isMain(moduleUrl, entry = process.argv[1]) {
  return Boolean(entry) && moduleUrl === pathToFileURL(entry).href;
}
