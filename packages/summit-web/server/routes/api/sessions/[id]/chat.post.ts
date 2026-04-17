import { getSession, getProvider, saveSession } from "summit-core";
import type { AgentProvider, ChatMessage, Conversation, StoredSession, QueryContext, InteractionHooks } from "summit-types";

const DEFAULT_TITLE_RE = /^New session \d{2}-\d{2}-\d{2}$/;

function ensureLeadConversation(session: StoredSession): Conversation {
  let lead = session.conversations.find((c) => c.id === "lead");
  if (!lead) {
    lead = { id: "lead", role: "Lead", status: "idle", messages: [] };
    session.conversations.push(lead);
  }
  return lead;
}

async function generateTitle(provider: AgentProvider, firstPrompt: string): Promise<string | null> {
  try {
    const titlePrompt = `Generate a concise 3-6 word title for a conversation that starts with this user message. Respond with only the title, no quotes, no trailing punctuation, no prefix.

Message: ${firstPrompt}`;
    const raw = await provider.complete(titlePrompt);
    const title = raw.trim().replace(/^["'`]|["'`]$/g, "").replace(/\.$/, "").slice(0, 80);
    return title || null;
  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{ prompt: string }>(event);
  const prompt = body?.prompt?.trim();
  if (!prompt) {
    throw createError({ statusCode: 400, message: "Missing prompt" });
  }

  const session = await getSession(id);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  const provider = getProvider(session.provider);
  if (!provider) {
    throw createError({ statusCode: 500, message: `Provider not found: ${session.provider}` });
  }

  const lead = ensureLeadConversation(session);
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: prompt,
  };
  lead.messages.push(userMessage);
  lead.status = "working";
  await saveSession(session);

  const abortController = new AbortController();
  const hooks: InteractionHooks = {
    onAskUser: async () => {
      throw new Error("ask_user not supported yet");
    },
    onElicitation: async () => ({ action: "decline" }),
  };

  const ctx: QueryContext = {
    prompt,
    cwd: process.cwd(),
    additionalDirs: [],
    systemPromptSuffix: "",
    model: session.model,
    resumeSessionId: session.agentSessionId,
    abortSignal: abortController.signal,
  };

  const result = provider.runQuery(ctx, hooks);

  try {
    for await (const _event of result.stream) {
      // Drain the stream; option A just collects final text.
    }
  } catch (err: any) {
    lead.status = "error";
    const errorMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "error",
      content: err?.message ?? "Query failed",
    };
    lead.messages.push(errorMessage);
    await saveSession(session);
    throw createError({ statusCode: 500, message: err?.message ?? "Query failed" });
  }

  const text = result.getAssistantText();
  const meta = result.getAssistantMeta() ?? undefined;
  const newAgentSessionId = result.getSessionId();

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: text,
    meta,
  };
  lead.messages.push(assistantMessage);
  lead.status = "idle";
  if (newAgentSessionId) session.agentSessionId = newAgentSessionId;

  const isFirstExchange = lead.messages.length === 2;
  if (isFirstExchange && DEFAULT_TITLE_RE.test(session.title)) {
    const title = await generateTitle(provider, prompt);
    if (title) session.title = title;
  }

  await saveSession(session);

  return { message: assistantMessage, session };
});
