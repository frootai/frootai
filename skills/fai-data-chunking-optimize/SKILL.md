---
name: data-chunking-optimize
description: "Optimize RAG chunking, overlap, and metadata boundaries - improve retrieval recall, reduce noisy context, and preserve citation quality"
---

# Data Chunking Optimize

Optimize document chunking for RAG retrieval quality. Covers strategy selection, token-accurate sizing with tiktoken, document-type-aware splitting, metadata preservation, and evaluation via retrieval recall.

## Chunking Strategies

### Fixed-Size with Overlap
Split documents into uniform token windows. Simple, predictable, works for homogeneous text. Set overlap to 10-20% of chunk size to avoid splitting mid-sentence at boundaries.

### Semantic Chunking
Split on sentence or paragraph boundaries using NLP segmentation. Produces variable-length chunks that respect meaning. Use when documents have flowing prose without clear structural markers.

### Document-Structure-Aware
Split using native document structure — PDF sections, HTML headings, markdown `##` headers. Preserves logical units. Best for structured content like technical docs, reports, and knowledge bases.

**Selection rule:** Use structure-aware when documents have headings. Fall back to semantic for unstructured prose. Use fixed-size only for uniform corpora (e.g., legal clauses, log entries).

## Chunk Size Selection

| Token Size | Use Case | Trade-off |
|-----------|----------|-----------|
| 256 | FAQ, short answers | High recall, low context per chunk |
| 512 | General RAG, support docs | Balanced — default starting point |
| 1024 | Technical documentation | More context, fewer chunks retrieved |
| 2048 | Long-form analysis, legal | Rich context, risk of noise in retrieval |

Start with **512 tokens**. Measure retrieval recall@5 and adjust. If answers require cross-chunk reasoning, increase to 1024. If retrieval returns irrelevant content, decrease to 256.

## Configuration — config/chunking.json

```json
{
  "strategy": "structure-aware",
  "chunk_size_tokens": 512,
  "overlap_tokens": 64,
  "overlap_percent": 0.125,
  "min_chunk_tokens": 50,
  "max_chunk_tokens": 1024,
  "tokenizer": "cl100k_base",
  "structure_separators": {
    "markdown": ["## ", "### ", "---"],
    "html": ["h1", "h2", "h3", "section"],
    "pdf": "section_headings"
  },
  "metadata_fields": ["source", "page", "section", "chunk_index"],
  "batch": {
    "concurrency": 4,
    "checkpoint_every": 100
  }
}
```

## Python Implementation

### Token-Accurate Chunking with tiktoken

```python
import tiktoken

def count_tokens(text: str, model: str = "cl100k_base") -> int:
    enc = tiktoken.get_encoding(model)
    return len(enc.encode(text))

def chunk_fixed_overlap(text: str, chunk_size: int = 512, overlap: int = 64) -> list[dict]:
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    chunks = []
    start = 0
    idx = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_text = enc.decode(tokens[start:end])
        chunks.append({"text": chunk_text, "chunk_index": idx, "token_count": end - start})
        start += chunk_size - overlap
        idx += 1
    return chunks
```

### Document-Structure-Aware Splitting

