import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          🍊 {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p style={{fontSize: '1.1rem', opacity: 0.8, maxWidth: '600px', margin: '0 auto 1.5rem'}}>
          Everything you need to build reliable AI solutions — from your first agent to production deployment.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/getting-started/quick-start">
            Quick Start — 5 min ⏱️
          </Link>
          <Link
            className="button button--outline button--lg"
            style={{marginLeft: '1rem', color: '#fff', borderColor: '#fff'}}
            to="/concepts/fai-protocol">
            FAI Protocol →
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
  link: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Getting Started',
    emoji: '🚀',
    description: 'Install FrootAI, initialize your first solution play, and deploy to Azure in minutes.',
    link: '/getting-started/introduction',
  },
  {
    title: 'FAI Protocol',
    emoji: '🔗',
    description: 'The open specification that wires agents, skills, instructions, hooks, and plugins together.',
    link: '/concepts/fai-protocol',
  },
  {
    title: 'Primitives',
    emoji: '🧩',
    description: 'Agents, Skills, Instructions, Hooks, Plugins, and Workflows — the building blocks of AI solutions.',
    link: '/primitives/agents',
  },
  {
    title: 'Solution Plays',
    emoji: '🏗️',
    description: 'Pre-built, production-ready AI architectures. Each play includes DevKit, TuneKit, and infra.',
    link: '/solution-plays/overview',
  },
  {
    title: 'FROOT Learning Path',
    emoji: '🌱',
    description: 'Foundations → Reasoning → Orchestration → Operations → Transformation. 16 modules to master GenAI.',
    link: '/learning/f1-genai-foundations',
  },
  {
    title: 'Distribution',
    emoji: '📦',
    description: 'MCP Server, VS Code Extension, npm SDK, Python SDK, CLI, and Docker — pick your channel.',
    link: '/distribution/mcp-server',
  },
];

function Feature({title, emoji, description, link}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <Link to={link} style={{textDecoration: 'none', color: 'inherit'}}>
        <div className="text--center padding-horiz--md" style={{padding: '1.5rem'}}>
          <div style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>{emoji}</div>
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </Link>
    </div>
  );
}

function HomepageFeatures(): ReactNode {
  return (
    <section style={{padding: '4rem 0'}}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function InstallSection(): ReactNode {
  return (
    <section style={{padding: '3rem 0', background: 'var(--ifm-background-surface-color)'}}>
      <div className="container">
        <Heading as="h2" className="text--center" style={{marginBottom: '2rem'}}>
          Install in seconds
        </Heading>
        <div className="row">
          <div className="col col--4">
            <h4>npm (MCP Server)</h4>
            <pre><code>npx frootai-mcp@latest</code></pre>
          </div>
          <div className="col col--4">
            <h4>pip (Python SDK)</h4>
            <pre><code>pip install frootai</code></pre>
          </div>
          <div className="col col--4">
            <h4>Docker</h4>
            <pre><code>docker pull ghcr.io/frootai/frootai-mcp</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="FrootAI Documentation"
      description="The uniFAIng glue for the GenAI ecosystem. Documentation, guides, API reference, and learning resources.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <InstallSection />
      </main>
    </Layout>
  );
}
