import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-dev-secret-32-chars-min");
const issuer = process.env.JWT_ISSUER ?? "auth-service-demo";
const accessTTL = parseInt(process.env.JWT_ACCESS_TTL ?? "900");
const refreshTTL = parseInt(process.env.JWT_REFRESH_TTL ?? "2592000");

export interface AuthClaims extends JWTPayload {
  sub: string;           // user ID
  email: string;
  tid: string;           // tenant ID (demo = "default")
  sid?: string;          // session ID
  did?: string;          // device ID
  dfp?: string;          // device fingerprint
  amr?: string[];        // Authentication Method References
  acr?: string;          // Authentication Context Class Reference
  risk?: number;         // risk score 0-100
  risk_lvl?: string;     // low | medium | high
  sca?: boolean;         // SCA completed
  sca_method?: string;
  ttype: string;         // access | refresh | sca_challenge
  fid?: string;          // token family ID
  roles?: string[];
}

export async function signAccessToken(claims: Omit<AuthClaims, "ttype" | "iss" | "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...claims, ttype: "access" })
    .setProtectedHeader({ alg: "HS256", kid: "demo-v1" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(`${accessTTL}s`)
    .sign(secret);
}

export async function signRefreshToken(claims: Omit<AuthClaims, "ttype" | "iss" | "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...claims, ttype: "refresh" })
    .setProtectedHeader({ alg: "HS256", kid: "demo-v1" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(`${refreshTTL}s`)
    .sign(secret);
}

export async function signSCAChallengeToken(userId: string, email: string, challengeId: string, method: string): Promise<string> {
  return new SignJWT({ sub: userId, email, ttype: "sca_challenge", sca_method: method, challenge_id: challengeId } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer });
    return payload as AuthClaims;
  } catch {
    return null;
  }
}

export function decodeTokenUnsafe(token: string): AuthClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload as AuthClaims;
  } catch {
    return null;
  }
}

export function accessTTLSeconds() { return accessTTL; }
export function refreshTTLSeconds() { return refreshTTL; }
