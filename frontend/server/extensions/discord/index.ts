import {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
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
} from "~~/server/utils/discord";
import type { AskUserQuestion } from "~~/shared/types";
import type { StoredSession } from "~~/shared/types";
import type { ExtensionAPI, ExtensionFactory } from "../types";

// Track threads with pending ask_user questions
// Maps threadId → { sessionId, total question count, collected answers }
interface PendingAsk {
  sessionId: string;
  total: number;
  questions: AskUserQuestion[];
  answers: Record<string, string>;
}
const pendingAskThreads = new Map<string, PendingAsk>();

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

  // Handle select menu interactions (ask_user with options)
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("askuser:")) return;

    const threadId = interaction.channelId;
    const pending = threadId ? pendingAskThreads.get(threadId) : undefined;
    if (!pending) {
      await interaction.reply({ content: "This question has already been answered.", flags: 64 }).catch(logSendError);
      return;
    }

    const qi = parseInt(interaction.customId.slice("askuser:".length), 10);
    const question = pending.questions[qi];
    const answer = interaction.values[0] ?? "";

    if (question) {
      pending.answers[question.question] = answer;
    }

    await interaction.update({
      content: `**${question?.header || "Answer"}**: ${answer}`,
      embeds: [],
      components: [],
    }).catch(logSendError);

    // Resolve when all questions have been answered
    if (Object.keys(pending.answers).length >= pending.total) {
      api.interactions.resolveAskUser(pending.sessionId, pending.answers);
      pendingAskThreads.delete(threadId!);
    }
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

  const pending = pendingAskThreads.get(threadId);
  if (pending) {
    // Free-form text reply — resolve with the message content
    pending.answers["question"] = message.content;
    api.interactions.resolveAskUser(pending.sessionId, pending.answers);
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

        case "ask_user": {
          const questions = data.questions as AskUserQuestion[] ?? [];
          pendingAskThreads.set(thread.id, {
            sessionId,
            total: questions.length,
            questions,
            answers: {},
          });
          sendAskUser(thread, questions).catch(logSendError);
          break;
        }

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

async function sendAskUser(thread: ThreadChannel, questions: AskUserQuestion[]) {
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]!;
    const embed = new EmbedBuilder()
      .setTitle(q.header || "The agent has a question")
      .setDescription(q.question)
      .setColor(0x7C3AED);

    if (q.options.length > 0) {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`askuser:${qi}`)
        .setPlaceholder("Select an option…");

      for (const opt of q.options.slice(0, 25)) {
        select.addOptions({
          label: opt.label.slice(0, 100),
          value: opt.label,
          description: opt.description?.slice(0, 100) || undefined,
        });
      }

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      await thread.send({ embeds: [embed], components: [row] });
    } else {
      embed.setFooter({ text: "Reply in this thread to answer." });
      await thread.send({ embeds: [embed] });
    }
  }
}

function logSendError(err: any) {
  console.error("[ext:discord] Failed to send message:", err.message);
}

export default extension;
