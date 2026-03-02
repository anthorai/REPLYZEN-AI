// =========================================================
// REPLIFY AI - AES-256-GCM Encryption Module
// Section 5: Gmail Token Encryption
// =========================================================

import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

export class TokenEncryption {
  private static async getKey(): Promise<CryptoKey> {
    if (!ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY environment variable is not set");
    }
    
    // Derive key from environment variable using PBKDF2
    const encoder = new TextEncoder();
    const keyData = encoder.encode(ENCRYPTION_KEY);
    
    // Use the first 32 bytes of the key or hash it
    const keyBuffer = await crypto.subtle.digest("SHA-256", keyData);
    
    return await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: ALGORITHM },
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    if (!plaintext) {
      throw new Error("Cannot encrypt empty string");
    }

    try {
      const key = await this.getKey();
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      const encrypted = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
        key,
        data
      );

      return {
        ciphertext: base64Encode(new Uint8Array(encrypted)),
        iv: base64Encode(iv)
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  static async decrypt(ciphertext: string, iv: string): Promise<string> {
    if (!ciphertext || !iv) {
      throw new Error("Cannot decrypt: missing ciphertext or IV");
    }

    try {
      const key = await this.getKey();
      const encryptedData = base64Decode(ciphertext);
      const ivData = base64Decode(iv);

      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: ivData, tagLength: TAG_LENGTH },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  static async encryptToken(token: string): Promise<{ encrypted: string; iv: string }> {
    const result = await this.encrypt(token);
    return {
      encrypted: result.ciphertext,
      iv: result.iv
    };
  }

  static async decryptToken(encrypted: string, iv: string): Promise<string> {
    return await this.decrypt(encrypted, iv);
  }
}

// Migration helper to encrypt existing tokens
export async function migratePlaintextTokens(supabase: any): Promise<{ migrated: number; failed: number }> {
  const { data: accounts, error } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token")
    .is("access_token_iv", null);

  if (error) {
    throw new Error(`Failed to fetch accounts for migration: ${error.message}`);
  }

  let migrated = 0;
  let failed = 0;

  for (const account of accounts || []) {
    try {
      const updates: any = {};

      if (account.access_token) {
        const accessResult = await TokenEncryption.encryptToken(account.access_token);
        updates.access_token = accessResult.encrypted;
        updates.access_token_iv = accessResult.iv;
      }

      if (account.refresh_token) {
        const refreshResult = await TokenEncryption.encryptToken(account.refresh_token);
        updates.refresh_token = refreshResult.encrypted;
        updates.refresh_token_iv = refreshResult.iv;
      }

      updates.encryption_version = 1;

      const { error: updateError } = await supabase
        .from("email_accounts")
        .update(updates)
        .eq("id", account.id);

      if (updateError) {
        console.error(`Failed to migrate account ${account.id}:`, updateError);
        failed++;
      } else {
        migrated++;
      }
    } catch (err) {
      console.error(`Error migrating account ${account.id}:`, err);
      failed++;
    }
  }

  return { migrated, failed };
}
