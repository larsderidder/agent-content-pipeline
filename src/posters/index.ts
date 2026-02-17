/**
 * Built-in posters
 */

export { linkedinPoster, auth as linkedinAuth } from './linkedin.js';
export { xPoster, auth as xAuth } from './x.js';
export { redditPoster, auth as redditAuth } from './reddit.js';
export { devtoPoster, auth as devtoAuth } from './devto.js';
export { hashnodePoster, auth as hashnodeAuth } from './hashnode.js';

import { linkedinPoster } from './linkedin.js';
import { xPoster } from './x.js';
import { redditPoster } from './reddit.js';
import { devtoPoster } from './devto.js';
import { hashnodePoster } from './hashnode.js';
import type { PosterPlugin } from '../types.js';

export const builtinPosters: Map<string, PosterPlugin> = new Map([
  ['linkedin', linkedinPoster],
  ['x', xPoster],
  ['twitter', xPoster], // Alias
  ['reddit', redditPoster],
  ['devto', devtoPoster],
  ['dev.to', devtoPoster], // Alias
  ['hashnode', hashnodePoster],
]);

export function getBuiltinPoster(platform: string): PosterPlugin | undefined {
  return builtinPosters.get(platform.toLowerCase());
}
