import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM = `You are Flowdesk, an AI workplace productivity assistant. Help the user:
- Summarize meetings and notes
- Draft and improve professional emails and reports
- Brainstorm ideas, agendas and action items
- Answer workplace questions clearly and concisely
Style: warm, professional, structured. Use markdown (headings, bullet lists, **bold** key points) when helpful. Keep replies focused and skimmable.`;

type ChatRequestBody = { messages?: unknown; threadId?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        const { messages, threadId } = body;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Authenticate user via bearer
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace(/^Bearer /, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub;

        const uiMessages = messages as UIMessage[];
        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM,
          messages: await convertToModelMessages(uiMessages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ messages: finalMessages }) => {
            if (!threadId) return;
            // Persist only the latest user message and final assistant message
            const lastUser = [...finalMessages].reverse().find((m) => m.role === "user");
            const lastAssistant = finalMessages.at(-1);
            const rowsToInsert: Array<{
              thread_id: string;
              user_id: string;
              role: string;
              parts: unknown;
            }> = [];
            if (lastUser) {
              rowsToInsert.push({
                thread_id: threadId,
                user_id: userId,
                role: "user",
                parts: lastUser.parts as unknown,
              });
            }
            if (lastAssistant && lastAssistant.role === "assistant") {
              rowsToInsert.push({
                thread_id: threadId,
                user_id: userId,
                role: "assistant",
                parts: lastAssistant.parts as unknown,
              });
            }
            if (rowsToInsert.length) {
              const { error: insertError } = await supabase
                .from("chat_messages")
                .insert(rowsToInsert as never);
              if (insertError) console.error("chat insert failed", insertError);
            }
            // Update thread title from first user message if still default
            if (lastUser) {
              const firstText = (lastUser.parts as Array<{ type: string; text?: string }>).find(
                (p) => p.type === "text",
              )?.text;
              if (firstText) {
                const title = firstText.slice(0, 60);
                await supabase
                  .from("chat_threads")
                  .update({ title, updated_at: new Date().toISOString() })
                  .eq("id", threadId)
                  .eq("user_id", userId)
                  .eq("title", "New conversation");
                await supabase
                  .from("chat_threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId)
                  .eq("user_id", userId);
              }
            }
          },
        });
      },
    },
  },
});