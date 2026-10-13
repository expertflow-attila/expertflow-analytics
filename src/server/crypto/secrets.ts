import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

export function encryptSecret(plain: string, key: Buffer): { iv: string; tag: string; data: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex")
  };
}

export function decryptSecret(enc: { iv: string; tag: string; data: string }, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(enc.iv, "hex"));
  decipher.setAuthTag(Buffer.from(enc.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export const cryptoNote = "Use a 32-byte key from env (e.g. SECRETS_KEY). Never log plain secrets.";
