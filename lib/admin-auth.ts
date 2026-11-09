import { type NextRequest } from "next/server";
import { verifyToken, type AuthClaims } from "@/lib/jwt";
import { verifyApiKey, type ApiKeyContext } from "@/lib/api-key-auth";

/**
 * Authenticates admin API requests.
 * Priority: access_token cookie → refresh_token cookie (fallback) → X-API-Key header.
 * The refresh_token fallback lets requests succeed when the short-lived access token
 * has expired but the user's session is still valid — avoiding spurious 401s in the UI.
 */
export async function adminAuth(req: NextRequest): Promise<AuthClaims | null> {
  // 1. Valid access token
  const accessToken = req.cookies.get("access_token")?.value;
  if (accessToken) {
    const claims = await verifyToken(accessToken);
    if (claims) return claims;
  }

  // 2. Fallback: valid refresh token (ttype = "refresh")
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (refreshToken) {
    const claims = await verifyToken(refreshToken);
    if (claims && claims.ttype === "refresh") return claims;
  }

  // 3. API key
  const apiAuth: ApiKeyContext | null = await verifyApiKey(req as unknown as Request);
  if (apiAuth) {
    return { sub: "api", email: apiAuth.email ?? "api", tid: apiAuth.tid, ttype: "access" } as AuthClaims;
  }

  return null;
}
