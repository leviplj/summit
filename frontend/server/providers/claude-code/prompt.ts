import type { StoredSession } from "summit-types";

export function buildSystemPrompt(session: StoredSession, extraContext?: string): string {
  let prompt = `IMPORTANT: Your working directory is current working directory.
Always create and edit files within this directory.
Never write files to the user's home directory or any path outside the working directory unless the user explicitly asks you to.

You have access to the following repos:
${Object.entries(session.worktrees).map(([repo, path]) => `- ${repo}: ${path}`).join("\n")}

IMPORTANT: If you are unsure about what to do, ask the user for clarification instead of making assumptions. Always ask before performing any action that could modify files or have side effects.

IMPORTANT: If you have a multiple choices question, use the AskUserQuestion tool to ask the user.
`;

  if (extraContext) {
    prompt += `\n${extraContext}\n`;
  }

  return prompt;
}
