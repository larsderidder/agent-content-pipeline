import { describe, it, expect } from 'vitest';
import { generateKeypair, signContent, verifySignature, hashContent } from './signing.js';

describe('signing', () => {
  it('generates valid Ed25519 keypairs', () => {
    const { publicKey, privateKey } = generateKeypair();
    expect(publicKey).toContain('BEGIN PUBLIC KEY');
    expect(privateKey).toContain('BEGIN PRIVATE KEY');
  });

  it('produces consistent content hashes', () => {
    const content = 'Hello, world!';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('produces different hashes for different content', () => {
    const hash1 = hashContent('Hello');
    const hash2 = hashContent('World');
    expect(hash1).not.toBe(hash2);
  });

  it('signs and verifies content correctly', () => {
    const { publicKey, privateKey } = generateKeypair();
    const content = 'This is my approved content.';
    
    const signature = signContent(content, privateKey);
    expect(signature).toBeTruthy();
    
    const isValid = verifySignature(content, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it('rejects tampered content', () => {
    const { publicKey, privateKey } = generateKeypair();
    const content = 'Original content';
    const tamperedContent = 'Tampered content';
    
    const signature = signContent(content, privateKey);
    
    const isValid = verifySignature(tamperedContent, signature, publicKey);
    expect(isValid).toBe(false);
  });

  it('rejects invalid signatures', () => {
    const { publicKey } = generateKeypair();
    const content = 'Some content';
    const fakeSignature = 'not-a-valid-signature';
    
    const isValid = verifySignature(content, fakeSignature, publicKey);
    expect(isValid).toBe(false);
  });

  it('rejects signatures from wrong key', () => {
    const keyPair1 = generateKeypair();
    const keyPair2 = generateKeypair();
    const content = 'Content signed by key 1';
    
    const signature = signContent(content, keyPair1.privateKey);
    
    // Verify with wrong public key
    const isValid = verifySignature(content, signature, keyPair2.publicKey);
    expect(isValid).toBe(false);
  });
});
