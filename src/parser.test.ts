/**
 * Parser Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { parsePost, validatePost } from './parser.js';
import type { ContentKitConfig, ParsedPost } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

const TEST_DIR = '/tmp/agent-content-pipeline-test';

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('parsePost', () => {
  it('should parse frontmatter and content', () => {
    const filePath = join(TEST_DIR, 'test-post.md');
    writeFileSync(
      filePath,
      `---
platform: linkedin
status: draft
title: Test Post
tags:
  - ai
  - testing
---

This is the post content.
`
    );

    const result = parsePost(filePath);

    expect(result.frontmatter.platform).toBe('linkedin');
    expect(result.frontmatter.status).toBe('draft');
    expect(result.frontmatter.title).toBe('Test Post');
    expect(result.frontmatter.tags).toEqual(['ai', 'testing']);
    expect(result.content).toBe('This is the post content.');
    expect(result.filePath).toBe(filePath);
  });

  it('should handle approved post with metadata', () => {
    const filePath = join(TEST_DIR, 'approved-post.md');
    writeFileSync(
      filePath,
      `---
platform: linkedin
status: approved
approved_by: lars
approved_at: "2024-01-20T14:30:00Z"
---

Approved content ready for posting.
`
    );

    const result = parsePost(filePath);

    expect(result.frontmatter.status).toBe('approved');
    expect(result.frontmatter.approved_by).toBe('lars');
    expect(result.frontmatter.approved_at).toBe('2024-01-20T14:30:00Z');
  });

  it('should preserve multi-line content', () => {
    const filePath = join(TEST_DIR, 'multiline.md');
    writeFileSync(
      filePath,
      `---
platform: x
status: draft
---

First paragraph.

Second paragraph.

Third paragraph.
`
    );

    const result = parsePost(filePath);
    expect(result.content).toContain('First paragraph.');
    expect(result.content).toContain('Second paragraph.');
    expect(result.content).toContain('Third paragraph.');
  });
});

describe('validatePost', () => {
  const createPost = (overrides: Partial<ParsedPost> = {}): ParsedPost => ({
    frontmatter: {
      platform: 'linkedin',
      status: 'approved',
      approved_by: 'lars',
      ...overrides.frontmatter,
    },
    content: 'Some content',
    filePath: '/test/post.md',
    ...overrides,
  });

  it('should validate a correct post', () => {
    const post = createPost();
    const result = validatePost(post, DEFAULT_CONFIG);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should error on missing platform', () => {
    const post = createPost({
      frontmatter: { status: 'approved', platform: undefined as any },
    });
    const result = validatePost(post, DEFAULT_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: platform');
  });

  it('should error on missing status', () => {
    const post = createPost({
      frontmatter: { platform: 'linkedin', status: undefined as any },
    });
    const result = validatePost(post, DEFAULT_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: status');
  });

  it('should error on missing approval when required', () => {
    const config: ContentKitConfig = {
      ...DEFAULT_CONFIG,
      requireApproval: true,
    };
    const post = createPost({
      frontmatter: { platform: 'linkedin', status: 'approved' },
    });
    const result = validatePost(post, config);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Approval required');
  });

  it('should pass validation when approval not required', () => {
    const config: ContentKitConfig = {
      ...DEFAULT_CONFIG,
      requireApproval: false,
    };
    const post = createPost({
      frontmatter: { platform: 'linkedin', status: 'approved' },
    });
    const result = validatePost(post, config);

    expect(result.valid).toBe(true);
  });

  it('should error on empty content', () => {
    const post = createPost({ content: '' });
    const result = validatePost(post, DEFAULT_CONFIG);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Post content is empty');
  });

  it('should warn on draft status', () => {
    const post = createPost({
      frontmatter: { platform: 'linkedin', status: 'draft', approved_by: 'x' },
    });
    const result = validatePost(post, DEFAULT_CONFIG);

    expect(result.warnings).toContain('Post is still in draft status');
  });

  it('should warn on already posted status', () => {
    const post = createPost({
      frontmatter: { platform: 'linkedin', status: 'posted', approved_by: 'x' },
    });
    const result = validatePost(post, DEFAULT_CONFIG);

    expect(result.warnings).toContain('Post has already been posted');
  });

  it('should use custom approval field', () => {
    const config: ContentKitConfig = {
      ...DEFAULT_CONFIG,
      requireApproval: true,
      approvalField: 'reviewed_by',
    };
    const post = createPost({
      frontmatter: { platform: 'linkedin', status: 'approved', reviewed_by: 'alice' } as any,
    });
    const result = validatePost(post, config);

    expect(result.valid).toBe(true);
  });
});
