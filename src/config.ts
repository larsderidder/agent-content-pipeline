/**
 * Config loader
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ContentKitConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

const CONFIG_FILES = [
  '.content-pipeline.json',
  'content-pipeline.json',
  '.content-pipeline.config.json',
];

const GLOBAL_CONFIG_PATH = join(homedir(), '.content-pipeline.json');

export function loadConfig(cwd: string = process.cwd()): ContentKitConfig {
  // First check global config for workspaceDir
  let workspaceDir = cwd;
  let globalConfig: Partial<ContentKitConfig> = {};
  
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      globalConfig = JSON.parse(readFileSync(GLOBAL_CONFIG_PATH, 'utf-8'));
      if (globalConfig.workspaceDir && existsSync(globalConfig.workspaceDir)) {
        workspaceDir = globalConfig.workspaceDir;
      }
    } catch {
      // Ignore invalid global config
    }
  }
  
  // Try to find config file in workspace
  for (const filename of CONFIG_FILES) {
    const configPath = join(workspaceDir, filename);
    if (existsSync(configPath)) {
      const fileContent = readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(fileContent);
      // Merge: defaults < global < local
      const config = mergeConfig(mergeConfig(DEFAULT_CONFIG, globalConfig), userConfig);
      // Ensure contentDir is absolute
      if (!config.contentDir.startsWith('/')) {
        config.contentDir = join(workspaceDir, config.contentDir);
      }
      return config;
    }
  }
  
  // Check package.json for content-pipeline key
  const pkgPath = join(workspaceDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (pkg['content-pipeline']) {
      const config = mergeConfig(mergeConfig(DEFAULT_CONFIG, globalConfig), pkg['content-pipeline']);
      if (!config.contentDir.startsWith('/')) {
        config.contentDir = join(workspaceDir, config.contentDir);
      }
      return config;
    }
  }
  
  // Use global config with defaults
  const config = mergeConfig(DEFAULT_CONFIG, globalConfig);
  if (!config.contentDir.startsWith('/')) {
    config.contentDir = join(workspaceDir, config.contentDir);
  }
  return config;
}

export function mergeConfig(
  base: ContentKitConfig,
  override: Partial<ContentKitConfig>
): ContentKitConfig {
  return {
    ...base,
    ...override,
    // Deep merge arrays
    plugins: override.plugins ?? base.plugins,
  };
}
