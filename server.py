import asyncio
import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

PORT = int(os.environ.get("PORT", 3000))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session_id = None
    active_process = None

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") != "chat":
                continue

            if active_process is not None:
                await ws.send_json({"type": "error", "text": "A request is already in progress."})
                continue

            prompt = msg["text"]
            print(f"Received prompt: {prompt}")

            env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

            cmd = [
                "claude", "-p",
                "--output-format", "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--dangerously-skip-permissions",
            ]
            if session_id:
                cmd.extend(["--resume", session_id])
            cmd.append(prompt)

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            active_process = process

            current_tool_name = None
            current_tool_input = ""
            await ws.send_json({"type": "start"})

            try:
                async for raw_line in process.stdout:
                    line = raw_line.decode().strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if event["type"] == "system":
                        if event.get("subtype") == "init":
                            sid = event.get("session_id")
                            if sid and session_id is None:
                                session_id = sid
                                print(f"Session started: {sid}")
                            await ws.send_json({
                                "type": "init",
                                "model": event.get("model"),
                                "tools": len(event.get("tools", [])),
                            })

                    elif event["type"] == "stream_event":
                        se = event["event"]

                        if se["type"] == "content_block_start":
                            cb = se.get("content_block", {})
                            if cb.get("type") == "thinking":
                                await ws.send_json({"type": "thinking"})
                            elif cb.get("type") == "tool_use":
                                current_tool_name = cb.get("name")
                                current_tool_input = ""

                        elif se["type"] == "content_block_delta":
                            delta = se.get("delta", {})
                            if delta.get("type") == "text_delta" and delta.get("text"):
                                await ws.send_json({"type": "text", "text": delta["text"]})
                            elif delta.get("type") == "input_json_delta" and delta.get("partial_json"):
                                current_tool_input += delta["partial_json"]

                        elif se["type"] == "content_block_stop":
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

                    elif event["type"] == "assistant":
                        content = event.get("message", {}).get("content", [])
                        for block in content:
                            if block.get("type") == "text" and block.get("text"):
                                if event.get("error") or block["text"].startswith("API Error"):
                                    await ws.send_json({"type": "error", "text": block["text"]})

                    elif event["type"] == "user":
                        content = event.get("message", {}).get("content", [])
                        if isinstance(content, list):
                            for block in content:
                                if block.get("type") == "tool_result":
                                    c = block.get("content", "")
                                    await ws.send_json({
                                        "type": "tool_result",
                                        "is_error": block.get("is_error", False),
                                        "content": (c[:300] if isinstance(c, str) else ""),
                                    })
                        tur = event.get("tool_use_result")
                        if tur:
                            if isinstance(tur, str):
                                text = tur
                            else:
                                text = tur.get("stdout") or tur.get("content") or tur.get("error") or ""
                            await ws.send_json({
                                "type": "tool_result",
                                "is_error": bool(tur.get("is_error")) if isinstance(tur, dict) else False,
                                "content": str(text)[:300],
                            })

                    elif event["type"] == "result":
                        await ws.send_json({
                            "type": "result",
                            "text": event.get("result"),
                            "is_error": event.get("is_error"),
                            "duration_ms": event.get("duration_ms"),
                            "cost_usd": event.get("total_cost_usd"),
                            "input_tokens": event.get("usage", {}).get("input_tokens"),
                            "output_tokens": event.get("usage", {}).get("output_tokens"),
                            "cache_read_tokens": event.get("usage", {}).get("cache_read_input_tokens"),
                        })

            except Exception as e:
                await ws.send_json({"type": "error", "text": str(e)})

            exit_code = await process.wait()
            active_process = None
            await ws.send_json({"type": "done", "code": exit_code})

    except WebSocketDisconnect:
        print("Client disconnected")
        if active_process:
            active_process.kill()


# Serve index.html at root
@app.get("/")
async def root():
    return FileResponse("public/index.html")


# Serve remaining static files
app.mount("/", StaticFiles(directory="public"), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
