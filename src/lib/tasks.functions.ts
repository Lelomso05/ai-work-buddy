import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText, Output } from "ai";
import { z } from "zod";

const Suggestion = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      reason: z.string(),
    }),
  ),
  focus: z.string(),
});

export const prioritizeTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, title, description, priority, due_date, completed")
      .eq("user_id", userId)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    if (!tasks || tasks.length === 0) {
      return { suggestions: [], focus: "No open tasks — enjoy the clear runway." };
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const today = new Date().toISOString().slice(0, 10);
    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: Suggestion }),
      system:
        "You are an executive assistant. Re-prioritize the user's open tasks based on due dates, urgency and impact. Return one suggestion per task with id, priority (high/medium/low) and a brief one-line reason. Also produce a short 'focus' line summarising what to do first today.",
      prompt: `Today is ${today}. Tasks JSON:\n${JSON.stringify(tasks)}`,
    });

    // Persist AI suggestions
    await Promise.all(
      output.suggestions.map((s) =>
        supabase
          .from("tasks")
          .update({ ai_suggested_priority: s.priority })
          .eq("id", s.id)
          .eq("user_id", userId),
      ),
    );

    return output;
  });