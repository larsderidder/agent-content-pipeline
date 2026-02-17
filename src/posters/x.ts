/**
 * X/Twitter Poster (built-in)
 * Uses bird CLI with encrypted token storage
 */

import { execa } from 'execa';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, readFileSync, mkdirSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { platform as osPlatform } from 'os';
import type { PosterPlugin, PostOptions, PostResult, ValidationResult } from '../types.js';
import { encryptXTokens, decryptXTokens, hasEncryptedXTokens, getPassword, isSecureSigningEnabled } from '../signing.js';

export const platform = 'x';

export const limits = {
  maxLength: 280,
  maxImages: 4,
  maxVideos: 1,
};

function isThread(content: string): boolean {
  return content.includes('\n---\n') || content.includes('\n---');
}

function splitThread(content: string): string[] {
  return content
    .split(/\n---+\n?/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

export async function validate(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
const tweets = isThread(content) ? splitThread(content) : [content];
  
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    if (tweet.length > limits.maxLength) {
      errors.push(`Tweet ${i + 1} exceeds limit (${tweet.length}/${limits.maxLength} chars)`);
    }
    if (tweet.length > 250) {
      warnings.push(`Tweet ${i + 1} is close to limit (${tweet.length}/280)`);
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

async function checkBird(): Promise<boolean> {
  try {
    await execa('bird', ['--version']);
    return true;
  } catch {
    return false;
  }
}

function extractFirefoxTokens(): { authToken: string; ct0: string } {
  const scriptPath = join(tmpdir(), `ck-extract-${Date.now()}.py`);
  
  const script = `
import sqlite3, os, json, shutil, tempfile
from pathlib import Path

ff_dir = Path.home() / ".mozilla/firefox"
profiles = [p for p in ff_dir.iterdir() if p.is_dir() and "default" in p.name.lower()]
if not profiles:
    print(json.dumps({"error": "No Firefox profile found"}))
    exit(0)

cookies_db = profiles[0] / "cookies.sqlite"
if not cookies_db.exists():
    print(json.dumps({"error": "No cookies.sqlite found"}))
    exit(0)

tmp = tempfile.mktemp(suffix=".sqlite")
shutil.copy(cookies_db, tmp)

conn = sqlite3.connect(tmp)
cur = conn.cursor()
cur.execute("SELECT name, value FROM moz_cookies WHERE host LIKE '%x.com%' AND name IN ('auth_token', 'ct0')")
rows = cur.fetchall()
conn.close()
os.unlink(tmp)

result = {r[0]: r[1] for r in rows}
print(json.dumps(result))
`;
  
  try {
    writeFileSync(scriptPath, script);
    const result = execSync(`python3 "${scriptPath}"`, { encoding: 'utf8' });
    unlinkSync(scriptPath);
    
    const parsed = JSON.parse(result);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (!parsed.auth_token || !parsed.ct0) {
      throw new Error('Could not find auth_token and ct0 in Firefox cookies. Make sure you are logged into x.com in Firefox.');
    }
    return { authToken: parsed.auth_token, ct0: parsed.ct0 };
  } catch (err) {
    try { unlinkSync(scriptPath); } catch {}
    throw new Error(`Failed to extract Firefox cookies: ${(err as Error).message}`);
  }
}

export async function post(content: string, options: PostOptions): Promise<PostResult> {
  const timestamp = new Date().toISOString();
  
  if (!await checkBird()) {
    return {
      success: false,
      error: 'bird CLI not found. Install: npm install -g @steipete/bird',
      platform,
      timestamp,
    };
  }
  
  const tweets = isThread(content) ? splitThread(content) : [content];
  
  if (options.dryRun) {
    return {
      success: true,
      platform,
      timestamp,
      error: `Dry run - would post ${tweets.length} tweet(s)`,
    };
  }
  
  // Get tokens - prefer encrypted, fallback to plaintext if present
  let authToken: string;
  let ct0: string;
  
  if (hasEncryptedXTokens()) {
    console.log('🔐 Decrypting X credentials...');
    try {
      const password = await getPassword();
      const tokens = decryptXTokens(password);
      authToken = tokens.authToken;
      ct0 = tokens.ct0;
    } catch (err) {
      return {
        success: false,
        error: `Failed to decrypt X credentials: ${(err as Error).message}. Run: content auth x`,
        platform,
        timestamp,
      };
    }
  } else if (hasPlainXTokens()) {
    const tokens = readPlainXTokens();
    authToken = tokens.authToken;
    ct0 = tokens.ct0;
  } else {
    return {
      success: false,
      error: 'X not authenticated. Run: content auth x',
      platform,
      timestamp,
    };
  }
  
  try {
    let lastTweetId: string | undefined;
    
    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      
      if (options.verbose) {
        console.log(`Posting tweet ${i + 1}/${tweets.length}...`);
      }
      
      let result;
      
      if (i === 0) {
        result = await execa('bird', ['tweet', tweet, '--auth-token', authToken, '--ct0', ct0]);
      } else {
        result = await execa('bird', ['reply', lastTweetId!, tweet, '--auth-token', authToken, '--ct0', ct0]);
      }
      
      // Try to extract tweet ID from output
      const idMatch = result.stdout.match(/status\/(\d+)/);
      if (idMatch) {
        lastTweetId = idMatch[1];
      }
    }
    
    return {
      success: true,
      url: lastTweetId ? `https://x.com/i/status/${lastTweetId}` : undefined,
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

async function promptForTokens(): Promise<{ authToken: string; ct0: string }> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const question = (q: string) => new Promise<string>((resolve) => {
    rl.question(q, (answer) => resolve(answer.trim()));
  });
  
  console.log('Manual cookie entry (from your browser):');
  console.log('1) Open x.com, log in');
  console.log('2) Open DevTools → Application/Storage → Cookies → https://x.com');
  console.log('3) Copy the values for auth_token and ct0');
  const authToken = await question('auth_token: ');
  const ct0 = await question('ct0: ');
  rl.close();
  
  if (!authToken || !ct0) {
    throw new Error('Both auth_token and ct0 are required.');
  }
  
  return { authToken, ct0 };
}

/**
 * Auth - extract tokens from Firefox and encrypt
 */
export async function auth(): Promise<void> {
  console.log('🔍 Extracting X credentials from Firefox...');
  
  try {
    let tokens: { authToken: string; ct0: string };
    
    try {
      tokens = extractFirefoxTokens();
    } catch (err) {
      console.log('Firefox extraction failed. You can paste cookies manually.');
      tokens = await promptForTokens();
    }
    console.log('✓ Found credentials');
    
    if (isSecureSigningEnabled()) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const shouldEncrypt = await new Promise<boolean>((resolve) => {
        rl.question('Encrypt X credentials with your approval password? [Y/n] ', (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase() !== 'n');
        });
      });
      
      if (shouldEncrypt) {
        console.log('🔐 Encrypting credentials...');
        const password = await getPassword();
        encryptXTokens(tokens.authToken, tokens.ct0, password);
        console.log('✓ X credentials encrypted and saved');
      } else {
        writePlainXTokens(tokens);
        console.log('⚠ Saved X credentials unencrypted');
      }
    } else {
      writePlainXTokens(tokens);
      console.log('✓ X credentials saved');
    }
    console.log('  You can now post with: content post <file> -x');
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    console.log('');
    console.log('Make sure you are logged into x.com in Firefox or paste valid cookies.');
  }
}

const PLAIN_TOKENS_PATH = join(homedir(), '.content-pipeline', 'x-tokens.json');

function ensureConfigDir(): void {
  const dir = join(homedir(), '.content-pipeline');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writePlainXTokens(tokens: { authToken: string; ct0: string }): void {
  ensureConfigDir();
  writeFileSync(PLAIN_TOKENS_PATH, JSON.stringify(tokens, null, 2));
  chmodSync(PLAIN_TOKENS_PATH, 0o600);
}

function readPlainXTokens(): { authToken: string; ct0: string } {
  const data = JSON.parse(readFileSync(PLAIN_TOKENS_PATH, 'utf8'));
  return { authToken: data.authToken, ct0: data.ct0 };
}

function hasPlainXTokens(): boolean {
  return existsSync(PLAIN_TOKENS_PATH);
}

export const xPoster: PosterPlugin = {
  platform,
  limits,
  post,
  validate,
};

export default xPoster;
