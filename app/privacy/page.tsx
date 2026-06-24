import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";

function Nav() {
  return (
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-50">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center"><span className="font-black text-white text-xs">UTH</span></div>
        <span className="font-black tracking-tighter text-lg"><span className="text-indigo-400">U</span><span className="text-indigo-300">T</span><span className="text-indigo-200">H</span></span>
      </Link>
      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        <Link href="/gdpr" className="hover:text-white transition-colors">GDPR</Link>
        <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
      </div>
    </nav>
  );
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-zinc-800">{title}</h2>
      <div className="space-y-3 text-zinc-400 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Nav />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Legal · Empatixtech</div>
          <h1 className="text-4xl font-black text-white mb-3">Privacy Policy</h1>
          <p className="text-zinc-500 text-sm">Last updated: 01 April 2025</p>
        </div>
        <p className="text-zinc-400 leading-relaxed mb-10">Empatixtech has created this Privacy Policy in line with Empatixtech's commitment to your privacy on Empatixtech websites and the UTH authentication platform. The following discloses Empatixtech's information gathering, dissemination and protection practices.</p>

        <S title="Compliance">
          <p>If you do not agree to the terms of this Privacy Policy, please do not access or use Empatixtech websites or the UTH platform. If you wish to stop receiving Empatixtech marketing materials then please click on the unsubscribe link provided in our communications.</p>
        </S>

        <S title="Collection of Information">
          <p>Empatixtech collects information to provide better services to its users and to better understand the visitors to its websites and what content is of interest to them. Empatixtech collects information in the following ways:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Information you choose to submit to us (such as your name, email address, company name, title, country) for accessing downloads, viewing content, subscribing to newsletters, registering for events, or setting marketing and communication preferences.</li>
            <li>Information obtained from publicly available sources such as social media, marketing platforms, or events you attended.</li>
            <li>Information Empatixtech receives from your use of its websites, such as IP address, browser type, ISP, referring/exit pages, platform type, timestamps, number of clicks, domain name, and location.</li>
            <li>Aggregated statistical or demographic data which may be derived from personal data but does not directly or indirectly identify you unless linked back to personal identifiers.</li>
            <li>Technical data from analytics providers, advertising networks, and search information providers.</li>
          </ul>
          <p>Empatixtech does not collect special categories of personal information (such as race, ethnicity, religious beliefs, etc.) or information about criminal convictions and offenses unless required by law.</p>
          <p>Empatixtech will only use your personal information for the purposes for which it was collected, unless it reasonably considers that it needs to use it for another reason compatible with the original purpose. If use is required for a purpose unrelated to the original, you will be notified and the legal basis will be explained.</p>
        </S>

        <S title="Sharing of Information">
          <p>Empatixtech may disclose your personal information to:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Group companies, professional advisers, third-party service providers and partners providing data processing services (e.g., hosting, security, website functionality), or processing information as described in our privacy notices.</li>
            <li>Law enforcement, regulatory bodies, government agencies, courts or other third parties where disclosure is legally required, to exercise legal rights, or to protect vital interests.</li>
            <li>Any other party with your consent.</li>
          </ul>
        </S>

        <S title="Legal Basis of Processing">
          <p>For individuals protected by EU data protection law, Empatixtech processes your personal information based on: necessity to perform a contract; legitimate interests that are not overridden by your rights; your consent; legal obligations; or protection of vital interests.</p>
        </S>

        <S title="Use of Information">
          <p>Empatixtech uses collected data to make better business decisions, support user activities, and provide high-quality services. Location data is used to tailor website experience. Non-personal data is used to improve websites, and IP addresses help with diagnostics and administration.</p>
          <p>We retain personal information only as long as necessary for purposes it was collected, including legal or reporting obligations.</p>
        </S>

        <S title="International Transfers">
          <p>Empatixtech may process information on servers outside your country of residence. Such transfers are safeguarded, including use of the European Commission's Standard Contractual Clauses to ensure adequate protection.</p>
        </S>

        <S title="Information Security">
          <p>Empatixtech stores personal information securely, with access limited to select personnel and protected by encryption. In the event of a breach, affected individuals and regulators will be notified where legally required.</p>
        </S>

        <S title="Marketing">
          <p>Empatixtech may use your data for marketing purposes, storing it in CRM systems to inform you about products and services. Response data helps shape future marketing. To opt out, please use the unsubscribe option in our emails.</p>
        </S>

        <S title="Links">
          <p>Empatixtech websites may contain links or plugins to third-party websites. We are not responsible for the content, privacy practices or reliability of third-party websites. We encourage you to review their privacy policies.</p>
        </S>

        <S title="Your Data Protection Rights">
          <p>Under EU data protection law, you have the right to: access, correct, update or delete your personal data; object to or restrict data processing; request data portability; opt out of marketing communications; withdraw consent at any time; and file complaints with data protection authorities. We aim to respond within one month.</p>
        </S>

        <S title="Cookies">
          <p>You may set your browser to reject cookies. Some features of Empatixtech websites may not function properly if cookies are disabled. For more information, see our <Link href="/cookies" className="text-indigo-400 hover:underline">Cookie Policy</Link>.</p>
        </S>

        <S title="Changes to the Policy">
          <p>Empatixtech reserves the right to modify this Privacy Policy at any time. Updates will be published on our websites. Continued use of our websites constitutes acceptance of any changes. This version was last updated on 01 April 2025.</p>
        </S>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 mt-10">
          <h3 className="font-semibold text-white mb-4">Contact details</h3>
          <div className="space-y-2 text-sm text-zinc-400">
            <div className="font-semibold text-white">Empatixtech</div>
            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />Pērnavas iela 21–22, Rīga, LV-1009, Latvia</div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0 text-zinc-500" /><a href="tel:+37124965140" className="hover:text-white">+371 24965 140</a></div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0 text-zinc-500" /><a href="mailto:privacy@empatixtech.com" className="hover:text-white">privacy@empatixtech.com</a></div>
          </div>
        </div>
      </div>
      <footer className="border-t border-white/8 px-6 py-6 text-center text-zinc-600 text-xs">
        © 2025 Empatixtech. UTH is a product of Empatix. <Link href="/" className="hover:text-zinc-400 ml-1">← Back to UTH</Link>
      </footer>
    </div>
  );
}
