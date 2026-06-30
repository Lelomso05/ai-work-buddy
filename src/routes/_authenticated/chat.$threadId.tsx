import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getThreadMessages } from "@/lib/chat.functions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  ssr: false,
  component: ChatThread,
});

const SUGGESTIONS = [
  "Summarize this meeting transcript: …",
  "Write a professional follow-up email to a client",
  "Brainstorm 5 ideas for our next team offsite",
  "Help me draft an agenda for tomorrow's standup",
];

function ChatThread() {
  const { threadId } = useParamsHook();
  const loadMsgs = useServerFn(getThreadMessages);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: () => loadMsgs({ data: { threadId } } as never),
    enabled: !!threadId,
  });

  const initialMessages = useMemo<UIMessage[]>(
    () =>
      (history as Array<{ id: string; role: string; parts: unknown }>).map((row) => ({
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: row.parts as UIMessage["parts"],
      })),
    [history],
  );

  if (isLoading) {
    return (
      <div className="glass-card flex h-full items-center justify-center rounded-2xl">
        <Shimmer text="Loading conversation…" />
      </div>
    );
  }

  return <ChatWindow threadId={threadId} initialMessages={initialMessages} />;
}

function useParamsHook() {
  // Imported lazily so this file doesn't double-import in HMR
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useParams } = require("@tanstack/react-router") as typeof import("@tanstack/react-router");
  return useParams({ from: "/_authenticated/chat/$threadId" });
}

function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, threadId },
        }),
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Chat failed"),
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="glass-card flex h-full flex-col rounded-2xl">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-white shadow-[var(--shadow-elegant)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">How can I help you today?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Summarize meetings, draft emails, brainstorm — I'm here for it.
                </p>
              </div>
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-xl border border-border bg-card/40 p-3 text-left text-xs text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return m.role === "assistant" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap leading-relaxed">{part.text}</p>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
                {m.role === "assistant" && (
                  <CopyButton text={extractText(m)} />
                )}
              </Message>
            ))
          )}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="px-2">
              <Shimmer text="Thinking…" />
            </div>
          )}
          {error && (
            <p className="mx-4 my-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput
          onSubmit={(e) => {
            const data = new FormData(e.currentTarget as HTMLFormElement);
            const text = String(data.get("message") || "").trim();
            if (!text) return;
            sendMessage({ text });
            (e.currentTarget as HTMLFormElement).reset();
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            name="message"
            placeholder="Ask Flowdesk anything…"
            disabled={isLoading}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function extractText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
      aria-label="Copy response"
      className="ml-2 self-start"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}