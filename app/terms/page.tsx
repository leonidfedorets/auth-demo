import Link from "next/link";

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
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Legal · UTH</div>
          <h1 className="text-4xl font-black text-white mb-3">Terms and Conditions</h1>
          <p className="text-zinc-500 text-sm">Last updated: 01 April 2025</p>
        </div>
        <p className="text-zinc-400 leading-relaxed mb-10">
          Welcome to the UTH authentication platform. Please read the following Terms and Conditions carefully. By accessing or using this platform in any manner — including, but not limited to, using any of our services, downloading materials, or simply browsing — you agree to be bound by these Terms.
        </p>
        <p className="text-zinc-400 leading-relaxed mb-10">
          We reserve the right to update or change these Terms at any time. Major updates will be announced on our homepage. Your continued use of the platform after such changes constitutes your acceptance of the revised terms. If you violate any of these terms, your right to use the platform will terminate immediately.
        </p>

        <S title="Our Services">
          <p>UTH is an authentication infrastructure platform (JWT, WebAuthn, Device Attestation, Risk Engine, SCA/PSD2) offered as a SaaS product.</p>
        </S>

        <S title="Copyright">
          <p>All content within the UTH platform is protected by copyright laws. You may not copy, modify, rent, sell, distribute, or create derivative works based on any part of the platform or its materials without explicit written permission.</p>
        </S>

        <S title="Use of Services">
          <p>This platform may feature content and links from third parties for your convenience. We are not responsible for third-party sites or their content, and we do not control their operation. Each external site has its own terms and privacy policies which you are responsible for reviewing. Your use of third-party websites is at your own risk.</p>
        </S>

        <S title="Use of Software Products">
          <p>Software and documentation made available on this platform are copyrighted works. You may not download or use any such software unless you agree to its applicable license agreement. The UTH platform is provided under a subscription license — see your subscription agreement for usage rights and restrictions.</p>
        </S>

        <S title="Acceptable Use">
          <p>You agree not to use the UTH platform to: violate any applicable law or regulation; infringe the intellectual property rights of others; transmit any harmful, offensive, or disruptive content; attempt to gain unauthorised access to any system; or engage in any activity that interferes with the operation of the platform.</p>
        </S>

        <S title="Submissions">
          <p>Unless stated otherwise in writing, any communications, feedback, questions, or suggestions you send to us will be treated as non-confidential and may be used for commercial, promotional, or other purposes without obligation to you.</p>
        </S>

        <S title="Trademark Notice">
          <p>UTH and the names of UTH products and services referenced on this platform are trademarks or registered trademarks of their respective owners. Other names mentioned may be trademarks of their respective owners.</p>
        </S>

        <S title="Disclaimers and Warranties">
          <p>All materials on this platform are provided "as is" without any warranties. We do not guarantee that the materials will meet your expectations; the platform will be secure or error-free; or the results obtained from use of the materials will be accurate or reliable. Use or downloading of any content is at your own risk.</p>
        </S>

        <S title="Limitation of Liability">
          <p>In no event shall UTH be liable to you or any third party for any damages, including but not limited to, data loss, loss of profits, or any indirect, incidental, or consequential damages.</p>
        </S>

        <S title="Indemnification">
          <p>We are not liable for any consequences arising from misuse of the UTH platform or its content by you or any third party.</p>
        </S>

        <S title="Website Maintenance">
          <p>We do not guarantee that information on this platform is current. Content is considered valid only as of its publication date. We may change or remove content without prior notice.</p>
        </S>

        <S title="Governing Law">
          <p>These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts.</p>
        </S>
      </div>
      <footer className="border-t border-white/8 px-6 py-6 text-center text-zinc-700 text-xs">
        <Link href="/" className="hover:text-zinc-400">← Back to UTH</Link>
      </footer>
    </div>
  );
}
