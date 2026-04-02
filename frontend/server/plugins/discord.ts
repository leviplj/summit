import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import type { Message, ThreadChannel } from "discord.js";
import {
  rebuildThreadMap,
  setDiscordClient,
  getDiscordClient,
  getSessionForThread,
  setThreadSession,
  getDiscordMeta,
  makeChannelMeta,
  formatResultForDiscord,
  formatAskUserForDiscord,
} from "~~/server/utils/discord";
import { startQuery } from "~~/server/utils/queryManager";
import { subscribe, getActiveQuery, onQueryInit, onGlobal } from "~~/server/utils/eventBus";
import { resolveAskUser } from "~~/server/utils/interactions";
import { createWorktree } from "~~/server/utils/worktrees";
import type { StoredSession } from "~~/shared/types";

// Track threads with a pending ask_user so we know to resolve on reply
const pendingAskThreads = new Set<string>();

export default defineNitroPlugin((nitro) => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token) {
    console.log("[discord] No DISCORD_BOT_TOKEN set — bot disabled");
    return;
  }
  if (!channelId) {
    console.log("[discord] No DISCORD_CHANNEL_ID set — bot disabled");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  setDiscordClient(client, channelId);

  client.once("ready", async () => {
    console.log(`[discord] Bot ready as ${client.user?.tag}`);
    await rebuildThreadMap();
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.id === client.user?.id) return;
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
      await handleThreadReply(message);
      return;
    }

    if (message.channel.id !== channelId) return;
    await handleChannelMessage(message);
  });

  // Cross-channel: when any query starts, check if it's a web query on a Discord session
  onQueryInit(async (sessionId, source) => {
    if (source !== "web") return;
    await handleCrossChannelNotification(sessionId);
  });

  // Notify Discord thread when a session is deleted from the web UI
  onGlobal(async (event) => {
    if (event.type !== "session_deleted") return;
    await handleSessionDeleted(event.sessionId, event.meta);
  });

  nitro.hooks.hook("close", async () => {
    console.log("[discord] Shutting down bot");
    client.destroy();
  });

  client.login(token).catch((err) => {
    console.error("[discord] Failed to login:", err.message);
  });
});

// --- Channel message: create thread + session + query ---

async function handleChannelMessage(message: Message) {
  const threadName = message.content.length > 100
    ? message.content.slice(0, 97) + "..."
    : message.content;

  let thread: ThreadChannel;
  try {
    thread = await message.startThread({ name: threadName });
  } catch (err: any) {
    console.error("[discord] Failed to create thread:", err.message);
    return;
  }

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const wtPath = await createWorktree(sessionId);
  const branch = `summit/${sessionId}`;

  const session: StoredSession = {
    id: sessionId,
    title: threadName,
    model: null,
    provider: "claude-code",
    agentSessionId: null,
    projectId: null,
    worktreePath: wtPath,
    branch,
    worktrees: {},
    channelMeta: makeChannelMeta({
      threadId: thread.id,
      channelId: message.channel.id,
      guildId: message.guild?.id ?? "",
    }),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveSession(session);
  setThreadSession(thread.id, sessionId);

  await thread.send("On it.");
  await startQuery(sessionId, message.content, "discord");
  subscribeToQuery(sessionId, thread);
}

// --- Thread reply: resolve ask_user or start follow-up ---

async function handleThreadReply(message: Message) {
  const threadId = message.channel.id;
  const sessionId = getSessionForThread(threadId);
  if (!sessionId) return;

  if (pendingAskThreads.has(threadId)) {
    resolveAskUser(sessionId, { question: message.content });
    pendingAskThreads.delete(threadId);
    return;
  }

  const activeQuery = getActiveQuery(sessionId);
  if (activeQuery && !activeQuery.done) {
    await (message.channel as ThreadChannel).send("Still working on the previous request.");
    return;
  }

  await (message.channel as ThreadChannel).send("On it.");
  await startQuery(sessionId, message.content, "discord");
  subscribeToQuery(sessionId, message.channel as ThreadChannel);
}

// --- Subscribe to query events and post bookends ---

function subscribeToQuery(sessionId: string, thread: ThreadChannel) {
  const unsub = subscribe(sessionId, 0, (event) => {
    const data = event.data;

    switch (data.type) {
      case "result":
        thread.send(formatResultForDiscord(String(data.text ?? ""))).catch(logSendError);
        break;

      case "error":
        thread.send(`Error: ${data.text ?? "unknown error"}`).catch(logSendError);
        break;

      case "ask_user":
        pendingAskThreads.add(thread.id);
        thread.send(formatAskUserForDiscord(data.questions as any[] ?? [])).catch(logSendError);
        break;

      case "elicitation":
        thread.send(
          `This step requires input in the Summit web UI (session: ${sessionId}).`,
        ).catch(logSendError);
        break;

      case "done":
        unsub?.();
        break;
    }
  });
}

// --- Cross-channel: web query on a Discord-bound session ---

async function handleCrossChannelNotification(sessionId: string) {
  const session = await getStoredSession(sessionId);
  if (!session) return;

  const meta = getDiscordMeta(session);
  if (!meta) return;

  const client = getDiscordClient();
  if (!client) return;

  try {
    const thread = await client.channels.fetch(meta.threadId) as ThreadChannel | null;
    if (!thread) return;

    await thread.send("Session continued from desktop.");

    subscribe(sessionId, 0, (event) => {
      const data = event.data;
      if (data.type === "result") {
        const summary = formatResultForDiscord(String(data.text ?? "").slice(0, 200));
        thread.send(`Desktop: Done. ${summary}`).catch(logSendError);
      } else if (data.type === "error") {
        thread.send(`Desktop: Error. ${data.text ?? "unknown"}`).catch(logSendError);
      }
    });
  } catch (err: any) {
    console.error("[discord] Cross-channel notify failed:", err.message);
  }
}

async function handleSessionDeleted(sessionId: string, meta?: Record<string, unknown>) {
  const discord = (meta as { discord?: { threadId: string } } | undefined)?.discord;
  if (!discord?.threadId) return;

  const client = getDiscordClient();
  if (!client) return;

  try {
    const thread = await client.channels.fetch(discord.threadId) as ThreadChannel | null;
    if (thread) {
      await thread.send("Session deleted from Summit.");
    }
  } catch (err: any) {
    console.error("[discord] Failed to notify thread of deletion:", err.message);
  }
}

function logSendError(err: any) {
  console.error("[discord] Failed to send message:", err.message);
}
