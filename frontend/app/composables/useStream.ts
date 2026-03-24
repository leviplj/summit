import type { AppEvent } from "~~/shared/types";

export function useStream() {
  function connect(
    sessionId: string,
    afterId: number,
    onEvent: (event: AppEvent) => void,
    onDone: () => void,
    onDisconnect: (lastId: number) => void,
  ) {
    fetch(`/api/sessions/${sessionId}/stream?after=${afterId}`)
      .then(async (res) => {
        if (res.status === 204 || !res.body) {
          onDone();
          return;
        }
        if (!res.ok) {
          onEvent({ type: "error", text: `HTTP ${res.status}` });
          onDone();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let lastEventId = afterId;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop()!;

            for (const line of lines) {
              if (line.startsWith("id: ")) {
                const id = Number(line.slice(4));
                if (id > lastEventId) lastEventId = id;
              } else if (line.startsWith("data: ")) {
                try {
                  onEvent(JSON.parse(line.slice(6)));
                } catch {}
              }
            }
          }
        } catch {
          onDisconnect(lastEventId);
          return;
        }

        onDone();
      })
      .catch(() => {
        onDisconnect(afterId);
      });
  }

  return { connect };
}
