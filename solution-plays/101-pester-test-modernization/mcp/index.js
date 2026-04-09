// MCP Plugin for Pester Test Modernization
// Registers play-specific tools with the FrootAI MCP server

module.exports = {
  name: "101-pester-test-modernization",
  version: "1.0.0",
  tools: [
    {
      name: "fai_meta_agent_search",
      description: "Search Pester Test Modernization knowledge base",
      parameters: { query: { type: "string", required: true } }
    },
    {
      name: "fai_meta_agent_evaluate",
      description: "Run evaluation for Pester Test Modernization",
      parameters: { test_set: { type: "string", default: "evaluation/test-set.jsonl" } }
    }
  ]
};
