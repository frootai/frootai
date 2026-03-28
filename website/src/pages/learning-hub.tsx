import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function LearningHubPage(): JSX.Element {
  return (
    <Layout title="FAI Learning Hub — FrootAI" description="Learn AI architecture from the roots up. 16 modules, 200+ terms, workshops, quiz, certification.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>📚 FAI Learning Hub</h1>
          <p style={{ fontSize: "0.9rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "560px", margin: "0 auto" }}>
            Learn AI architecture from the roots up. Modules, glossary, workshops, and quizzes — all free.
          </p>
        </div>

        <section style={{ marginBottom: "40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
            {[
              { to: "/docs/", icon: "📚", title: "16 Knowledge Modules", sub: "From tokens to production agents", color: "#f59e0b" },
              { to: "/docs/F3-AI-Glossary-AZ", icon: "📖", title: "200+ AI Terms", sub: "Comprehensive glossary A-Z", color: "#10b981" },
              { to: "https://github.com/gitpavleenbali/frootai/tree/main/workshops", icon: "🎓", title: "Workshop Materials", sub: "4 hands-on workshops", color: "#6366f1" },
              { to: "/docs/Quiz-Assessment", icon: "📝", title: "Quiz & Assessment", sub: "25 questions to test yourself", color: "#06b6d4" },
            ].map((card) => (
              <Link key={card.title} to={card.to} className={styles.glowCard} style={{ "--glow-color": card.color } as React.CSSProperties}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{card.icon}</div>
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
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "500px", margin: "0 auto", marginBottom: "20px" }}>
            Study → Lab → Exam → Badge. Validate your AI architecture skills across the FROOT framework.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", maxWidth: "700px", margin: "0 auto" }}>
            {[
              { level: "Associate", color: "#10b981", modules: "F1-F4", focus: "AI Foundations + Model Selection", prereq: "None" },
              { level: "Professional", color: "#6366f1", modules: "R1-R3 + O1-O3", focus: "RAG + Agents + Orchestration", prereq: "Associate" },
              { level: "Expert", color: "#7c3aed", modules: "O4-O6 + T1-T3", focus: "Infrastructure + Production + Fine-Tuning", prereq: "Professional" },
            ].map((cert) => (
              <div key={cert.level} style={{ padding: "16px", borderRadius: "12px", border: `2px solid ${cert.color}33`, textAlign: "center" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: cert.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cert.level}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, margin: "6px 0" }}>{cert.focus}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--ifm-color-emphasis-400)" }}>Modules: {cert.modules}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--ifm-color-emphasis-400)" }}>Prereq: {cert.prereq}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ textAlign: "center", padding: "40px 24px", borderRadius: "16px", border: "2px solid rgba(245, 158, 11, 0.2)", background: "rgba(245, 158, 11, 0.03)" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "20px" }}>Explore More</h2>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/community" className={styles.glowPill} style={{ "--pill-color": "#00C853", display: "inline-block" } as React.CSSProperties}>🌱 Open Source Community →</Link>
            <Link to="/ecosystem" className={styles.glowPill} style={{ "--pill-color": "#0ea5e9", display: "inline-block" } as React.CSSProperties}>🔗 Ecosystem Overview →</Link>
            <Link to="/dev-hub" className={styles.glowPill} style={{ "--pill-color": "#7c3aed", display: "inline-block" } as React.CSSProperties}>🛠️ Developer Center →</Link>
            <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#f59e0b", display: "inline-block" } as React.CSSProperties}>🌳 Back to FrootAI →</Link>
          </div>
        </section>

      </div>
    </Layout>
  );
}
