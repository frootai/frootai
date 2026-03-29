// Test: does react-markdown + remark-gfm + rehype-raw break tables?
const fs = require('fs');

// Simulate what preprocessContent does
let raw = fs.readFileSync('docs/RAG-Architecture.md', 'utf-8');
let content = raw.replace(/\r\n/g, '\n');
content = content.replace(/^---[\s\S]*?---\n*/m, '');
content = content.replace(
  /^:::(\w+)\s*(.*)\n([\s\S]*?)\n^:::\s*$/gm,
  (_match, type, title, body) => {
    const titleText = (title || '').trim();
    const prefix = `> **[${type.toUpperCase()}]${titleText ? ` ${titleText}` : ''}**\n`;
    const bodyLines = body.trim().split('\n').map(l => `> ${l}`).join('\n');
    return `${prefix}>\n${bodyLines}`;
  }
);

// Check the table area (lines around "Decision Matrix")
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('Decision Matrix'));
if (idx >= 0) {
  console.log('=== Lines around Decision Matrix table ===');
  for (let i = idx; i < Math.min(idx + 16, lines.length); i++) {
    console.log(`${i+1}: [${lines[i].substring(0,100)}]`);
  }
}

// Check if there are any hidden characters
const tableStart = content.indexOf('| Dimension |');
if (tableStart >= 0) {
  const before = content.substring(tableStart - 5, tableStart);
  console.log('\n=== 5 chars before table (charCodes) ===');
  for (let i = 0; i < before.length; i++) {
    console.log(`  char[${i}]: '${before[i]}' = ${before.charCodeAt(i)}`);
  }
}
