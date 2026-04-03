import type { Client, TextChannel } from "discord.js";
import type { AskUserQuestion, StoredSession } from "summit-types";

export interface DiscordMeta {
  threadId: string;
  channelId: string;
  guildId: string;
}

// --- Thread ↔ Session mapping ---

const threadToSession = new Map<string, string>();

export function setThreadSession(threadId: string, sessionId: string) {
  threadToSession.set(threadId, sessionId);
}

export function getSessionForThread(threadId: string): string | undefined {
  return threadToSession.get(threadId);
}

export async function rebuildThreadMap() {
  threadToSession.clear();
  const sessions = await listSessions();
  for (const session of sessions) {
    const meta = getDiscordMeta(session);
    if (meta) {
      threadToSession.set(meta.threadId, session.id);
    }
  }
  console.log(`[discord] Rebuilt thread map: ${threadToSession.size} thread(s)`);
}

// --- channelMeta helpers ---

export function getDiscordMeta(session: StoredSession): DiscordMeta | null {
  const cm = session.channelMeta as { discord?: DiscordMeta } | undefined;
  return cm?.discord ?? null;
}

export function makeChannelMeta(meta: DiscordMeta): Record<string, unknown> {
  return { discord: meta };
}

// --- Message formatting ---

const DISCORD_MAX = 2000;

export function formatResultForDiscord(text: string): string {
  if (text.length <= DISCORD_MAX) return text;
  const truncated = text.slice(0, DISCORD_MAX - 60);
  return `${truncated}\n\n… _(truncated — see Summit for full results)_`;
}

/** Check if ask_user questions have selectable options */
export function hasAskUserOptions(questions: AskUserQuestion[]): boolean {
  return questions.some((q) => q.options.length > 0);
}

/** Plain text fallback for ask_user (free-form questions) */
export function formatAskUserForDiscord(questions: AskUserQuestion[]): string {
  const lines: string[] = ["**The agent has a question:**\n"];
  for (const q of questions) {
    lines.push(`> ${q.question}`);
    if (q.options.length > 0) {
      for (const opt of q.options) {
        lines.push(`  • **${opt.label}** — ${opt.description}`);
      }
    }
  }
  lines.push("\n_Reply in this thread to answer._");
  return lines.join("\n");
}

// --- Client singleton ---

let discordClient: Client | null = null;
let discordChannelId: string | null = null;

export function setDiscordClient(client: Client, channelId: string) {
  discordClient = client;
  discordChannelId = channelId;
}

export function getDiscordClient(): Client | null {
  return discordClient;
}

export function getDiscordChannelId(): string | null {
  return discordChannelId;
}

export async function getDiscordChannel(): Promise<TextChannel | null> {
  if (!discordClient || !discordChannelId) return null;
  try {
    const ch = await discordClient.channels.fetch(discordChannelId);
    return ch as TextChannel;
  } catch {
    return null;
  }
}
