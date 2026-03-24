import asyncio
import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    StreamEvent,
    SystemMessage,
    UserMessage,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    ToolResultBlock,
)

app = FastAPI()
PORT = int(os.environ.get("PORT", 3000))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session_id = None

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") != "chat":
                continue

            prompt = msg["text"]
            print(f"Received prompt: {prompt}")

            opts = ClaudeAgentOptions(
                permission_mode="bypassPermissions",
                include_partial_messages=True,
                cwd=os.getcwd(),
            )
            if session_id:
                opts.resume = session_id

            await ws.send_json({"type": "start"})

            current_tool_name = None
            current_tool_input = ""

            try:
                async for message in query(prompt=prompt, options=opts):

                    if isinstance(message, SystemMessage):
                        if message.subtype == "init":
                            sid = message.data.get("session_id")
                            if sid and session_id is None:
                                session_id = sid
                                print(f"Session started: {sid}")
                            await ws.send_json({
                                "type": "init",
                                "model": message.data.get("model"),
                                "tools": len(message.data.get("tools", [])),
                            })

                    elif isinstance(message, StreamEvent):
                        se = message.event

                        if se.get("type") == "content_block_start":
                            cb = se.get("content_block", {})
                            if cb.get("type") == "thinking":
                                await ws.send_json({"type": "thinking"})
                            elif cb.get("type") == "tool_use":
                                current_tool_name = cb.get("name")
                                current_tool_input = ""

                        elif se.get("type") == "content_block_delta":
                            delta = se.get("delta", {})
                            if delta.get("type") == "text_delta" and delta.get("text"):
                                await ws.send_json({"type": "text", "text": delta["text"]})
                            elif delta.get("type") == "input_json_delta" and delta.get("partial_json"):
                                current_tool_input += delta["partial_json"]

                        elif se.get("type") == "content_block_stop":
                            if current_tool_name:
                                try:
                                    inp = json.loads(current_tool_input)
                                except json.JSONDecodeError:
                                    inp = {}
                                await ws.send_json({
                                    "type": "tool_use",
                                    "tool": current_tool_name,
                                    "input": inp,
                                })
                                current_tool_name = None
                                current_tool_input = ""

                    elif isinstance(message, AssistantMessage):
                        if message.error:
                            for block in message.content:
                                if isinstance(block, TextBlock):
                                    await ws.send_json({"type": "error", "text": block.text})

                    elif isinstance(message, UserMessage):
                        # Tool results
                        if message.tool_use_result:
                            r = message.tool_use_result
                            text = r.get("stdout") or r.get("content") or r.get("error") or ""
                            await ws.send_json({
                                "type": "tool_result",
                                "is_error": bool(r.get("is_error")),
                                "content": str(text)[:300],
                            })
                        elif isinstance(message.content, list):
                            for block in message.content:
                                if isinstance(block, ToolResultBlock):
                                    await ws.send_json({
                                        "type": "tool_result",
                                        "is_error": block.is_error if hasattr(block, "is_error") else False,
                                        "content": str(block.content)[:300] if hasattr(block, "content") else "",
                                    })

                    elif isinstance(message, ResultMessage):
                        await ws.send_json({
                            "type": "result",
                            "text": message.result,
                            "is_error": message.is_error,
                            "duration_ms": message.duration_ms,
                            "cost_usd": message.total_cost_usd,
                            "input_tokens": (message.usage or {}).get("input_tokens"),
                            "output_tokens": (message.usage or {}).get("output_tokens"),
                            "cache_read_tokens": (message.usage or {}).get("cache_read_input_tokens"),
                        })

            except Exception as e:
                await ws.send_json({"type": "error", "text": str(e)})

            await ws.send_json({"type": "done", "code": 0})

    except WebSocketDisconnect:
        print("Client disconnected")


@app.get("/")
async def root():
    return FileResponse("public/index.html")


app.mount("/", StaticFiles(directory="public"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
