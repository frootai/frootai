import * as vscode from "vscode";

interface PrimitiveChild {
  label: string;
  desc: string;
  icon: string;
}

interface PrimitiveCategory {
  label: string;
  icon: string;
  count: number;
  children: PrimitiveChild[];
}

interface PrimitiveCategoryItem extends vscode.TreeItem {
  _children?: PrimitiveChild[];
}

const CATEGORIES: PrimitiveCategory[] = [
  {
    label: "Agents",
    icon: "hubot",
    count: 201,
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
    label: "Instructions",
    icon: "file-text",
    count: 176,
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
    label: "Skills",
    icon: "wand",
    count: 282,
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
    label: "Hooks",
    icon: "shield",
    count: 10,
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
    label: "Plugins",
    icon: "extensions",
    count: 77,
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
    label: "Workflows",
    icon: "git-merge",
    count: 12,
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
    label: "Cookbook",
    icon: "beaker",
    count: 16,
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
        item.description = `${cat.count} primitives`;
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
