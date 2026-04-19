import * as vscode from "vscode";

interface ProtocolChild {
  label: string;
  desc: string;
  icon: string;
}

interface ProtocolLayer {
  label: string;
  icon: string;
  desc: string;
  children: ProtocolChild[];
}

interface ProtocolLayerItem extends vscode.TreeItem {
  _children?: ProtocolChild[];
}

const LAYERS: ProtocolLayer[] = [
  {
    label: "FAI Protocol",
    icon: "json",
    desc: "fai-manifest.json — the specification",
    children: [
      {
        label: "fai-manifest.json",
        desc: "Full play wiring: context + primitives + infra + toolkit",
        icon: "file-code",
      },
      {
        label: "fai-context.json",
        desc: "Lightweight LEGO block context reference",
        icon: "file",
      },
      {
        label: "7 JSON schemas",
        desc: "agent, instruction, skill, hook, plugin, manifest, context",
        icon: "symbol-structure",
      },
      {
        label: "Auto-wiring",
        desc: "Shared context propagates to all primitives in a play",
        icon: "link",
      },
    ],
  },
  {
    label: "FAI Layer",
    icon: "layers",
    desc: "The conceptual binding glue",
    children: [
      {
        label: "Context Wiring",
        desc: "Knowledge modules + WAF pillars + compatible plays",
        icon: "git-merge",
      },
      {
        label: "WAF Alignment",
        desc: "6 pillars: security, reliability, cost, ops, perf, RAI",
        icon: "shield",
      },
      {
        label: "Standalone → Wired",
        desc: "LEGO blocks auto-wire when placed in a play",
        icon: "plug",
      },
    ],
  },
  {
    label: "FAI Engine",
    icon: "server-process",
    desc: "The runtime — 7 modules, 42 tests",
    children: [
      {
        label: "manifest-reader",
        desc: "Loads and validates fai-manifest.json",
        icon: "file-code",
      },
      {
        label: "context-resolver",
        desc: "Resolves shared context chain",
        icon: "search",
      },
      {
        label: "primitive-wirer",
        desc: "Connects agents, instructions, skills, hooks",
        icon: "link",
      },
      {
        label: "hook-runner",
        desc: "Executes hooks at lifecycle events",
        icon: "play",
      },
      {
        label: "evaluator",
        desc: "Runs quality metrics (groundedness, coherence)",
        icon: "graph",
      },
      {
        label: "mcp-bridge",
        desc: "Bridges to MCP protocol",
        icon: "cloud",
      },
    ],
  },
  {
    label: "FAI Factory",
    icon: "rocket",
    desc: "CI/CD pipeline — harvest, catalog, transform, validate, ship",
    children: [
      {
        label: "Harvester",
        desc: "Scans 860+ primitives across 9 directories in ~250ms",
        icon: "search",
      },
      {
        label: "Cataloger",
        desc: "Builds fai-catalog.json (525KB) with stats + cross-refs",
        icon: "database",
      },
      {
        label: "Transform (6 adapters)",
        desc: "npm-mcp, vscode, python-mcp, npm-sdk, python-sdk, website",
        icon: "arrow-swap",
      },
      {
        label: "Validator (6 gates)",
        desc: "Structure, counts, agent quality, play integrity, cross-channel, unification",
        icon: "check-all",
      },
      {
        label: "Ship (factory-gated)",
        desc: "Factory pre-flight → release-channel.js → tag → per-channel workflows",
        icon: "cloud-upload",
      },
      {
        label: "Watch mode",
        desc: "Live dev: auto-rebuild on primitive changes with debounce",
        icon: "eye",
      },
      {
        label: "GitHub Actions (4)",
        desc: "factory.yml, unified-release.yml, factory-sync.yml, weekly-audit.yml",
        icon: "github-action",
      },
    ],
  },
  {
    label: "FAI Marketplace",
    icon: "store",
    desc: "77 plugins, 1,008 items",
    children: [
      {
        label: "npx frootai install",
        desc: "One-command plugin installation",
        icon: "terminal",
      },
      {
        label: "npx frootai list",
        desc: "Browse all 77 plugins",
        icon: "list-flat",
      },
      {
        label: "frootai.dev/marketplace",
        desc: "Web-based marketplace with modals",
        icon: "globe",
      },
    ],
  },
];

export class FaiProtocolProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return LAYERS.map((layer) => {
        const item: ProtocolLayerItem = new vscode.TreeItem(
          layer.label,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.description = layer.desc;
        item.iconPath = new vscode.ThemeIcon(layer.icon);
        item._children = layer.children;
        return item;
      });
    }

    const layerItem = element as ProtocolLayerItem;
    if (layerItem._children) {
      return layerItem._children.map((child) => {
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
