const fs = require('fs');
const raw = fs.readFileSync('docs/RAG-Architecture.md','utf-8');
let c = raw.replace(/\r\n/g, '\n');
c = c.replace(/^---[\s\S]*?---\n*/m, '');
// Check lines 38-52 (table area)
const lines = c.split('\n');
for(let i=37; i<52 && i<lines.length; i++) {
  console.log(i+1, '|', lines[i].substring(0,100));
}
