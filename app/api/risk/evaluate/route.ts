import { NextRequest, NextResponse } from "next/server";
import { getClientIP } from "@/lib/auth";

const TOR_PREFIXES = ["185.220.", "185.107.", "199.87.", "162.247.", "171.25.", "176.10."];
const VPN_PREFIXES = ["104.16.", "172.64.", "104.17.", "104.18.", "104.19.", "103.21."];

const DEFAULT_WEIGHTS: Record<string, number> = {
  tor_exit_node: 60,
  vpn_detected: 25,
  impossible_travel: 50,
  new_device: 20,
  geo_anomaly: 30,
  failed_logins_3: 25,
  failed_logins_5: 40,
  failed_logins_10: 70,
  suspicious_ua: 8,
  headless_browser: 45,
};

const DEFAULT_THRESHOLDS = { low: 30, medium: 60, high: 85, block: 100 };

export async function POST(req: NextRequest) {
  const realIp = getClientIP(req);
  const body = await req.json().catch(() => ({}));

  const ip: string = body.ip ?? realIp;
  const ua: string = body.userAgent ?? req.headers.get("user-agent") ?? "";
  const country: string = body.country ?? "US";
  const previousCountry: string = body.previousCountry ?? country;
  const isNewDevice: boolean = body.isNewDevice ?? false;
  const failedLogins: number = body.failedLogins ?? 0;

  const weights: Record<string, number> = { ...DEFAULT_WEIGHTS, ...(body.weights ?? {}) };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(body.thresholds ?? {}) };

  const signals: { name: string; score: number; description: string }[] = [];

  if (TOR_PREFIXES.some(p => ip.startsWith(p))) {
    signals.push({ name: "tor_exit_node", score: weights.tor_exit_node, description: "Request from known Tor exit node IP" });
  }
  if (VPN_PREFIXES.some(p => ip.startsWith(p)) && !TOR_PREFIXES.some(p => ip.startsWith(p))) {
    signals.push({ name: "vpn_detected", score: weights.vpn_detected, description: "IP matches known VPN/proxy range" });
  }
  if (country !== previousCountry && previousCountry) {
    signals.push({ name: "impossible_travel", score: weights.impossible_travel, description: `Login from ${country} but last seen in ${previousCountry}` });
  } else if (country !== "US" && country !== previousCountry) {
    signals.push({ name: "geo_anomaly", score: weights.geo_anomaly, description: `Unusual country: ${country}` });
  }
  if (isNewDevice) {
    signals.push({ name: "new_device", score: weights.new_device, description: "Device fingerprint not seen before" });
  }
  if (failedLogins >= 10) {
    signals.push({ name: "failed_logins_10", score: weights.failed_logins_10, description: `${failedLogins} failed logins in last hour` });
  } else if (failedLogins >= 5) {
    signals.push({ name: "failed_logins_5", score: weights.failed_logins_5, description: `${failedLogins} failed logins in last hour` });
  } else if (failedLogins >= 3) {
    signals.push({ name: "failed_logins_3", score: weights.failed_logins_3, description: `${failedLogins} failed logins in last hour` });
  }
  const uaLower = ua.toLowerCase();
  if (uaLower.includes("headlesschrome") || uaLower.includes("phantomjs") || uaLower.includes("puppeteer") || uaLower.includes("playwright")) {
    signals.push({ name: "headless_browser", score: weights.headless_browser, description: "Headless/automated browser detected" });
  } else if (!uaLower.includes("mozilla") && !uaLower.includes("apple") && ua.length > 0) {
    signals.push({ name: "suspicious_ua", score: weights.suspicious_ua, description: "Non-browser user agent detected" });
  }

  const score = Math.min(100, signals.reduce((acc, s) => acc + s.score, 0));

  let level: string;
  let decision: string;
  if (score >= thresholds.block) {
    level = "critical"; decision = "block";
  } else if (score >= thresholds.high) {
    level = "high"; decision = "challenge";
  } else if (score >= thresholds.medium) {
    level = "high"; decision = "mfa_required";
  } else if (score >= thresholds.low) {
    level = "medium"; decision = "step_up";
  } else {
    level = "low"; decision = "allow";
  }

  return NextResponse.json({ score, level, decision, signals, thresholds, ip });
}
