import * as path from "path";
import * as fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let KNOWLEDGE: any = null;
let GLOSSARY: Record<string, { term: string; definition: string }> = {};

export function loadBundledKnowledge(extensionPath: string): boolean {
  try {
    const bundlePath = path.join(extensionPath, "knowledge.json");
    if (fs.existsSync(bundlePath)) {
      KNOWLEDGE = JSON.parse(fs.readFileSync(bundlePath, "utf-8"));
      // Build glossary from F3 module
      const f3 = KNOWLEDGE.modules?.F3;
      if (f3) {
        const lines: string[] = f3.content.split("\n");
        let currentTerm: string | null = null;
        let currentDef: string[] = [];
        for (const line of lines) {
          const match = line.match(/^### (.+)/);
          if (match) {
            if (currentTerm) {
              GLOSSARY[currentTerm.toLowerCase()] = {
                term: currentTerm,
                definition: currentDef.join("\n").trim(),
              };
            }
            currentTerm = match[1]
              .replace(
                /\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u,
                ""
              )
              .trim();
            currentDef = [];
          } else if (currentTerm) {
            currentDef.push(line);
          }
        }
        if (currentTerm) {
          GLOSSARY[currentTerm.toLowerCase()] = {
            term: currentTerm,
            definition: currentDef.join("\n").trim(),
          };
        }
      }
      console.log(
        `FrootAI: Loaded ${Object.keys(KNOWLEDGE.modules).length} modules, ${Object.keys(GLOSSARY).length} glossary terms`
      );
      return true;
    }
  } catch (e) {
    console.error("FrootAI: Failed to load knowledge bundle", e);
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getKnowledge(): any {
  return KNOWLEDGE;
}

export function getGlossary(): Record<
  string,
  { term: string; definition: string }
> {
  return GLOSSARY;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModules(): Record<string, any> {
  return KNOWLEDGE?.modules ?? {};
}
