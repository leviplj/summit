import type { ExtensionAPI } from "./types";
import { getStoredSession, saveSession, listSessions } from "~~/server/utils/sessions";
import {
  onQueryInit,
  onGlobal,
  subscribe,
  emit,
  getActiveQuery,
} from "~~/server/utils/eventBus";
import { startQuery } from "~~/server/utils/queryManager";
import { registerProvider } from "~~/server/providers/registry";
import { resolveAskUser, createPendingAskUser } from "~~/server/utils/interactions";
import { createWorktree } from "~~/server/utils/worktrees";

export function createExtensionAPI(
  name: string,
  shutdownHooks: Array<() => void | Promise<void>>,
): ExtensionAPI {
  return {
    name,

    log(message: string) {
      console.log(`[ext:${name}] ${message}`);
    },

    onShutdown(callback) {
      shutdownHooks.push(callback);
    },

    sessions: {
      get: getStoredSession,
      save: saveSession,
      list: listSessions,
    },

    events: {
      onQueryInit,
      onGlobal,
      subscribe,
      emit,
    },

    queries: {
      start: startQuery,
      getActive: getActiveQuery,
    },

    providers: {
      register: registerProvider,
    },

    interactions: {
      resolveAskUser,
      createPendingAskUser,
    },

    worktrees: {
      create: createWorktree,
    },
  };
}
