/**
 * Post parser - reads markdown files with frontmatter
 */

import matter from 'gray-matter';
import { readFileSync } from 'fs';
import type { ParsedPost, PostFrontmatter, ValidationResult, ContentKitConfig } from './types.js';

export function parsePost(filePath: string): ParsedPost {
  const fileContent = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  
  return {
    frontmatter: data as PostFrontmatter,
    content: content.trim(),
    filePath,
  };
}

export function validatePost(
  post: ParsedPost,
  config: ContentKitConfig
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required frontmatter
  if (!post.frontmatter.platform) {
    errors.push('Missing required field: platform');
  }
  
  if (!post.frontmatter.status) {
    errors.push('Missing required field: status');
  }
  
  // Check approval if required
  if (config.requireApproval) {
    if (post.frontmatter.status === 'approved' && !post.frontmatter[config.approvalField]) {
      errors.push(`Approval required: missing '${config.approvalField}' field`);
    }
  }
  
  // Check content exists
  if (!post.content || post.content.length === 0) {
    errors.push('Post content is empty');
  }
  
  // Warnings
  if (post.frontmatter.status === 'draft') {
    warnings.push('Post is still in draft status');
  }
  
  if (post.frontmatter.status === 'posted') {
    warnings.push('Post has already been posted');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
