## Attach Markitdown

[Markitdown](https://github.com/microsoft/markitdown) is Microsoft's open-source MCP area that converts files (PDF, DOCX, PPTX, XLSX, images, audio, HTML) to clean Markdown — perfect for feeding documents to an LLM.

### Why Markitdown is a good first attach

- **Trust tier**: `first-party-ms` (no trust prompt — auto-approves)
- **Tool surface**: a small focused set of `markitdown.convert_*` tools
- **Idle-cheap**: no API calls, no auth, no quota — disconnects cleanly when idle

### Steps

1. Open the **Attach** quickpick from the Command Palette (<kbd>Ctrl+Shift+P</kbd> → `FrootAI: Attach MCP Area`) or click the action above.
2. Type `markitdown` to filter the marketplace list.
3. Select the entry and confirm — the kernel attaches the area without re-spawning.

The status bar's `$(plug) N federated` count will increment by one.
