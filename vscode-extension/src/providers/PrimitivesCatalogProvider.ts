import * as vscode from "vscode";

interface PrimitiveChild {
  label: string;
  desc: string;
  icon: string;
}

interface PrimitiveCategory {
  label: string;
  icon: string;
  children: PrimitiveChild[];
}

interface PrimitiveCategoryItem extends vscode.TreeItem {
  _children?: PrimitiveChild[];
}

const CATEGORIES: PrimitiveCategory[] = [
  {
    label: "Agents (238)",
    icon: "hubot",
    children: [
      {
        label: "Install agent via VS Code",
        desc: "vscode://github.copilot-chat/createAgent",
        icon: "cloud-download",
      },
      {
        label: "Browse on website",
        desc: "frootai.dev/primitives/agents",
        icon: "globe",
      },
      {
        label: "WAF-aligned AI personas",
        desc: "Each agent has expertise + tools + WAF alignment",
        icon: "info",
      },
    ],
  },
  {
    label: "Instructions (176)",
    icon: "file-text",
    children: [
      {
        label: "Auto-apply via applyTo globs",
        desc: "Match file patterns like **/*.tsx",
        icon: "regex",
      },
      {
        label: "Browse on website",
        desc: "frootai.dev/primitives/instructions",
        icon: "globe",
      },
      {
        label: "Scoped behavioral directives",
        desc: "Coding standards, security rules, best practices",
        icon: "info",
      },
    ],
  },
  {
    label: "Skills (282)",
    icon: "tools",
    children: [
      {
        label: "SKILL.md folder structure",
        desc: "Parameters, steps, bundled assets",
        icon: "folder",
      },
      {
        label: "Browse on website",
        desc: "frootai.dev/primitives/skills",
        icon: "globe",
      },
      {
        label: "Reusable LEGO blocks",
        desc: "Auto-wire inside solution plays",
        icon: "info",
      },
    ],
  },
  {
    label: "Hooks (10)",
    icon: "shield",
    children: [
      {
        label: "secrets-scanner",
        desc: "40+ secret patterns, entropy detection",
        icon: "lock",
      },
      {
        label: "tool-guardian",
        desc: "Allowlist/blocklist, rate limiting",
        icon: "shield",
      },
      {
        label: "governance-audit",
        desc: "OWASP LLM Top 10 checks",
        icon: "law",
      },
      {
        label: "pii-redactor",
        desc: "12+ PII types, GDPR/HIPAA",
        icon: "eye-closed",
      },
      {
        label: "cost-tracker",
        desc: "Per-model pricing, anomaly detection",
        icon: "graph",
      },
      {
        label: "waf-compliance",
        desc: "6-pillar scoring, 36 checks",
        icon: "checklist",
      },
      {
        label: "output-validator",
        desc: "Schema, safety, hallucination checks",
        icon: "check-all",
      },
      {
        label: "token-budget-enforcer",
        desc: "Per-model budgets, sliding window",
        icon: "dashboard",
      },
      {
        label: "session-logger",
        desc: "JSON Lines audit trail",
        icon: "output",
      },
      {
        label: "license-checker",
        desc: "SPDX compliance, 4 ecosystems",
        icon: "file-certificate",
      },
    ],
  },
  {
    label: "Plugins (77)",
    icon: "package",
    children: [
      {
        label: "npx frootai install <plugin>",
        desc: "One-command installation",
        icon: "terminal",
      },
      {
        label: "Browse marketplace",
        desc: "frootai.dev/marketplace",
        icon: "globe",
      },
      {
        label: "1,008 bundled items",
        desc: "Agents + instructions + skills + hooks per plugin",
        icon: "info",
      },
    ],
  },
  {
    label: "Workflows (12)",
    icon: "git-branch",
    children: [
      {
        label: "Agentic workflows with safe-outputs",
        desc: "GitHub Copilot engine",
        icon: "github-action",
      },
      {
        label: "Browse on website",
        desc: "frootai.dev/workflows",
        icon: "globe",
      },
    ],
  },
  {
    label: "Cookbook (16)",
    icon: "book",
    children: [
      {
        label: "Step-by-step recipes",
        desc: "From play init to production deployment",
        icon: "list-ordered",
      },
      {
        label: "Browse on website",
        desc: "frootai.dev/cookbook",
        icon: "globe",
      },
    ],
  },
];

export class PrimitivesCatalogProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return CATEGORIES.map((cat) => {
        const item: PrimitiveCategoryItem = new vscode.TreeItem(
          cat.label,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.iconPath = new vscode.ThemeIcon(cat.icon);
        item.contextValue = "primitiveCategory";
        item._children = cat.children;
        return item;
      });
    }

    const catItem = element as PrimitiveCategoryItem;
    if (catItem._children) {
      return catItem._children.map((child) => {
        const item = new vscode.TreeItem(
          child.label,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = child.desc;
        item.iconPath = new vscode.ThemeIcon(child.icon);
        item.tooltip = child.desc;
        return item;
      });
    }
    return [];
  }
}
