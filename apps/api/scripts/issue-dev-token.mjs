import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { Buffer } from "node:buffer";
import process from "node:process";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development token generation is disabled in production");
}

function readArgument(name) {
  const position = process.argv.indexOf(`--${name}`);
  return position === -1 ? undefined : process.argv[position + 1];
}

const issuer = readArgument("issuer");
const audience = readArgument("audience");
const subject = readArgument("subject");
const ttl = Number(readArgument("ttl") ?? "900");

if (!issuer || !audience || !subject) {
  throw new Error(
    "Usage: --issuer <url> --audience <value> --subject <external-subject> [--ttl 900]",
  );
}

if (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600) {
  throw new Error("TTL must be an integer between 60 and 3600 seconds");
}

const { privateKey, publicKey } = await generateKeyPair("RS256");
const publicKeyPem = await exportSPKI(publicKey);
const now = Math.floor(Date.now() / 1000);
const token = await new SignJWT({})
  .setProtectedHeader({ alg: "RS256", typ: "JWT" })
  .setIssuer(issuer)
  .setSubject(subject)
  .setAudience(audience)
  .setIssuedAt(now)
  .setExpirationTime(now + ttl)
  .sign(privateKey);

process.stdout.write(
  JSON.stringify(
    {
      expiresInSeconds: ttl,
      publicKeyBase64: Buffer.from(publicKeyPem).toString("base64"),
      token,
    },
    null,
    2,
  ) + "\n",
);
