/**
 * Dev.to Poster (built-in)
 * Uses @sinedied/devto-cli (the `dev` command) to push articles.
 *
 * The devto-cli expects a markdown file with frontmatter that includes:
 *   title, published, tags, and optionally series/cover_image/canonical_url.
 *
 * Authentication: store your dev.to API key in ~/.content-pipeline/devto-token
 * (chmod 600). Run: content auth devto
 *
 * The `dev push` command matches articles by their `id` field in frontmatter
 * (set automatically after first publish). Without an id it creates a new
 * article. The --reconcile flag can match by title instead.
 */

import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { homedir, tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline';
import type { PosterPlugin, PostOptions, PostResult, ValidationResult } from '../types.js';

export const platform = 'devto';

export const limits = {
  maxLength: 100_000,
};

const TOKEN_FILE = join(homedir(), '.content-pipeline', 'devto-token');

function ensureConfigDir(): void {
  const dir = join(homedir(), '.content-pipeline');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readToken(): string | undefined {
  if (!existsSync(TOKEN_FILE)) return undefined;
  return readFileSync(TOKEN_FILE, 'utf8').trim();
}

function writeToken(token: string): void {
  ensureConfigDir();
  writeFileSync(TOKEN_FILE, token + '\n');
  chmodSync(TOKEN_FILE, 0o600);
}

async function checkDevCli(): Promise<boolean> {
  try {
    await execa('npx', ['--yes', '@sinedied/devto-cli', '--version'], { reject: false });
    return true;
  } catch {
    return false;
  }
}

export async function validate(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (content.length > limits.maxLength) {
    errors.push(`Content exceeds dev.to limit (${content.length}/${limits.maxLength} chars)`);
  }

  // devto-cli needs a title in the markdown frontmatter
  if (!content.includes('title:')) {
    errors.push('Dev.to articles require a title field in frontmatter');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function post(content: string, options: PostOptions): Promise<PostResult> {
  const timestamp = new Date().toISOString();

  const token = readToken();
  if (!token) {
    return {
      success: false,
      error: 'Dev.to not authenticated. Run: content auth devto',
      platform,
      timestamp,
    };
  }

  if (options.dryRun) {
    return {
      success: true,
      platform,
      timestamp,
      error: 'Dry run - would push article via devto-cli',
    };
  }

  // Write the article to a temp directory that devto-cli can push from.
  // devto-cli resolves relative asset URLs against a GitHub repo, but for
  // plain text articles no --repo flag is required.
  const tmpDir = join(tmpdir(), `content-pipeline-devto-${randomBytes(8).toString('hex')}`);
  const articleFile = join(tmpDir, 'article.md');

  try {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(articleFile, content, 'utf8');

    const args = [
      '--yes',
      '@sinedied/devto-cli',
      'push',
      articleFile,
      '--token',
      token,
    ];

    if (options.verbose) {
      args.push('--verbose');
    }

    const result = await execa('npx', args, {
      cwd: tmpDir,
      env: { ...process.env, DEVTO_TOKEN: token },
    });

    // Try to extract the URL from the CLI output
    const urlMatch = result.stdout.match(/https:\/\/dev\.to\/\S+/);
    const url = urlMatch ? urlMatch[0] : undefined;

    return {
      success: true,
      url,
      platform,
      timestamp,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const detail = err.stderr || err.stdout || err.message || String(error);
    return {
      success: false,
      error: detail,
      platform,
      timestamp,
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function auth(): Promise<void> {
  console.log('Dev.to API token setup');
  console.log('');
  console.log('Get your API key at: https://dev.to/settings/extensions');
  console.log('Scroll to "DEV Community API Keys" and generate a new key.');
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const token = await new Promise<string>((resolve) => {
    rl.question('Paste your dev.to API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!token) {
    console.error('No token provided.');
    return;
  }

  // Quick validation: try to hit the authenticated user endpoint
  try {
    const res = await fetch('https://dev.to/api/users/me', {
      headers: { 'api-key': token },
    });

    if (!res.ok) {
      console.error(`Token rejected by dev.to (HTTP ${res.status}). Check the key and try again.`);
      return;
    }

    const user = await res.json() as { username?: string; name?: string };
    writeToken(token);
    console.log(`Token verified for @${user.username ?? user.name ?? 'unknown'}`);
    console.log(`Saved to ${TOKEN_FILE}`);
  } catch (err) {
    console.error(`Could not verify token: ${(err as Error).message}`);
    console.log('Saving anyway. If posting fails, check the token.');
    writeToken(token);
  }
}

export const devtoPoster: PosterPlugin = {
  platform,
  limits,
  post,
  validate,
};

export default devtoPoster;
