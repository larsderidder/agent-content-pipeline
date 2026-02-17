/**
 * Reddit Poster (built-in)
 * Uses snoowrap API wrapper with encrypted credential storage
 */

import Snoowrap from 'snoowrap';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createInterface } from 'readline';
import type { PosterPlugin, PostOptions, PostResult, ValidationResult } from '../types.js';
import { getPassword, isSecureSigningEnabled } from '../signing.js';

export const platform = 'reddit';

export const limits = {
  maxTitleLength: 300,
  maxSelfTextLength: 40000,
};

const ALGORITHM = 'aes-256-gcm';
const CREDENTIALS_FILE = join(homedir(), '.content-pipeline', 'reddit-credentials.enc');

interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  userAgent: string;
}

interface EncryptedData {
  salt: string;
  iv: string;
  authTag: string;
  encrypted: string;
}

interface RedditPostFrontmatter {
  subreddit: string;
  title?: string;
  flair?: string;
  nsfw?: boolean;
  spoiler?: boolean;
}

/**
 * Encrypt credentials
 */
function encryptCredentials(credentials: RedditCredentials, password: string): void {
  const configDir = join(homedir(), '.content-pipeline');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  const data = JSON.stringify(credentials);
  const salt = randomBytes(32);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(16);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  const output: EncryptedData = {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted,
  };
  
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(output, null, 2));
}

/**
 * Decrypt credentials
 */
