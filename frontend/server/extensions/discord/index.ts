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
import type { StoredSession } from "~~/shared/types";
import type { ExtensionAPI, ExtensionFactory } from "../types";

// Track threads with a pending ask_user so we know to resolve on reply
const pendingAskThreads = new Set<string>();

const extension: ExtensionFactory = (api) => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token) {
    api.log("No DISCORD_BOT_TOKEN set — bot disabled");
    return;
  }
  if (!channelId) {
    api.log("No DISCORD_CHANNEL_ID set — bot disabled");
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
    api.log(`Bot ready as ${client.user?.tag}`);
    await rebuildThreadMap();
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.id === client.user?.id) return;
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
      await handleThreadReply(api, message);
      return;
    }

    if (message.channel.id !== channelId) return;
    await handleChannelMessage(api, message);
  });

  // Cross-channel: when any query starts, check if it's a web query on a Discord session
  api.events.onQueryInit(async (sessionId, source) => {
    if (source !== "web") return;
    await handleCrossChannelNotification(api, sessionId);
  });

  // Notify Discord thread when a session is deleted from the web UI
  api.events.onGlobal(async (event) => {
    if (event.type !== "session_deleted") return;
    await handleSessionDeleted(event.sessionId, event.meta);
  });

  api.onShutdown(() => {
    api.log("Shutting down bot");
    client.destroy();
  });

  client.login(token).catch((err) => {
    api.log(`Failed to login: ${err.message}`);
  });
};

// --- Channel message: create thread + session + query ---

async function handleChannelMessage(api: ExtensionAPI, message: Message) {
  const threadName = message.content.length > 100
    ? message.content.slice(0, 97) + "..."
    : message.content;

  let thread: ThreadChannel;
  try {
    thread = await message.startThread({ name: threadName });
  } catch (err: any) {
    api.log(`Failed to create thread: ${err.message}`);
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const wtPath = await api.worktrees.create(id);
  const branch = `summit/${id}`;

  const session: StoredSession = {
    id,
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

  await api.sessions.save(session);
  setThreadSession(thread.id, id);

  await thread.send("On it.");
  await api.queries.start(id, message.content, "discord");
  subscribeToQuery(api, id, thread);
}

// --- Thread reply: resolve ask_user or start follow-up ---

async function handleThreadReply(api: ExtensionAPI, message: Message) {
  const threadId = message.channel.id;
  const sessionId = getSessionForThread(threadId);
  if (!sessionId) return;

  if (pendingAskThreads.has(threadId)) {
    api.interactions.resolveAskUser(sessionId, { question: message.content });
    pendingAskThreads.delete(threadId);
    return;
  }

  const activeQuery = api.queries.getActive(sessionId);
  if (activeQuery && !activeQuery.done) {
    await (message.channel as ThreadChannel).send("Still working on the previous request.");
    return;
  }

  await (message.channel as ThreadChannel).send("On it.");
  await api.queries.start(sessionId, message.content, "discord");
  subscribeToQuery(api, sessionId, message.channel as ThreadChannel);
}

// --- Subscribe to query events and post bookends ---

async function subscribeToQuery(api: ExtensionAPI, sessionId: string, thread: ThreadChannel) {
  const stream = api.events.subscribe(sessionId, 0);
  if (!stream) return;

  try {
    for await (const event of stream) {
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
          return;
      }
    }
  } catch (err: any) {
    logSendError(err);
  }
}

// --- Cross-channel: web query on a Discord-bound session ---

async function handleCrossChannelNotification(api: ExtensionAPI, sessionId: string) {
  const session = await api.sessions.get(sessionId);
  if (!session) return;

  const meta = getDiscordMeta(session);
  if (!meta) return;

  const client = getDiscordClient();
  if (!client) return;

  try {
    const thread = await client.channels.fetch(meta.threadId) as ThreadChannel | null;
    if (!thread) return;

    await thread.send("Session continued from desktop.");

    const stream = api.events.subscribe(sessionId, 0);
    if (!stream) return;

    // Run in background — don't block the event handler
    (async () => {
      try {
        for await (const event of stream) {
          const data = event.data;
          if (data.type === "result") {
            const summary = formatResultForDiscord(String(data.text ?? "").slice(0, 200));
            thread.send(`Desktop: Done. ${summary}`).catch(logSendError);
          } else if (data.type === "error") {
            thread.send(`Desktop: Error. ${data.text ?? "unknown"}`).catch(logSendError);
          } else if (data.type === "done") {
            break;
          }
        }
      } catch (err: any) {
        logSendError(err);
      }
    })();
  } catch (err: any) {
    api.log(`Cross-channel notify failed: ${err.message}`);
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
    console.error("[ext:discord] Failed to notify thread of deletion:", err.message);
  }
}

function logSendError(err: any) {
  console.error("[ext:discord] Failed to send message:", err.message);
}

export default extension;
