import Link from "next/link";
import Image from "next/image";

const columns = [
  { title: "Explore", links: [
    { label: "Solution Plays", href: "/solution-plays" },
    { label: "Ecosystem", href: "/ecosystem" },
    { label: "Knowledge Hub", href: "/docs" },
    { label: "Packages", href: "/packages" },
    { label: "Setup Guide", href: "/setup-guide" },
    { label: "Agent FAI", href: "/chatbot" },
    { label: "Configurator", href: "/configurator" },
  ]},
  { title: "Community", links: [
    { label: "Partners", href: "/partners" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "Enterprise", href: "/enterprise" },
    { label: "Workshops", href: "https://github.com/gitpavleenbali/frootai/tree/main/workshops", ext: true },
  ]},
  { title: "Install", links: [
    { label: "MCP Server (npm)", href: "https://www.npmjs.com/package/frootai-mcp", ext: true },
    { label: "VS Code Extension", href: "https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai", ext: true },
    { label: "Docker Image", href: "https://github.com/gitpavleenbali/frootai/pkgs/container/frootai-mcp", ext: true },
  ]},
  { title: "Connect", links: [
    { label: "LinkedIn", href: "https://linkedin.com/in/pavleenbali", ext: true },
    { label: "GitHub", href: "https://github.com/gitpavleenbali/frootai", ext: true },
    { label: "Newsletter", href: "https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7001119707667832832", ext: true },
  ]},
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-[#040407]">
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-1.5 font-bold text-[15px]">
              <Image src="/img/frootai-logo.png" alt="FrootAI" width={32} height={32} className="rounded-sm" />
              <span>Froot<span className="text-emerald">AI</span></span>
            </Link>
            <p className="mt-3 text-[12px] text-fg-muted leading-relaxed max-w-[200px]">
              From the Roots to the Fruits.<br />It&apos;s simply <span className="text-emerald font-medium">Frootful</span>.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-dim mb-3">{col.title}</h3>
              <ul className="space-y-1.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"ext" in link && link.ext ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer"
                        className="footer-link text-[13px] text-fg-muted transition-colors">{link.label}</a>
                    ) : (
                      <Link href={link.href} className="footer-link text-[13px] text-fg-muted transition-colors">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-fg-muted">&copy; {new Date().getFullYear()} FrootAI &middot; MIT License</p>
          <div className="flex gap-4">
            <Link href="/community" className="footer-link text-[11px] text-fg-muted transition-colors">Community</Link>
            <a href="https://github.com/gitpavleenbali/frootai" target="_blank" rel="noopener noreferrer"
              className="footer-link text-[11px] text-fg-muted transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
