/**
 * Config Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfig, mergeConfig } from './config.js';
import { DEFAULT_CONFIG } from './types.js';

const TEST_DIR = '/tmp/openclaw-config-test';
const GLOBAL_CONFIG = join(homedir(), '.content-pipeline.json');
const GLOBAL_CONFIG_BACKUP = join(homedir(), '.content-pipeline.json.bak');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  // Temporarily move global config out of the way
  if (existsSync(GLOBAL_CONFIG)) {
    renameSync(GLOBAL_CONFIG, GLOBAL_CONFIG_BACKUP);
  }
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  // Restore global config
  if (existsSync(GLOBAL_CONFIG_BACKUP)) {
    renameSync(GLOBAL_CONFIG_BACKUP, GLOBAL_CONFIG);
  }
});

describe('loadConfig', () => {
  it('should return default config with absolute contentDir when no config file exists', () => {
    const config = loadConfig(TEST_DIR);
    expect(config.contentDir).toBe(TEST_DIR);
    expect(config.dryRun).toBe(DEFAULT_CONFIG.dryRun);
    expect(config.plugins).toEqual(DEFAULT_CONFIG.plugins);
  });

  it('should load from .content-pipeline.json with absolute contentDir', () => {
    writeFileSync(
      join(TEST_DIR, '.content-pipeline.json'),
      JSON.stringify({
        contentDir: './posts',
        dryRun: false,
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.contentDir).toBe(join(TEST_DIR, 'posts'));
    expect(config.dryRun).toBe(false);
    expect(config.requireApproval).toBe(DEFAULT_CONFIG.requireApproval);
  });

  it('should load from content-pipeline.json', () => {
    writeFileSync(
      join(TEST_DIR, 'content-pipeline.json'),
      JSON.stringify({
        plugins: ['plugin-linkedin'],
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.plugins).toEqual(['plugin-linkedin']);
  });

  it('should load from .content-pipeline.config.json', () => {
    writeFileSync(
      join(TEST_DIR, '.content-pipeline.config.json'),
      JSON.stringify({
        requireApproval: false,
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.requireApproval).toBe(false);
  });

  it('should prefer first config file found', () => {
    // Create both files
    writeFileSync(
      join(TEST_DIR, '.content-pipeline.json'),
      JSON.stringify({ contentDir: './first' })
    );
    writeFileSync(
      join(TEST_DIR, 'content-pipeline.json'),
      JSON.stringify({ contentDir: './second' })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.contentDir).toBe(join(TEST_DIR, 'first'));
  });

  it('should load from package.json content-pipeline key', () => {
    writeFileSync(
      join(TEST_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        'content-pipeline': {
          contentDir: './pkg-content',
          dryRun: false,
        },
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.contentDir).toBe(join(TEST_DIR, 'pkg-content'));
    expect(config.dryRun).toBe(false);
  });

  it('should prefer dedicated config file over package.json', () => {
    writeFileSync(
      join(TEST_DIR, '.content-pipeline.json'),
      JSON.stringify({ contentDir: './dedicated' })
    );
    writeFileSync(
      join(TEST_DIR, 'package.json'),
      JSON.stringify({
        name: 'test',
        'content-pipeline': { contentDir: './package' },
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.contentDir).toBe(join(TEST_DIR, 'dedicated'));
  });

  it('should return default config with absolute path when package.json has no content-pipeline key', () => {
    writeFileSync(
      join(TEST_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.contentDir).toBe(TEST_DIR);
  });

  it('should preserve absolute contentDir paths', () => {
    writeFileSync(
      join(TEST_DIR, '.content-pipeline.json'),
      JSON.stringify({
        contentDir: '/absolute/path/to/content',
      })
    );

    const config = loadConfig(TEST_DIR);

    expect(config.contentDir).toBe('/absolute/path/to/content');
  });
});

describe('mergeConfig', () => {
  it('should merge override into base', () => {
    const override = {
      contentDir: './custom',
      dryRun: false,
    };

    const result = mergeConfig(DEFAULT_CONFIG, override);

    expect(result.contentDir).toBe('./custom');
    expect(result.dryRun).toBe(false);
    expect(result.requireApproval).toBe(DEFAULT_CONFIG.requireApproval);
  });

  it('should override plugins array entirely', () => {
    const base = { ...DEFAULT_CONFIG, plugins: ['old-plugin'] };
    const override = { plugins: ['new-plugin-1', 'new-plugin-2'] };

    const result = mergeConfig(base, override);

    expect(result.plugins).toEqual(['new-plugin-1', 'new-plugin-2']);
  });

  it('should keep base plugins when not overridden', () => {
    const base = { ...DEFAULT_CONFIG, plugins: ['existing-plugin'] };
    const override = { dryRun: false };

    const result = mergeConfig(base, override);

    expect(result.plugins).toEqual(['existing-plugin']);
  });

  it('should handle empty override', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {});
    expect(result).toEqual(DEFAULT_CONFIG);
  });
});
