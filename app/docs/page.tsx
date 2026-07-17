import Link from "next/link";
import { BookOpen, Code, ChevronRight } from "lucide-react";

function UthNav() {
  return (<nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 bg-zinc-950 sticky top-0 z-50"><Link href="/" className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-[10px]">UTH</span></div><span className="font-black text-sm tracking-tighter"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span></Link><div className="flex gap-4 ml-4"><Link href="/docs" className="text-white text-sm font-medium">Docs</Link><Link href="/docs/swagger" className="text-zinc-400 hover:text-white text-sm">API Reference</Link></div><Link href="/onboarding" className="ml-auto text-indigo-400 hover:text-indigo-300 text-sm">Get started →</Link></nav>);
}

const ENDPOINTS = [
  { method:"POST", path:"/api/auth/register", tag:"auth", summary:"Register new user", body:'{ "email": "...", "password": "...", "displayName": "..." }', response:'{ "userId": "...", "token": "..." }' },
  { method:"POST", path:"/api/auth/login", tag:"auth", summary:"Authenticate user", body:'{ "email": "...", "password": "...", "fingerprint": "..." }', response:'{ "user": {...}, "scaRequired": false, "risk": {...} }' },
  { method:"POST", path:"/api/auth/logout", tag:"auth", summary:"Revoke session", body:"—", response:'{ "success": true }' },
  { method:"GET", path:"/api/auth/me", tag:"auth", summary:"Get current session + claims", body:"—", response:'{ "user": {...}, "claims": { "sub":"...", "acr":"...", "risk":0 } }' },
  { method:"POST", path:"/api/auth-risk", tag:"risk", summary:"Evaluate Auth Risk (Device Trust + Network/Geo)", body:'{ "signals": { "knownDevice":true, "rootedDevice":false, ... }, "ip":"..." }', response:'{ "score":0, "level":"low", "decision":"ALLOW", "signals":[...] }' },
  { method:"POST", path:"/api/engine-risk", tag:"risk", summary:"Evaluate Engine Risk (4 layers, 50/50 consolidation)", body:'{ "authRiskScore":10, "failedLoginsLast24h":0, "operationType":"payment", "amount":250, ... }', response:'{ "finalRiskScore":8, "engineRiskScore":5, "decision":"ALLOW", "layers":{...} }' },
  { method:"POST", path:"/api/risk/evaluate", tag:"risk", summary:"Standalone risk evaluate (for risky operations outside login)", body:'{ "context":"payment", "operationType":"payment", "amount":"250.00", "signals":{...}, "ip":"..." }', response:'{ "evaluationId":"...", "score":15, "level":"low", "decision":"ALLOW", "requiredAction":null }' },
  { method:"POST", path:"/api/sca/challenge", tag:"sca", summary:"Create single-use SCA challenge with dynamic linking", body:'{ "method":"totp", "amount":"250.00", "iban":"...", "currency":"EUR", "operationType":"payment" }', response:'{ "challengeId":"...", "ttl":600, "method":"totp" }' },
  { method:"POST", path:"/api/sca/verify", tag:"sca", summary:"Verify SCA challenge — returns ALLOW or DENY only", body:'{ "challengeId":"...", "method":"totp", "otp":"123456" }', response:'{ "result":"ALLOW", "jwtClaims":{ "sca":true, "acr":"silver", "sca_method":"totp" } }' },
  { method:"POST", path:"/api/sca/totp-enroll", tag:"sca", summary:"Enroll TOTP authenticator app", body:'{ "userId":"..." }', response:'{ "qrCode":"data:image/png;base64,...", "secret":"..." }' },
  { method:"POST", path:"/api/device-attestation", tag:"attestation", summary:"Evaluate device attestation (18 signals → 5 statuses)", body:'{ "signals":{ "KD":true, "ROOT":false, ... }, "platform":"ios", "deviceId":"..." }', response:'{ "status":"healthy", "trustScore":85, "dba":"allowed", "signals":{...} }' },
  { method:"GET", path:"/api/devices", tag:"attestation", summary:"List bound devices for current user", body:"—", response:'[{ "id":"...", "fingerprint":"...", "state":"bound", "platform":"ios" }]' },
  { method:"POST", path:"/api/webauthn/register/begin", tag:"webauthn", summary:"Begin WebAuthn registration — returns PublicKeyCredentialCreationOptions", body:'{ "email":"..." }', response:'{ "options": { "challenge":"...", "rp":{...} } }' },
  { method:"POST", path:"/api/webauthn/register/finish", tag:"webauthn", summary:"Complete registration, store credential", body:'{ "email":"...", "response":{...} }', response:'{ "verified":true, "credentialId":"..." }' },
  { method:"POST", path:"/api/webauthn/auth/begin", tag:"webauthn", summary:"Begin WebAuthn authentication", body:'{ "email":"..." }', response:'{ "options": { "challenge":"...", "allowCredentials":[...] } }' },
  { method:"POST", path:"/api/webauthn/auth/finish", tag:"webauthn", summary:"Complete authentication, issue JWT", body:'{ "email":"...", "response":{...} }', response:'{ "verified":true, "token":"eyJ..." }' },
  { method:"GET", path:"/api/jwks", tag:"jwt", summary:"JSON Web Key Set — public keys for RS256 verification", body:"—", response:'{ "keys":[{ "kty":"RSA", "kid":"v1", ... }] }' },
  { method:"GET", path:"/api/sessions", tag:"sessions", summary:"List active sessions for current user", body:"—", response:'{ "sessions":[{ "sid":"...", "acr":"...", "risk_lvl":"low" }] }' },
  { method:"DELETE", path:"/api/sessions", tag:"sessions", summary:"Revoke a session by ID", body:'{ "sessionId":"..." }', response:'{ "success":true }' },
  { method:"POST", path:"/api/tenants", tag:"tenants", summary:"Create new tenant (onboarding)", body:'{ "name":"...", "domain":"...", "plan":"starter" }', response:'{ "tenantId":"...", "apiKey":"uth_live_..." }' },
  { method:"GET", path:"/api/transactions", tag:"admin", summary:"List auth transactions for tenant (paginated)", body:"—", response:'{ "transactions":[...], "total":42 }' },
  { method:"GET", path:"/api/admin/users", tag:"admin", summary:"List all users in tenant with risk + session summary", body:"—", response:'{ "users":[{ "id":"...", "email":"...", "last_risk":"low", "total_sessions":5 }] }' },
  { method:"GET", path:"/api/admin/risk-rules", tag:"admin", summary:"Get tenant risk rule configuration", body:"—", response:'{ "rules":{ "thresholds":{...}, "overrides":[...], "deviceAttestation":{...} } }' },
  { method:"PUT", path:"/api/admin/risk-rules", tag:"admin", summary:"Update tenant risk rules", body:'{ "thresholds":{...}, "overrides":[...], "deviceAttestation":{...} }', response:'{ "success":true }' },
];

