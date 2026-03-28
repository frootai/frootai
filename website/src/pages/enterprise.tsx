import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function EnterprisePage(): JSX.Element {
  return (
    <Layout title="Open Source Community + FAI Learning Hub" description="FrootAI is open source, free forever. Learn, build, and grow together.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <Link href="https://github.com/gitpavleenbali/frootai" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 16px", borderRadius: "20px", background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", fontSize: "0.75rem", color: "#eab308", fontWeight: 600, textDecoration: "none" }}>
            Star on GitHub
          </Link>
        </div>

        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Open Source Community</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "640px", margin: "0 auto" }}>
            Come build the community. Empower each other. Be the open glue for infrastructure, platform, and application teams.
          </p>
          <p style={{ fontSize: "0.85rem", color: "#00C853", fontWeight: 600, marginTop: "8px" }}>
            Open Source - Free Forever - MIT License - Built by the community, for the community.
          </p>
        </div>

        <section style={{ marginBottom: "56px" }}>
          <div style={{ padding: "32px 28px", borderRadius: "16px", border: "2px solid rgba(16, 185, 129, 0.25)", background: "rgba(16, 185, 129, 0.03)" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "4px", color: "#10b981" }}>Everything is Free</h3>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10b981", marginBottom: "16px" }}>$0 - Forever</div>
            <ul style={{ fontSize: "0.82rem", lineHeight: 1.9, paddingLeft: "18px", columns: 2, columnGap: "32px" }}>
              <li>20 Solution Plays (open-source)</li>
              <li>MCP Server (npm) - 22 tools</li>
              <li>VS Code Extension - 19 commands</li>
              <li>.github Agentic OS templates</li>
              <li>16 Knowledge Modules</li>
              <li>200+ AI Glossary Terms</li>
              <li>Solution Configurator</li>
              <li>AI Assistant</li>
              <li>Workshop Materials</li>
              <li>Community Support</li>
            </ul>
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <Link to="/setup-guide" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
                Get Started Free
              </Link>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: "56px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "16px", textAlign: "center" }}>How to Contribute</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {[
              { icon: "Y", title: "Add a Solution Play", detail: "Create a new play following the DevKit + TuneKit structure. CI validates automatically." },
              { icon: "I", title: "Improve Knowledge", detail: "Fix errors, add glossary terms, deepen existing modules. Every contribution matters." },
              { icon: "B", title: "Build MCP Tools", detail: "Extend the 16-tool MCP server with new capabilities. Partner integrations welcome." },
              { icon: "S", title: "Star and Share", detail: "Star the repo, share with your team, write about your experience. Community grows the ecosystem." },
            ].map((item) => (
              <div key={item.title} style={{ padding: "20px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "8px", fontWeight: 800, color: "#10b981" }}>{item.icon}</div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: "4px" }}>{item.title}</h4>
                <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--ifm-color-emphasis-600)" }}>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <hr style={{ border: "none", borderTop: "2px solid rgba(124, 58, 237, 0.15)", margin: "48px 0" }} />

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>FAI Learning Hub</h1>
          <p style={{ fontSize: "0.9rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "560px", margin: "0 auto" }}>
            Learn AI architecture from the roots up. Modules, glossary, workshops, and quizzes - all free.
          </p>
        </div>

        <section style={{ marginBottom: "40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
            {[
              { to: "/docs/", title: "16 Knowledge Modules", sub: "From tokens to production agents", color: "#f59e0b" },
              { to: "/docs/F3-AI-Glossary-AZ", title: "200+ AI Terms", sub: "Comprehensive glossary A-Z", color: "#10b981" },
              { to: "https://github.com/gitpavleenbali/frootai/tree/main/workshops", title: "Workshop Materials", sub: "4 hands-on workshops", color: "#6366f1" },
              { to: "/docs/Quiz-Assessment", title: "Quiz and Assessment", sub: "25 questions to test yourself", color: "#06b6d4" },
            ].map((card) => (
              <Link key={card.title} to={card.to} className={styles.glowCard} style={{ "--glow-color": card.color } as React.CSSProperties}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{card.title}</div>
                <div style={{ fontSize: "0.72rem", color: card.color, marginTop: "4px" }}>{card.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: "56px", padding: "24px", borderRadius: "16px", border: "1px dashed rgba(124, 58, 237, 0.3)", background: "rgba(124, 58, 237, 0.02)", textAlign: "center" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: "20px", background: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.3)", fontSize: "0.7rem", color: "#7c3aed", fontWeight: 700, marginBottom: "12px" }}>
            COMING SOON
          </div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>FrootAI Certified Professional</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "500px", margin: "0 auto" }}>
            Study - Lab - Exam - Badge. Validate your AI architecture skills. We are building the certification program and will launch it when the community is ready.
          </p>
        </section>

        <section style={{ textAlign: "center", padding: "40px 24px", borderRadius: "16px", border: "2px solid rgba(0, 200, 83, 0.2)", background: "rgba(0, 200, 83, 0.03)" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "20px" }}>Ready to Start?</h2>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/setup-guide" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
              Get Started Free
            </Link>
            <Link to="/solution-plays" className={styles.glowPill} style={{ "--pill-color": "#7c3aed", display: "inline-block" } as React.CSSProperties}>
              View Solution Plays
            </Link>
            <Link href="https://github.com/gitpavleenbali/frootai" className={styles.glowPill} style={{ "--pill-color": "#00C853", display: "inline-block" } as React.CSSProperties}>
              Star on GitHub
            </Link>
          </div>
        </section>

      </div>
    </Layout>
  );
}