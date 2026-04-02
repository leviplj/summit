export function useGlobalEvents(onSessionChange: () => void) {
  let controller: AbortController | null = null;

  function connect() {
    controller = new AbortController();
    fetch("/api/events/stream", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "session_created" || event.type === "session_deleted" || event.type === "session_updated") {
                  onSessionChange();
                }
              } catch {}
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        // Reconnect after disconnect
        if (controller && !controller.signal.aborted) {
          setTimeout(connect, 2000);
        }
      });
  }

  onMounted(connect);
  onUnmounted(() => {
    controller?.abort();
    controller = null;
  });
}