```python
import re
from pathlib import Path

def chunk_markdown(text: str, max_tokens: int = 512) -> list[dict]:
    """Split markdown by headings, merge small sections, break large ones."""
    sections = re.split(r'(?=^#{1,3}\s)', text, flags=re.MULTILINE)
    chunks, current, current_heading = [], "", "intro"

    for section in sections:
        heading_match = re.match(r'^(#{1,3})\s+(.+)', section)
        heading = heading_match.group(2).strip() if heading_match else current_heading

        if count_tokens(current + section) <= max_tokens:
            current += section
            current_heading = heading
        else:
            if current.strip():
                chunks.append({"text": current.strip(), "section": current_heading})
            if count_tokens(section) > max_tokens:
                # Break oversized section with fixed-overlap fallback
                sub_chunks = chunk_fixed_overlap(section, max_tokens, max_tokens // 8)
                for sc in sub_chunks:
                    sc["section"] = heading
                chunks.extend(sub_chunks)
                current = ""
            else:
                current = section
                current_heading = heading

    if current.strip():
        chunks.append({"text": current.strip(), "section": current_heading})
    return chunks

def chunk_html(html: str, max_tokens: int = 512) -> list[dict]:
    """Split HTML by heading tags, strip tags for chunk text."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    chunks, current_text, current_heading = [], [], "body"

    for element in soup.descendants:
        if element.name in ("h1", "h2", "h3", "section"):
            if current_text:
                combined = " ".join(current_text)
                chunks.append({"text": combined, "section": current_heading})
                current_text = []
            current_heading = element.get_text(strip=True)
        elif element.string and element.string.strip():
            current_text.append(element.string.strip())

    if current_text:
        chunks.append({"text": " ".join(current_text), "section": current_heading})
    return chunks
```

### Metadata Preservation

```python
def enrich_chunks(chunks: list[dict], source: str, page: int | None = None) -> list[dict]:
    """Attach source provenance to every chunk for citation and filtering."""
    for i, chunk in enumerate(chunks):
        chunk["source"] = source
        chunk["chunk_index"] = i
        chunk["token_count"] = count_tokens(chunk["text"])
        if page is not None:
            chunk["page"] = page
    return chunks
```

## Batch Processing Pipeline

```python
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

def process_corpus(input_dir: str, config_path: str, output_path: str):
    with open(config_path) as f:
        cfg = json.load(f)

    files = list(Path(input_dir).rglob("*"))
    all_chunks = []

    def process_file(file_path: Path) -> list[dict]:
        text = file_path.read_text(encoding="utf-8", errors="replace")
        ext = file_path.suffix.lower()

        if ext == ".md":
            chunks = chunk_markdown(text, cfg["chunk_size_tokens"])
        elif ext in (".html", ".htm"):
            chunks = chunk_html(text, cfg["chunk_size_tokens"])
        else:
            chunks = chunk_fixed_overlap(text, cfg["chunk_size_tokens"], cfg["overlap_tokens"])

        return enrich_chunks(chunks, source=str(file_path))

    with ThreadPoolExecutor(max_workers=cfg["batch"]["concurrency"]) as pool:
        for result in pool.map(process_file, files):
            all_chunks.extend(result)

    Path(output_path).write_text(json.dumps(all_chunks, indent=2))
    print(f"Chunked {len(files)} files → {len(all_chunks)} chunks")
```

## Evaluation Metrics

Measure chunking quality by retrieval performance, not chunk count.

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Retrieval Recall@5 | ≥ 0.85 | % of ground-truth answers found in top-5 chunks |
| Chunk Relevance | ≥ 0.80 | LLM-judged relevance of retrieved chunks to query |
| Avg Chunk Tokens | 400-600 | Mean token count across corpus (for 512 target) |
| Boundary Quality | < 5% | % of chunks starting/ending mid-sentence |

```python
def evaluate_chunking(queries: list[dict], retriever, k: int = 5) -> dict:
    """queries = [{"question": str, "gold_chunk_ids": set[str]}, ...]"""
    hits = 0
    for q in queries:
        results = retriever.search(q["question"], top_k=k)
        retrieved_ids = {r["chunk_id"] for r in results}
        if q["gold_chunk_ids"] & retrieved_ids:
            hits += 1
    return {"recall_at_k": hits / len(queries), "k": k, "n_queries": len(queries)}
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Chunks split mid-sentence | Increase overlap to 15-20%, or switch to semantic strategy |
| Retrieval returns irrelevant chunks | Reduce chunk_size_tokens from 1024 → 512 |
| Too many tiny chunks | Set min_chunk_tokens to 50, merge adjacent small chunks |
| Token count mismatch in Azure AI Search | Ensure tokenizer matches embedding model (cl100k_base for text-embedding-3) |
| PDF sections not detected | Use PyMuPDF's `get_toc()` or pdfplumber's layout analysis before chunking |
