## Convert a File with Markitdown

Once `markitdown` is attached, its tools are exposed under the `markitdown.*` namespace and routed by the federation kernel automatically — no extra configuration needed in your agent.

### Try it from chat

From the FrootAI chat (or any MCP-aware agent like GitHub Copilot Chat with the `frootai-federated` server connected), ask:

> Convert `quarterly-report.pdf` to Markdown.

The agent will discover the `markitdown.convert_local_file` tool, invoke it via the federation kernel, and stream back the Markdown body.

### What's happening under the hood

- Your agent calls `markitdown.convert_local_file` on the `frootai-federated` MCP server
- The kernel routes the call to the attached `markitdown` area (no re-spawn)
- The result streams back through the same channel
- The status bar's idle timer for `markitdown` resets

### See what else is attached

Click **See Attached Areas** above (or run `FrootAI: List Attached MCP Areas` from the Command Palette) to confirm the area is healthy + see its current tool count.

You're now using FrootAI Federation. Welcome to the orchard.