function decryptCredentials(password: string): RedditCredentials {
  if (!existsSync(CREDENTIALS_FILE)) {
    throw new Error('Reddit not authenticated. Run: content auth reddit');
  }
  
  const input: EncryptedData = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'));
  
  const salt = Buffer.from(input.salt, 'base64');
  const key = scryptSync(password, salt, 32);
  const iv = Buffer.from(input.iv, 'base64');
  const authTag = Buffer.from(input.authTag, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(input.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

/**
 * Check if encrypted credentials exist
 */
export function hasEncryptedCredentials(): boolean {
  return existsSync(CREDENTIALS_FILE);
}

/**
 * Prompt for input
 */
function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      
      if (stdin.isTTY && stdin.setRawMode) {
        stdin.setRawMode(true);
      }
      
      let input = '';
      
      const onData = (char: Buffer) => {
        const c = char.toString('utf8');
        
        if (c === '\n' || c === '\r') {
          stdin.removeListener('data', onData);
          if (stdin.isTTY && stdin.setRawMode) {
            stdin.setRawMode(wasRaw ?? false);
          }
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u0003') {
          process.exit(1);
        } else if (c === '\u007F' || c === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += c;
        }
      };
      
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * Parse Reddit-specific frontmatter
 */
function parseRedditFrontmatter(frontmatter: Record<string, unknown>): RedditPostFrontmatter {
  const subreddit = frontmatter.subreddit as string;
  if (!subreddit) {
    throw new Error('Missing required frontmatter: subreddit');
  }
  
  return {
    subreddit: subreddit.replace(/^r\//, ''), // Remove r/ prefix if present
    title: frontmatter.title as string | undefined,
    flair: frontmatter.flair as string | undefined,
    nsfw: frontmatter.nsfw as boolean | undefined,
    spoiler: frontmatter.spoiler as boolean | undefined,
  };
}

export async function validate(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (content.length > limits.maxSelfTextLength) {
    errors.push(`Content exceeds Reddit limit (${content.length}/${limits.maxSelfTextLength} chars)`);
  }
  
  if (content.length > 10000) {
    warnings.push('Very long posts may get less engagement');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export async function post(content: string, options: PostOptions): Promise<PostResult> {
  const timestamp = new Date().toISOString();
  
  if (!hasEncryptedCredentials()) {
    return {
      success: false,
      error: 'Reddit not authenticated. Run: content auth reddit',
      platform,
      timestamp,
    };
  }
  
  // Get password and decrypt credentials
  let credentials: RedditCredentials;
  try {
    console.log('🔐 Decrypting Reddit credentials...');
    const password = await getPassword();
    credentials = decryptCredentials(password);
  } catch (err) {
    return {
      success: false,
      error: `Failed to decrypt credentials: ${(err as Error).message}`,
      platform,
      timestamp,
    };
  }
  
  // Parse frontmatter for Reddit-specific fields
  const config = options.config as unknown as Record<string, unknown> & { frontmatter?: Record<string, unknown> } | undefined;
  const frontmatter = config?.frontmatter || {};
  
  let redditMeta: RedditPostFrontmatter;
  try {
    redditMeta = parseRedditFrontmatter(frontmatter);
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
      platform,
      timestamp,
    };
  }
  
  // Extract title from first line if not in frontmatter
  let title = redditMeta.title;
  let bodyContent = content;
  
  if (!title) {
    // Use first line as title
    const lines = content.split('\n');
    title = lines[0].replace(/^#\s*/, '').trim(); // Remove markdown heading if present
    bodyContent = lines.slice(1).join('\n').trim();
  }
  
  if (!title) {
    return {
      success: false,
      error: 'No title found. Add title: in frontmatter or use first line as title.',
      platform,
      timestamp,
    };
  }
  
  if (title.length > limits.maxTitleLength) {
    return {
      success: false,
      error: `Title exceeds limit (${title.length}/${limits.maxTitleLength} chars)`,
      platform,
      timestamp,
    };
  }
  
  if (options.dryRun) {
    return {
      success: true,
      platform,
      timestamp,
      error: `Dry run - would post to r/${redditMeta.subreddit}: "${title}"`,
    };
  }
  
  try {
    // Create snoowrap instance
    const reddit = new Snoowrap({
      userAgent: credentials.userAgent,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
    });
    
    // Submit the post using the main snoowrap method
    const submission = await reddit.submitSelfpost({
      subredditName: redditMeta.subreddit,
      title,
      text: bodyContent,
      sendReplies: true,
      nsfw: redditMeta.nsfw,
      spoiler: redditMeta.spoiler,
    });
    
    // Get the permalink
    const permalink = submission.permalink || submission.name;
    const postUrl = permalink.startsWith('http') ? permalink : `https://reddit.com${permalink}`;
    
    return {
      success: true,
      url: postUrl,
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

/**
 * Auth - collect and encrypt Reddit API credentials
 */
export async function auth(): Promise<void> {
  console.log('🔧 Reddit API Setup\n');
  console.log('You need a Reddit "script" app. Create one at:');
  console.log('  https://www.reddit.com/prefs/apps\n');
  console.log('Click "create app" or "create another app"');
  console.log('  - Name: content (or anything)');
  console.log('  - Type: script');
  console.log('  - Redirect URI: http://localhost:8080 (not used)\n');
  
  const clientId = await prompt('Client ID (under "personal use script"): ');
  const clientSecret = await prompt('Client Secret: ', true);
  const inputUsername = await prompt('Reddit username: ');
  const redditPassword = await prompt('Reddit password: ', true);
  
  const userAgent = `agent-content-pipeline:v1.0.0 (by /u/${inputUsername})`;
  
  // Verify credentials work
  console.log('\n🔍 Verifying credentials...');
  
  try {
    const reddit = new Snoowrap({
      userAgent,
      clientId,
      clientSecret,
      username: inputUsername,
      password: redditPassword,
    });
    
    // Test the connection
    const me = await reddit.getMe();
    console.log(`✓ Authenticated as /u/${me.name}`);
    
    // Encrypt and save
    console.log('🔐 Encrypting credentials...');
    
    if (isSecureSigningEnabled()) {
      const encPassword = await getPassword();
      encryptCredentials({
        clientId,
        clientSecret,
        username: inputUsername,
        password: redditPassword,
        userAgent,
      }, encPassword);
    } else {
      // Use a simple password for now
      const encPassword = await prompt('Create a password to encrypt credentials: ', true);
      const confirmPassword = await prompt('Confirm password: ', true);
      
      if (encPassword !== confirmPassword) {
        console.error('❌ Passwords do not match');
        return;
      }
      
      if (encPassword.length < 8) {
        console.error('❌ Password must be at least 8 characters');
        return;
      }
      
      encryptCredentials({
        clientId,
        clientSecret,
        username: inputUsername,
        password: redditPassword,
        userAgent,
      }, encPassword);
    }
    
    console.log('✓ Reddit credentials encrypted and saved');
    console.log('  You can now post with: content post <file>');
    
  } catch (err) {
    console.error(`❌ Authentication failed: ${(err as Error).message}`);
    console.log('');
    console.log('Common issues:');
    console.log('  - Wrong client ID or secret');
    console.log('  - Wrong username or password');
    console.log('  - 2FA enabled (disable it or use app passwords)');
  }
}

export const redditPoster: PosterPlugin = {
  platform,
  limits: {
    maxLength: limits.maxSelfTextLength,
  },
  post,
  validate,
};

export default redditPoster;
