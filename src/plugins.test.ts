/**
 * Plugin Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPluginForPlatform } from './plugins.js';
import type { PosterPlugin } from './types.js';

// Note: loadPlugin and loadPlugins use dynamic imports which are difficult
// to mock reliably. We test the helper function and document integration test needs.

describe('getPluginForPlatform', () => {
  const mockLinkedInPlugin: PosterPlugin = {
    platform: 'linkedin',
    post: vi.fn(),
    limits: { maxLength: 3000 },
  };

  const mockTwitterPlugin: PosterPlugin = {
    platform: 'x',
    post: vi.fn(),
    limits: { maxLength: 280 },
  };

  let plugins: Map<string, PosterPlugin>;

  beforeEach(() => {
    plugins = new Map([
      ['linkedin', mockLinkedInPlugin],
      ['x', mockTwitterPlugin],
    ]);
  });

  it('should return plugin for matching platform', () => {
    const plugin = getPluginForPlatform(plugins, 'linkedin');
    expect(plugin).toBe(mockLinkedInPlugin);
  });

  it('should return undefined for unknown platform', () => {
    const plugin = getPluginForPlatform(plugins, 'facebook');
    expect(plugin).toBeUndefined();
  });

  it('should handle empty plugins map', () => {
    const emptyPlugins = new Map<string, PosterPlugin>();
    const plugin = getPluginForPlatform(emptyPlugins, 'linkedin');
    expect(plugin).toBeUndefined();
  });

  it('should be case-sensitive', () => {
    const plugin = getPluginForPlatform(plugins, 'LinkedIn');
    expect(plugin).toBeUndefined();
  });
});

// Integration test documentation:
// To fully test loadPlugin and loadPlugins, you would need:
// 1. A mock npm package or local module
// 2. Testing the error handling for ERR_MODULE_NOT_FOUND
// 3. Verifying plugin interface validation
//
// Example integration test (requires test fixtures):
// describe('loadPlugin integration', () => {
//   it('should load a valid plugin module', async () => {
//     const plugin = await loadPlugin('./test-fixtures/valid-plugin.js');
//     expect(plugin.platform).toBeDefined();
//     expect(typeof plugin.post).toBe('function');
//   });
//
//   it('should throw for missing module', async () => {
//     await expect(loadPlugin('nonexistent-plugin'))
//       .rejects.toThrow('Plugin not found');
//   });
//
//   it('should throw for invalid plugin interface', async () => {
//     await expect(loadPlugin('./test-fixtures/invalid-plugin.js'))
//       .rejects.toThrow('Invalid plugin');
//   });
// });
