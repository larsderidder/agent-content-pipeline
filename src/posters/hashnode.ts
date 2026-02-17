/**
 * Hashnode Poster (built-in)
 * Uses the Hashnode GraphQL API (https://api.hashnode.com) to publish posts.
 *
 * Authentication: store your Hashnode Personal Access Token and Publication ID
 * in ~/.content-pipeline/hashnode-creds.json (chmod 600).
 * Run: content auth hashnode
 *
 * Frontmatter fields used:
 *   title        (required)
 *   tags         (optional, array of tag slugs)
 *   canonical_url (optional)
 *   cover_image  (optional, URL)
 *   subtitle     (optional)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import type { PosterPlugin, PostOptions, PostResult, ValidationResult } from '../types.js';

export const platform = 'hashnode';

export const limits = {
  maxLength: 800_000,
};

const CREDS_FILE = join(homedir(), '.content-pipeline', 'hashnode-creds.json');
const HASHNODE_API = 'https://gql.hashnode.com';

interface HashnodeCreds {
  token: string;
  publicationId: string;
}

function ensureConfigDir(): void {
  const dir = join(homedir(), '.content-pipeline');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readCreds(): HashnodeCreds | undefined {
  if (!existsSync(CREDS_FILE)) return undefined;
  try {
    return JSON.parse(readFileSync(CREDS_FILE, 'utf8')) as HashnodeCreds;
  } catch {
    return undefined;
  }
}

function writeCreds(creds: HashnodeCreds): void {
  ensureConfigDir();
  writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2) + '\n');
  chmodSync(CREDS_FILE, 0o600);
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string
): Promise<T> {
  const res = await fetch(HASHNODE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Hashnode API error: HTTP ${res.status}`);
  }

  const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  return json.data as T;
}

export async function validate(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (content.length > limits.maxLength) {
    errors.push(`Content exceeds Hashnode limit (${content.length}/${limits.maxLength} chars)`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function post(content: string, options: PostOptions): Promise<PostResult> {
  const timestamp = new Date().toISOString();

  const creds = readCreds();
  if (!creds) {
    return {
      success: false,
      error: 'Hashnode not authenticated. Run: content auth hashnode',
      platform,
      timestamp,
    };
  }

  // Pull structured fields out of options (passed from cli via parsed frontmatter)
  const frontmatter = (options as unknown as Record<string, unknown>).frontmatter as Record<string, unknown> | undefined ?? {};

  const title = (frontmatter.title as string | undefined) ?? 'Untitled';
  const subtitle = frontmatter.subtitle as string | undefined;
  const canonicalUrl = (frontmatter.canonical_url ?? frontmatter.canonicalUrl) as string | undefined;
  const coverImageUrl = (frontmatter.cover_image ?? frontmatter.coverImage) as string | undefined;
  const tagSlugs = (frontmatter.tags as string[] | undefined) ?? [];

  if (options.dryRun) {
    return {
      success: true,
      platform,
      timestamp,
      error: `Dry run - would publish "${title}" to Hashnode publication ${creds.publicationId}`,
    };
  }

  const mutation = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          url
          slug
        }
      }
    }
  `;

  const tags = tagSlugs.map((slug) => ({ slug }));

  const input: Record<string, unknown> = {
    title,
    contentMarkdown: content,
    publicationId: creds.publicationId,
    tags,
  };

  if (subtitle) input.subtitle = subtitle;
  if (canonicalUrl) input.originalArticleURL = canonicalUrl;
  if (coverImageUrl) {
    input.coverImageOptions = { coverImageURL: coverImageUrl };
  }

  try {
    const data = await gql<{
      publishPost: { post: { id: string; url: string; slug: string } };
    }>(mutation, { input }, creds.token);

    const postData = data.publishPost?.post;
    return {
      success: true,
      url: postData?.url,
      platform,
      timestamp,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      platform,
      timestamp,
    };
  }
}

export async function auth(): Promise<void> {
  console.log('Hashnode API setup');
  console.log('');
  console.log('1. Get your Personal Access Token at: https://hashnode.com/settings/developer');
  console.log('2. Find your Publication ID at: https://hashnode.com/settings/blogs');
  console.log('   (click your blog, the ID is in the URL or settings page)');
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => {
    rl.question(q, (answer) => resolve(answer.trim()));
  });

  const token = await ask('Personal Access Token: ');
  const publicationId = await ask('Publication ID: ');
  rl.close();

  if (!token || !publicationId) {
    console.error('Both token and publication ID are required.');
    return;
  }

  // Verify by fetching the publication
  const query = `
    query CheckPublication($id: ObjectId!) {
      publication(id: $id) {
        id
        title
        url
      }
    }
  `;

  try {
    const data = await gql<{
      publication: { id: string; title: string; url: string } | null;
    }>(query, { id: publicationId }, token);

    const pub = data.publication;
    if (!pub) {
      console.error('Publication not found. Double-check the ID.');
      return;
    }

    writeCreds({ token, publicationId });
    console.log(`Verified: "${pub.title}" (${pub.url})`);
    console.log(`Credentials saved to ${CREDS_FILE}`);
  } catch (err) {
    console.error(`Could not verify credentials: ${(err as Error).message}`);
    console.log('Saving anyway. If posting fails, check the token and publication ID.');
    writeCreds({ token, publicationId });
  }
}

export const hashnodePoster: PosterPlugin = {
  platform,
  limits,
  post,
  validate,
};

export default hashnodePoster;
