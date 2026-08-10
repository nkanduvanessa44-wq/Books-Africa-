
/**
 * Encryption utility for protecting digital manuscripts in local storage.
 * Uses AES-GCM (Advanced Encryption Standard with Galois/Counter Mode).
 */

const KEY_ALGORITHM = { name: 'AES-GCM', length: 256 };

// Internal seed for key derivation (In a production app, this might be combined with user specific data)
const INTERNAL_SEED = new TextEncoder().encode('bookworld-zm-manuscript-protection-v1');

async function getEncryptionKey(): Promise<CryptoKey> {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    INTERNAL_SEED,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: INTERNAL_SEED,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    KEY_ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBlob(blob: Blob): Promise<ArrayBuffer> {
  const key = await getEncryptionKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector
  const data = await blob.arrayBuffer();

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV and Encrypted Content for storage
  const result = new Uint8Array(iv.length + encryptedContent.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encryptedContent), iv.length);
  
  return result.buffer;
}

export async function decryptToBlob(encryptedData: ArrayBuffer, mimeType: string = 'application/pdf'): Promise<Blob> {
  const key = await getEncryptionKey();
  const dataView = new Uint8Array(encryptedData);
  
  const iv = dataView.slice(0, 12);
  const encryptedContent = dataView.slice(12);

  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedContent
  );

  return new Blob([decryptedContent], { type: mimeType });
}
