/**
 * Agent Content Pipeline
 * 
 * Safe content automation for AI agents.
 * Draft → Review → Approve → Post
 */

export * from './types.js';
export { parsePost, validatePost } from './parser.js';
export { loadConfig, mergeConfig } from './config.js';
export { loadPlugin, loadPlugins } from './plugins.js';

// Built-in posters
export {
  builtinPosters,
  getBuiltinPoster,
  linkedinPoster,
  xPoster,
  redditPoster,
  devtoPoster,
  hashnodePoster,
} from './posters/index.js';
