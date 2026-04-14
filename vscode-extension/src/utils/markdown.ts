export function markdownToHtml(markdown: string, title?: string): string {
  // Extract mermaid blocks before processing
  const mermaidBlocks: string[] = [];
  let processed = markdown.replace(
    /```mermaid\n([\s\S]*?)```/g,
    (_match: string, code: string) => {
      mermaidBlocks.push(code.trim());
      return `%%MERMAID_${mermaidBlocks.length - 1}%%`;
    }
  );

  // Basic markdown → HTML conversion
  let html = processed
    // Headers
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold + Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>'
    )
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, "<hr>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // List items
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    // Tables (basic)
    .replace(/^\|(.+)\|$/gm, (match: string) => {
      if (match.match(/^\|[\s-:|]+\|$/)) {
        return ""; // skip separator row
      }
      const cells = match
        .split("|")
        .filter((c: string) => c.trim())
        .map((c: string) => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join("")}</tr>`;
    })
    // Paragraphs (wrap remaining lines)
    .replace(
      /^(?!<[hblutpra]|<\/|<hr|<li|<tr|%%MERMAID)(.+)$/gm,
      "<p>$1</p>"
    )
    // Clean up consecutive blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, "<br>");

  // Wrap lists
  html = html.replace(/(<li>.+<\/li>\n?)+/g, "<ul>$&</ul>");
  // Wrap tables
  html = html.replace(/(<tr>.+<\/tr>\n?)+/g, "<table>$&</table>");

  // Re-insert mermaid blocks as rendered divs
  mermaidBlocks.forEach((code, i) => {
    html = html.replace(
      `%%MERMAID_${i}%%`,
      `<div class="mermaid">${code}</div>`
    );
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark', themeVariables: { primaryColor: '#1a1a2e', primaryTextColor: '#e0e0e0', primaryBorderColor: '#6366f1', lineColor: '#818cf8', background: 'transparent' } });</script>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 16px 28px; line-height: 1.65; color: #d0d0d0;
      background: #1a1a2e; max-width: 860px; margin: 0 auto;
      font-size: 13px;
    }
    h1 { color: #10b981; font-size: 1.3rem; border-bottom: 2px solid #10b98133; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #06b6d4; font-size: 1.05rem; margin-top: 1.5rem; }
    h3 { color: #6366f1; font-size: 0.92rem; }
    h4 { color: #f59e0b; font-size: 0.85rem; }
    p { font-size: 0.88rem; margin: 6px 0; }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #2a2a3e; padding: 1px 5px; border-radius: 3px; font-size: 0.82rem; color: #a5b4fc; }
    pre { background: #0d0d14; border: 1px solid #25253a; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 0.82rem; }
    pre code { background: none; padding: 0; color: #d0d0d0; }
    blockquote { border-left: 3px solid #6366f1; padding: 6px 14px; margin: 10px 0; background: #6366f108; color: #a0a0b0; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.82rem; }
    td, th { padding: 6px 10px; border: 1px solid #25253a; text-align: left; }
    tr:first-child td { font-weight: 600; background: #1a1a3e; }
    ul, ol { padding-left: 20px; }
    li { margin: 3px 0; font-size: 0.86rem; }
    hr { border: none; border-top: 1px solid #25253a; margin: 20px 0; }
    .mermaid { margin: 16px 0; background: transparent; }
    .mermaid svg { max-width: 100%; }
  </style>
</head>
<body>
  ${html}
  <hr>
  <p style="font-size:0.72rem;color:#555;">
    <strong>FrootAI</strong> — From the Roots to the Fruits · 
    <a href="https://frootai.dev">Website</a> · 
    <a href="https://github.com/frootai/frootai">GitHub</a>
  </p>
</body>
</html>`;
}
