import { getFailedLogins } from "./redis";

export interface RiskSignal {
  name: string;
  score: number;
  description: string;
  data?: Record<string, unknown>;
}

export interface RiskResult {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  decision: "allow" | "challenge" | "deny";
  signals: RiskSignal[];
}

const TOR_EXIT_PREFIXES = ["185.220.", "199.87.", "176.10."];
const VPN_PREFIXES = ["104.153.", "45.142.", "193.32."];

export async function evaluateRisk(opts: {
  ip: string;
  userAgent: string;
  userId?: string;
  fingerprint?: string;
  isNewDevice?: boolean;
  country?: string;
  previousCountry?: string;
  action: string;
}): Promise<RiskResult> {
  const signals: RiskSignal[] = [];
  let totalScore = 0;

  // ── Velocity: failed logins ───────────────────────────────────
  const failedCount = await getFailedLogins(opts.ip).catch(() => 0);
  if (failedCount >= 5) {
    const score = Math.min(failedCount * 5, 30);
    signals.push({ name: "velocity", score, description: `${failedCount} failed logins from this IP`, data: { count: failedCount } });
    totalScore += score;
  }

  // ── Tor exit node ─────────────────────────────────────────────
  const isTor = TOR_EXIT_PREFIXES.some(p => opts.ip.startsWith(p));
  if (isTor) {
    signals.push({ name: "tor_exit_node", score: 25, description: "Request from Tor exit node", data: { ip: opts.ip } });
    totalScore += 25;
  }

  // ── VPN / proxy ───────────────────────────────────────────────
  const isVPN = VPN_PREFIXES.some(p => opts.ip.startsWith(p));
  if (isVPN) {
    signals.push({ name: "vpn_proxy", score: 10, description: "Request from VPN/proxy", data: { ip: opts.ip } });
    totalScore += 10;
  }

  // ── New device ────────────────────────────────────────────────
  if (opts.isNewDevice && opts.userId) {
    signals.push({ name: "new_device", score: 15, description: "Unrecognised device fingerprint" });
    totalScore += 15;
  }

  // ── Geo anomaly ───────────────────────────────────────────────
  if (opts.country && opts.previousCountry && opts.country !== opts.previousCountry) {
    signals.push({ name: "geo_anomaly", score: 20, description: `Country changed: ${opts.previousCountry} → ${opts.country}`, data: { from: opts.previousCountry, to: opts.country } });
    totalScore += 20;
  }

  // ── Suspicious user agent ─────────────────────────────────────
  const ua = opts.userAgent.toLowerCase();
  if (!ua || ua.includes("curl") || ua.includes("python") || ua.includes("go-http")) {
    const score = !ua ? 15 : 8;
    signals.push({ name: "suspicious_ua", score, description: "Non-browser user agent detected" });
    totalScore += score;
  }

  // ── Headless browser ─────────────────────────────────────────
  if (ua.includes("headless") || ua.includes("phantomjs") || ua.includes("selenium")) {
    signals.push({ name: "headless_browser", score: 20, description: "Headless/automated browser detected" });
    totalScore += 20;
  }

  // Clamp score
  const score = Math.min(100, Math.max(0, totalScore));

  const level: RiskResult["level"] =
    score >= 80 ? "critical" :
    score >= 60 ? "high" :
    score >= 30 ? "medium" : "low";

  const decision: RiskResult["decision"] =
    score >= 80 ? "deny" :
    score >= 40 ? "challenge" : "allow";

  return { score, level, decision, signals };
}

export function riskLevelColor(level: string) {
  return { low: "green", medium: "yellow", high: "orange", critical: "red" }[level] ?? "gray";
}
