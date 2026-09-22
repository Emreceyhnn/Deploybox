import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Deliberately a separate secret from JWT_SECRET: that key signs/encrypts
// session JWTs, this one protects data at rest (GitHub access tokens,
// webhook secrets). Sharing one key between the two means a JWT_SECRET leak
// (or rotation) simultaneously compromises — or breaks decryption of —
// every stored secret in the database, and neither can be rotated
// independently of the other.
function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not set; cannot encrypt/decrypt secrets");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    ".",
  );
}

export function decryptSecret(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
