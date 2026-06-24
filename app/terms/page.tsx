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
        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Nav />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Legal · Empatixtech</div>
          <h1 className="text-4xl font-black text-white mb-3">Terms and Conditions</h1>
          <p className="text-zinc-500 text-sm">Last updated: 01 April 2025</p>
        </div>
        <p className="text-zinc-400 leading-relaxed mb-10">
          Welcome to the Empatixtech website and the UTH authentication platform. Please read the following Terms and Conditions carefully. By accessing or using this site or the UTH platform in any manner — including, but not limited to, using any of our services, downloading materials, or simply browsing — you agree to be bound by these Terms.
        </p>
        <p className="text-zinc-400 leading-relaxed mb-10">
          Empatixtech reserves the right to update or change these Terms at any time. Major updates will be announced on our homepage. Your continued use of the site after such changes constitutes your acceptance of the revised terms. If you violate any of these terms, your right to use the site will terminate immediately.
        </p>

        <S title="Our Services">
          <p>Empatixtech provides IT services including software development outsourcing, offshore web application development, technology consulting, software modernisation, prototyping, and other related services. UTH is an authentication infrastructure platform (JWT, WebAuthn, Device Attestation, Risk Engine, SCA/PSD2) offered as a SaaS product.</p>
        </S>

        <S title="Copyright">
          <p>All content on this website and within the UTH platform is protected by copyright laws. You may not copy, modify, rent, sell, distribute, or create derivative works based on any part of the site or its materials without explicit written permission from Empatixtech.</p>
        </S>

        <S title="Use of Services">
          <p>In addition to Empatixtech-provided materials, this site may feature content and links from third parties for your convenience. Empatixtech is not responsible for third-party sites or their content, and we do not control their operation. Each external site has its own terms and privacy policies which you are responsible for reviewing. Your use of third-party websites is at your own risk.</p>
        </S>

        <S title="Use of Software Products">
          <p>Software and documentation made available on this site are the copyrighted works of Empatixtech. You may not download or use any such software unless you agree to its applicable license agreement. The UTH platform is provided under a subscription license — see your subscription agreement for usage rights and restrictions.</p>
        </S>

        <S title="Acceptable Use">
          <p>You agree not to use the UTH platform or Empatixtech services to: violate any applicable law or regulation; infringe the intellectual property rights of others; transmit any harmful, offensive, or disruptive content; attempt to gain unauthorised access to any system; or engage in any activity that interferes with the operation of the platform.</p>
        </S>

        <S title="Submissions">
          <p>Unless stated otherwise in writing, any communications, feedback, questions, or suggestions you send to Empatixtech will be treated as non-confidential. Empatixtech is entitled to use such information for commercial, promotional, or other purposes without obligation to you.</p>
        </S>

        <S title="Trademark Notice">
          <p>Empatixtech, the Empatixtech logo, UTH, and the names of Empatixtech products and services referenced on this site are trademarks or registered trademarks of Empatixtech. Use of these marks is governed by our Third-Party Trademark and Logo Usage Guidelines. Other names mentioned may be trademarks of their respective owners.</p>
        </S>

        <S title="Disclaimers and Warranties">
          <p>All materials on this site are provided "as is" without any warranties. Empatixtech does not guarantee that the materials will meet your expectations; the site will be secure or error-free; or the results obtained from use of the materials will be accurate or reliable. Use or downloading of any content is at your own risk.</p>
        </S>

        <S title="Limitation of Liability">
          <p>In no event shall Empatixtech be liable to you or any third party for any damages, including but not limited to, data loss, loss of profits, or any indirect, incidental, or consequential damages, even if Empatixtech has been advised of the possibility of such damages.</p>
        </S>

        <S title="Indemnification">
          <p>Empatixtech is not liable for any consequences arising from misuse of the website, the UTH platform, or its content by you or any third party.</p>
        </S>

        <S title="Website Maintenance">
          <p>Empatixtech does not guarantee that information on this website is current. Content is considered valid only as of its publication date. We may change or remove content without prior notice.</p>
        </S>

        <S title="Governing Law">
          <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of Latvia. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Latvia.</p>
        </S>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 mt-10">
          <h3 className="font-semibold text-white mb-4">Contact</h3>
          <p className="text-zinc-400 text-sm mb-4">We welcome your questions or feedback. Please feel free to contact us:</p>
          <div className="space-y-2 text-sm text-zinc-400">
            <div className="font-semibold text-white">Empatixtech</div>
            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />Pērnavas iela 21–22, Rīga, LV-1009, Latvia</div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0 text-zinc-500" /><a href="tel:+37124965140" className="hover:text-white">+371 24965 140</a></div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0 text-zinc-500" /><a href="mailto:sales@empatixtech.com" className="hover:text-white">sales@empatixtech.com</a></div>
          </div>
        </div>
      </div>
      <footer className="border-t border-white/8 px-6 py-6 text-center text-zinc-600 text-xs">
        © 2025 Empatixtech. UTH is a product of Empatix. <Link href="/" className="hover:text-zinc-400 ml-1">← Back to UTH</Link>
      </footer>
    </div>
  );
}
