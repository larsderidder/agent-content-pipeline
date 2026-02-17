/**
 * LinkedIn Poster (built-in)
 * Uses Playwright browser automation with encrypted profile support
 */

import { chromium, type BrowserContext } from 'playwright';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { randomBytes } from 'crypto';
import type { PosterPlugin, PostOptions, PostResult, ValidationResult } from '../types.js';
import { isSecureSigningEnabled, encryptDirectory, decryptDirectory, getPassword } from '../signing.js';

export const platform = 'linkedin';

export const limits = {
  maxLength: 3000,
  maxImages: 9,
  maxVideos: 1,
};

const DEFAULT_PROFILE_DIR = join(homedir(), '.content-pipeline', 'linkedin-profile');

export async function validate(content: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (content.length > limits.maxLength) {
    errors.push(`Content exceeds LinkedIn limit (${content.length}/${limits.maxLength} chars)`);
  }
  
  if (content.length > 2500) {
    warnings.push('Long posts may get truncated in feeds');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export async function post(content: string, options: PostOptions): Promise<PostResult> {
  const timestamp = new Date().toISOString();
  const encryptedProfile = join(homedir(), '.content-pipeline', 'linkedin-profile.enc');
  const isEncrypted = existsSync(encryptedProfile);
  
  let profileDir = options.profileDir || DEFAULT_PROFILE_DIR;
  let tempDir: string | null = null;
  let password: string | undefined;
  
  // If encrypted profile exists, decrypt to temp dir
  if (isEncrypted && isSecureSigningEnabled()) {
    try {
      password = options.password || await getPassword();
      tempDir = join(tmpdir(), `content-pipeline-${randomBytes(8).toString('hex')}`);
      mkdirSync(tempDir, { recursive: true });
      decryptDirectory(encryptedProfile, tempDir, password);
      profileDir = join(tempDir, 'linkedin-profile');
    } catch (err) {
      return {
        success: false,
        error: `Failed to decrypt profile: ${(err as Error).message}`,
        platform,
        timestamp,
      };
    }
  } else if (!existsSync(profileDir)) {
    return {
      success: false,
      error: 'Not logged in. Run: content auth linkedin',
      platform,
      timestamp,
    };
  }
  
  let context: BrowserContext | null = null;
  
  try {
    // Launch browser with persistent context (use system Chrome)
    context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome', // Use system Chrome instead of bundled Chromium
      headless: false, // LinkedIn detects headless
      viewport: { width: 1280, height: 800 },
    });
    
    const page = await context.newPage();
    
    // Navigate to LinkedIn feed
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    
    // Check if logged in
    const isLoggedIn = await page.locator('[data-control-name="identity_welcome_message"]').count() > 0 ||
                       await page.locator('.feed-identity-module').count() > 0;
    
    if (!isLoggedIn) {
      const onLoginPage = page.url().includes('/login') || 
                          await page.locator('input[name="session_key"]').count() > 0;
      
      if (onLoginPage) {
        return {
          success: false,
          error: 'Not logged in. Run: content auth linkedin',
          platform,
          timestamp,
        };
      }
    }
    
    // Click "Start a post" button
    const startPostButton = page.locator('button:has-text("Start a post")').first();
    await startPostButton.click();
    
    // Wait for post modal
    await page.waitForSelector('.share-creation-state__text-editor', { timeout: 10000 });
    
    // Type content
    const editor = page.locator('.share-creation-state__text-editor .ql-editor');
    await editor.fill(content);
    
    // Wait a moment for content to settle
    await page.waitForTimeout(1000);
    
    if (options.dryRun) {
      const closeButton = page.locator('button[aria-label="Dismiss"]').first();
      await closeButton.click();
      
      return {
        success: true,
        platform,
        timestamp,
        error: 'Dry run - post modal opened but not submitted',
      };
    }
    
    // Click Post button
    const postButton = page.locator('button:has-text("Post")').last();
    await postButton.click();
    
    // Wait for post to complete
    await page.waitForTimeout(3000);
    
    return {
      success: true,
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
  } finally {
    if (context) {
      await context.close();
    }
    // Clean up temp dir if we used one
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Interactive auth - opens browser for user to log in
 */
export async function auth(profileDir?: string): Promise<void> {
  const dir = profileDir || DEFAULT_PROFILE_DIR;
  const encryptedProfile = join(homedir(), '.content-pipeline', 'linkedin-profile.enc');
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  console.log('Opening browser for LinkedIn login...');
  
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chrome', // Use system Chrome
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login');
  
  console.log('\n👆 Please log in to LinkedIn in the browser window.');
  console.log('   Once logged in, close the browser to save your session.\n');
  
  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
  });
  
  // Verify login success by reopening the profile
  let loggedIn = false;
  let verifyContext: BrowserContext | null = null;
  try {
    verifyContext = await chromium.launchPersistentContext(dir, {
      channel: 'chrome',
      headless: false,
      viewport: { width: 1280, height: 800 },
    });
    const verifyPage = await verifyContext.newPage();
    await verifyPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    const isLoggedIn = await verifyPage.locator('[data-control-name="identity_welcome_message"]').count() > 0 ||
                       await verifyPage.locator('.feed-identity-module').count() > 0;
    loggedIn = isLoggedIn;
  } catch {
    loggedIn = false;
  } finally {
    if (verifyContext) await verifyContext.close();
  }

  if (!loggedIn) {
    console.error('⚠ Login not detected. Please try again.');
    return;
  }
  
  // If secure signing is enabled, encrypt the profile
  if (isSecureSigningEnabled()) {
    console.log('🔐 Encrypting profile...');
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const password = await getPassword();
        encryptDirectory(dir, encryptedProfile, password);
        // Remove unencrypted profile
        rmSync(dir, { recursive: true, force: true });
        console.log('✓ Profile encrypted. Unencrypted profile removed.');
        break;
      } catch (err) {
        attempts++;
        if (attempts < maxAttempts) {
          console.error(`⚠ ${(err as Error).message}. Try again (${maxAttempts - attempts} attempts left).`);
        } else {
          console.error(`⚠ Failed to encrypt profile after ${maxAttempts} attempts.`);
          console.log('  Profile saved unencrypted.');
        }
      }
    }
  } else {
    console.log('✓ Session saved. You can now post without logging in again.');
    console.log('💡 Tip: Run "content init --secure" to encrypt credentials.');
  }
}

export const linkedinPoster: PosterPlugin = {
  platform,
  limits,
  post,
  validate,
};

export default linkedinPoster;
