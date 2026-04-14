import * as vscode from "vscode";
import { FROOT_MODULES, FrootLayer } from "../data/modules";

const LAYER_DESCRIPTIONS: Record<string, string> = {
  "🌱 Foundations": "Core AI concepts, glossary, .github Agentic OS",
  "🪵 Reasoning": "Prompt engineering, RAG, deterministic patterns",
  "🌿 Orchestration": "Semantic Kernel, agents, MCP tools",
  "🍃 Operations": "Azure AI platform, infrastructure, Copilot",
  "🍎 Transformation": "Fine-tuning, responsible AI, production",
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  F1: "Core GenAI concepts & terminology",
  F2: "GPT-4o, Claude, Llama, Phi — model comparison",
  F3: "200+ AI/ML terms with definitions",
  F4: "7 primitives, 4 layers — .github folder evolution",
  R1: "System prompts, few-shot, chain-of-thought",
  R2: "Retrieval-Augmented Generation patterns",
  R3: "temp=0, JSON schema, verification loops",
  O1: "Plugins, planners, memory, agents",
  O2: "Supervisor, handoffs, multi-agent systems",
  O3: "MCP protocol, tool calling, function patterns",
  O4: "Foundry, endpoints, deployments, RBAC",
  O5: "GPU, networking, landing zones, scaling",
  O6: "Copilot Studio, extensions, M365 integration",
  T1: "LoRA, QLoRA, data prep, MLOps pipelines",
  T2: "Safety, content filtering, red teaming",
  T3: "Caching, load balancing, cost optimization",
};

function getLayerThemeColor(hexColor: string): string {
  const map: Record<string, string> = {
    "#f59e0b": "charts.yellow",
    "#10b981": "charts.green",
    "#06b6d4": "charts.blue",
    "#6366f1": "charts.purple",
    "#7c3aed": "charts.purple",
  };
  return map[hexColor] || "foreground";
}

export class FrootModuleProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return FROOT_MODULES.map((layer: FrootLayer) => {
        const item = new vscode.TreeItem(
          layer.layer,
          vscode.TreeItemCollapsibleState.Expanded
        );
        item.contextValue = "layer";
        item.description = `${layer.modules.length} modules`;
        item.tooltip = `${layer.layer}\n${LAYER_DESCRIPTIONS[layer.layer] || ""}\n\nColor: ${layer.color}\nModules: ${layer.modules.map((m) => m.id + " " + m.name).join(", ")}`;
        item.iconPath = new vscode.ThemeIcon(
          "symbol-folder",
          new vscode.ThemeColor(getLayerThemeColor(layer.color))
        );
        return item;
      });
    }

    const layerData = FROOT_MODULES.find(
      (l: FrootLayer) => l.layer === element.label
    );
    if (layerData) {
      return layerData.modules.map((m) => {
        const item = new vscode.TreeItem(
          `${m.id}: ${m.name}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = MODULE_DESCRIPTIONS[m.id] || "";
        item.tooltip = `${m.id}: ${m.name}\n${MODULE_DESCRIPTIONS[m.id] || ""}\n\nClick to read in a rich panel`;
        item.iconPath = new vscode.ThemeIcon(
          "book",
          new vscode.ThemeColor(getLayerThemeColor(layerData.color))
        );
        item.command = {
          command: "frootai.openModule",
          title: "Open",
          arguments: [m],
        };
        return item;
      });
    }
    return [];
  }
}
