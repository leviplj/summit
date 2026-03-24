# WebSockets

## What Are WebSockets?

WebSockets are a communication protocol that provides **full-duplex, persistent connections** between a client and a server over a single TCP connection. Unlike traditional HTTP, which follows a request-response model, WebSockets allow both the client and server to send messages to each other at any time without the overhead of establishing new connections.

The WebSocket protocol is standardized as [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455) and is supported by all modern browsers.

## How WebSockets Work

### The Handshake

A WebSocket connection begins with an **HTTP upgrade handshake**:

1. The client sends a standard HTTP request with an `Upgrade: websocket` header.
2. The server responds with HTTP `101 Switching Protocols`.
3. The connection is upgraded from HTTP to a persistent WebSocket connection.

**Client Request:**

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

**Server Response:**

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### After the Handshake

Once established, the connection remains open. Both sides can send **frames** (text or binary) independently at any time until either side closes the connection.

## WebSockets vs HTTP

| Feature              | HTTP                        | WebSockets                  |
| -------------------- | --------------------------- | --------------------------- |
| Communication        | Request-Response            | Full-Duplex                 |
| Connection           | Short-lived (per request)   | Persistent                  |
| Overhead per message | High (headers each time)    | Low (minimal framing)       |
| Direction            | Client-initiated only       | Bidirectional               |
| Real-time capable    | Requires polling/SSE        | Natively real-time          |
| Protocol             | `http://` / `https://`      | `ws://` / `wss://`          |

## Common Use Cases

- **Chat applications** — Real-time messaging between users.
- **Live notifications** — Push updates to users without polling.
- **Online gaming** — Low-latency, bidirectional game state updates.
- **Collaborative editing** — Multiple users editing a document simultaneously.
- **Financial tickers** — Streaming stock prices and trade data.
- **IoT dashboards** — Live sensor data from connected devices.

## Client-Side Example (JavaScript)

```javascript
// Create a new WebSocket connection
const socket = new WebSocket("wss://example.com/socket");

// Connection opened
socket.addEventListener("open", (event) => {
  console.log("Connected to server");
  socket.send("Hello, server!");
});

// Listen for messages from the server
socket.addEventListener("message", (event) => {
  console.log("Message from server:", event.data);
});

// Handle errors
socket.addEventListener("error", (event) => {
  console.error("WebSocket error:", event);
});

// Connection closed
socket.addEventListener("close", (event) => {
  console.log("Disconnected:", event.code, event.reason);
});

// Send a message at any time
function sendMessage(msg) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(msg);
  }
}
```

## Server-Side Example (Node.js with `ws`)

```javascript
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Listen for messages from the client
  ws.on("message", (data) => {
    console.log("Received:", data.toString());

    // Echo the message back
    ws.send(`Echo: ${data}`);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  // Send a welcome message
  ws.send("Welcome to the WebSocket server!");
});
```

## Connection Lifecycle

```
Client                          Server
  |                               |
  |--- HTTP Upgrade Request ----->|
  |<-- 101 Switching Protocols ---|
  |                               |
  |===== WebSocket Open ==========|
  |                               |
  |--- text/binary frame ------->|
  |<-- text/binary frame --------|
  |<-- text/binary frame --------|
  |--- text/binary frame ------->|
  |          ...                  |
  |                               |
  |--- close frame ------------->|
  |<-- close frame --------------|
  |                               |
  |===== Connection Closed =======|
```

## Best Practices

- **Use `wss://` in production** — Always use the secure WebSocket protocol (TLS) to encrypt data in transit.
- **Implement reconnection logic** — Connections can drop; use exponential backoff when reconnecting.
- **Send heartbeats (ping/pong)** — Periodic pings detect dead connections and keep the connection alive through proxies.
- **Authenticate during the handshake** — Pass tokens via query parameters or cookies during the initial HTTP upgrade.
- **Handle backpressure** — Monitor `bufferedAmount` on the client to avoid overwhelming the connection with outgoing messages.
- **Set message size limits** — Protect your server from excessively large payloads.

## When Not to Use WebSockets

- **Simple data fetching** — Standard HTTP (REST/GraphQL) is simpler and more cacheable.
- **Unidirectional server pushes** — Server-Sent Events (SSE) are lighter weight when you only need server-to-client streaming.
- **Infrequent updates** — Polling may be simpler to implement and operate if updates are rare.

## Further Reading

- [MDN Web Docs — WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [RFC 6455 — The WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [Socket.IO](https://socket.io/) — A popular library that builds on WebSockets with fallbacks and additional features.