const TAGS: Record<string,string> = { auth:"Authentication",risk:"Risk Engine",sca:"SCA / PSD2",attestation:"Device Attestation",webauthn:"WebAuthn / Passkeys",jwt:"JWT / JWKS",sessions:"Sessions",tenants:"Tenants",admin:"Admin / Dashboard" };
const TAG_COLORS: Record<string,string> = { auth:"bg-blue-500/20 text-blue-300 border-blue-500/30",risk:"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",sca:"bg-red-500/20 text-red-300 border-red-500/30",attestation:"bg-green-500/20 text-green-300 border-green-500/30",webauthn:"bg-purple-500/20 text-purple-300 border-purple-500/30",jwt:"bg-zinc-700 text-zinc-300 border-zinc-600",sessions:"bg-indigo-500/20 text-indigo-300 border-indigo-500/30",tenants:"bg-pink-500/20 text-pink-300 border-pink-500/30",admin:"bg-orange-500/20 text-orange-300 border-orange-500/30" };
const METHOD_COLORS: Record<string,string> = { GET:"text-green-400",POST:"text-blue-400",PUT:"text-yellow-400",DELETE:"text-red-400",PATCH:"text-orange-400" };

export default function DocsPage() {
  const groups = Object.entries(TAGS).map(([tag,label])=>({ tag, label, endpoints: ENDPOINTS.filter(e=>e.tag===tag) }));
  return (<div className="min-h-screen bg-zinc-950 text-white"><UthNav />
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10"><div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">API Reference · v1</div><h1 className="text-4xl font-black text-white mb-3">UTH REST API</h1><p className="text-zinc-400 text-lg">All endpoints are REST/JSON. Base URL: <code className="text-indigo-300 font-mono bg-zinc-900 px-1.5 py-0.5 rounded">https://auth-demo-rouge.vercel.app</code></p></div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-10">
        <h3 className="text-white font-semibold mb-3">Authentication</h3>
        <p className="text-zinc-400 text-sm mb-3">Session-based: UTH sets HttpOnly cookies (<code className="text-indigo-300 font-mono">access_token</code>, <code className="text-indigo-300 font-mono">refresh_token</code>) on login. Include cookies in all subsequent requests. Access tokens expire after 15 minutes.</p>
        <pre className="bg-zinc-950 rounded-lg p-3 text-xs font-mono text-zinc-400 overflow-auto">{`# Login and save cookies
curl -c cookies.txt -X POST https://auth-demo-rouge.vercel.app/api/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","password":"yourpass"}'

# Use saved cookies for subsequent calls
curl -b cookies.txt https://auth-demo-rouge.vercel.app/api/auth/me

# Standalone risk evaluate during a payment operation
curl -b cookies.txt -X POST https://auth-demo-rouge.vercel.app/api/risk/evaluate \\
  -H 'Content-Type: application/json' \\
  -d '{"context":"payment","amount":"500.00","currency":"EUR","signals":{"knownDevice":true,"vpnDetected":false}}'`}</pre>
      </div>

      <div className="space-y-10">{groups.map(({ tag, label, endpoints })=>endpoints.length===0?null:(<div key={tag}>
        <div className="flex items-center gap-3 mb-4"><span className={`text-xs border px-2.5 py-1 rounded-full font-mono ${TAG_COLORS[tag]}`}>{tag}</span><h2 className="text-xl font-bold text-white">{label}</h2></div>
        <div className="space-y-3">{endpoints.map(ep=>(<details key={ep.path+ep.method} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden group">
          <summary className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-zinc-800/50 list-none">
            <span className={`font-mono font-bold text-sm w-14 shrink-0 ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
            <code className="text-zinc-200 text-sm font-mono">{ep.path}</code>
            <span className="text-zinc-500 text-sm ml-2 hidden sm:block">{ep.summary}</span>
            <ChevronRight className="w-4 h-4 text-zinc-600 ml-auto group-open:rotate-90 transition-transform"/>
          </summary>
          <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
            <p className="text-zinc-300 text-sm">{ep.summary}</p>
            {ep.body!=="—"&&(<div><p className="text-zinc-500 text-xs uppercase tracking-wide mb-1.5">Request body</p><pre className="bg-zinc-950 rounded-lg p-3 text-xs font-mono text-indigo-300 overflow-auto">{ep.body}</pre></div>)}
            <div><p className="text-zinc-500 text-xs uppercase tracking-wide mb-1.5">Response (200)</p><pre className="bg-zinc-950 rounded-lg p-3 text-xs font-mono text-green-300 overflow-auto">{ep.response}</pre></div>
          </div>
        </details>))}</div>
      </div>))}</div>

      <div className="mt-12 rounded-xl border border-indigo-500/30 bg-indigo-600/5 p-6 text-center"><BookOpen className="w-8 h-8 text-indigo-400 mx-auto mb-3"/><p className="text-white font-semibold mb-1">Need an API key or SDK?</p><p className="text-zinc-400 text-sm">Visit <Link href="/onboarding" className="text-indigo-400 hover:underline">start your free trial</Link>.</p></div>
    </div>
    <footer className="border-t border-zinc-800 px-6 py-6 text-center text-zinc-600 text-xs">UTH Demo</footer>
  </div>);
}
