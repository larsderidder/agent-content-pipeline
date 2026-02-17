/**
 * Plugin loader
 * Dynamically loads poster plugins from npm packages
 */

import type { PosterPlugin } from './types.js';

const pluginCache = new Map<string, PosterPlugin>();

export async function loadPlugin(pluginName: string): Promise<PosterPlugin> {
  // Check cache
  if (pluginCache.has(pluginName)) {
    return pluginCache.get(pluginName)!;
  }
  
  try {
    // Dynamic import of the plugin package
    const plugin = await import(pluginName) as PosterPlugin;
    
    // Validate plugin interface
    if (!plugin.platform || typeof plugin.post !== 'function') {
      throw new Error(`Invalid plugin: ${pluginName} - must export 'platform' and 'post'`);
    }
    
    pluginCache.set(pluginName, plugin);
    return plugin;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        `Plugin not found: ${pluginName}\n` +
        `Install it with: npm install ${pluginName}`
      );
    }
    throw error;
  }
}

export async function loadPlugins(pluginNames: string[]): Promise<Map<string, PosterPlugin>> {
  const plugins = new Map<string, PosterPlugin>();
  
  for (const name of pluginNames) {
    const plugin = await loadPlugin(name);
    plugins.set(plugin.platform, plugin);
  }
  
  return plugins;
}

export function getPluginForPlatform(
  plugins: Map<string, PosterPlugin>,
  platform: string
): PosterPlugin | undefined {
  return plugins.get(platform);
}
