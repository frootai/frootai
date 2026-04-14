---
name: "streaming-response-implement"
description: "Implement streaming AI responses with Server-Sent Events (SSE)"
---

# Streaming Response Implementation

Stream LLM completions token-by-token to the client using SSE. Streaming cuts perceived latency by 5-10x — users see the first token in ~200ms instead of waiting 3-5s for the full response.

## Azure OpenAI Streaming — Python

```python
import time, asyncio
from openai import AsyncAzureOpenAI

client = AsyncAzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_version="2024-10-21",
    azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
    # azure_ad_token_provider for Managed Identity — never use api_key in production
)

async def stream_completion(messages: list[dict], max_tokens: int = 1024):
    """Stream chat completion, yielding chunks and tracking TTFT."""
    t0 = time.perf_counter()
    ttft = None
    token_count = 0

    stream = await client.chat.completions.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.7,
        stream=True,
        stream_options={"include_usage": True},  # get token counts in final chunk
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            if ttft is None:
                ttft = (time.perf_counter() - t0) * 1000  # ms
            token_count += 1
            yield chunk.choices[0].delta.content
        # Final chunk carries usage when stream_options.include_usage=True
        if chunk.usage:
            token_count = chunk.usage.completion_tokens
    logger.info(f"TTFT={ttft:.0f}ms tokens={token_count}")
```

## FastAPI SSE Endpoint

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/v1/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    messages = body["messages"]

    async def event_generator():
        try:
            async for token in stream_completion(messages):
                # SSE format: "data: {json}\n\n"
                payload = json.dumps({"content": token, "done": False})
                yield f"data: {payload}\n\n"
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        except Exception as e:
            # Send error event so client can handle gracefully
            error_payload = json.dumps({"error": str(e), "done": True})
            yield f"event: error\ndata: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )
```

## Azure OpenAI Streaming — TypeScript

```typescript
import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

const credential = new DefaultAzureCredential();
const tokenProvider = getBearerTokenProvider(credential, "https://cognitiveservices.azure.com/.default");
const client = new AzureOpenAI({
  azureADTokenProvider: tokenProvider,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT!,
  apiVersion: "2024-10-21",
});

async function* streamCompletion(messages: Array<{role: string; content: string}>, signal?: AbortSignal) {
  const t0 = performance.now();
  let ttft: number | null = null;

  const stream = await client.chat.completions.create(
    { model: "", messages, stream: true, max_tokens: 1024, stream_options: { include_usage: true } },
    { signal } // AbortSignal for cancellation
  );

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      ttft ??= performance.now() - t0;
      yield content;
    }
  }
  console.log(`TTFT: ${ttft?.toFixed(0)}ms`);
}
```

## Express SSE Endpoint

```typescript
import express from "express";

app.post("/v1/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const controller = new AbortController();
  req.on("close", () => controller.abort()); // client disconnect = cancel

  try {
    for await (const token of streamCompletion(req.body.messages, controller.signal)) {
      res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    if (err.name !== "AbortError") {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  } finally {
    res.end();
  }
});
```

## Client-Side Consumption

```typescript
// Browser client with EventSource (GET-only) or fetch for POST
async function consumeStream(messages: object[], onToken: (t: string) => void) {
  const controller = new AbortController();
  const res = await fetch("/v1/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Parse SSE lines from buffer
    const lines = buffer.split("\n\n");
    buffer = lines.pop()!; // keep incomplete chunk
    for (const line of lines) {
      const match = line.match(/^data: (.+)$/m);
      if (match) {
        const data = JSON.parse(match[1]);
        if (data.error) throw new Error(data.error);
        if (data.content) onToken(data.content);
      }
    }
  }
  return () => controller.abort(); // return cancel function
}
```

## TTFT Optimization Checklist

1. **Use streaming from the first call** — non-streaming adds full generation latency before any response
2. **Choose the right model** — gpt-4o-mini TTFT ~150ms vs gpt-4o ~300ms for simple queries
3. **Reduce prompt size** — every 1K tokens in the prompt adds ~10-20ms to TTFT
4. **Use PTU deployments** — provisioned throughput eliminates queue wait time (biggest TTFT variable)
5. **Co-locate client and endpoint** — same Azure region reduces network RTT by 20-80ms
6. **Disable nginx/reverse-proxy buffering** — `X-Accel-Buffering: no` header or `proxy_buffering off`
7. **System prompt caching** — Azure OpenAI caches system prompts >1024 tokens, halving TTFT on cache hit

## Error Handling Mid-Stream

Streams can fail after sending partial content. Handle these cases:

| Failure Mode | Server Action | Client Action |
|---|---|---|
| Model timeout (60s+) | Send `event: error` SSE, close stream | Show partial + retry button |
| Content filter triggered | Send `event: error` with `content_filter` code | Display "response filtered" |
| Token limit reached | `finish_reason: "length"` in final chunk | Show "Continue generating?" |
| Client disconnects | Abort the OpenAI API call via AbortController | — |
| Network interruption | — | Reconnect with `Last-Event-ID` header |

## WebSocket Alternative

Use WebSocket instead of SSE when you need bidirectional communication (e.g., voice AI, real-time collaboration):

```python
# FastAPI WebSocket streaming
@app.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            async for token in stream_completion(data["messages"]):
                await websocket.send_json({"type": "token", "content": token})
            await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        pass  # client closed — stream_completion gets garbage-collected
```

**SSE vs WebSocket decision**: SSE for LLM chat (unidirectional, auto-reconnect, simpler). WebSocket for voice/real-time (bidirectional, lower overhead per message, manual reconnect).

## Monitoring Streaming Latency

Track these metrics in Application Insights or your observability stack:

```python
# Custom dimensions for streaming telemetry
telemetry = {
    "ttft_ms": ttft,                    # Time to first token
    "total_latency_ms": total_time,     # Full stream duration
    "tokens_per_second": token_count / (total_time / 1000),
    "completion_tokens": token_count,
    "prompt_tokens": prompt_token_count,
    "model": deployment_name,
    "finish_reason": finish_reason,     # "stop" | "length" | "content_filter"
    "stream_interrupted": was_cancelled,
}
logger.info("stream_complete", extra=telemetry)
```

Alert thresholds: TTFT p95 > 500ms (PAYG) or > 200ms (PTU). Tokens/sec < 30 indicates throttling.
