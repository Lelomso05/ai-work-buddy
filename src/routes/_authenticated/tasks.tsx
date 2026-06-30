import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prioritizeTasks } from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles,
  Trash2,
  Plus,
  Calendar,
  Pencil,
  Loader2,
  ListTodo,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  ssr: false,
  component: TasksPage,
});

type Priority = "high" | "medium" | "low";
type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  ai_suggested_priority: Priority | null;
  due_date: string | null;
  completed: boolean;
  created_at: string;
};

function TasksPage() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, priority, ai_suggested_priority, due_date, completed, created_at")
        .order("completed", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [due, setDue] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  const create = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { error } = await supabase.from("tasks").insert({
        user_id: user.user.id,
        title: title.trim(),
        priority,
        due_date: due || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setPriority("medium");
      setDue("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const updatePriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: Priority }) => {
      const { error } = await supabase.from("tasks").update({ priority }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const aiPrioritize = useServerFn(prioritizeTasks);
  const prioritize = useMutation({
    mutationFn: async () => aiPrioritize({ data: {} } as never),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      if (data?.focus) toast.success(data.focus, { duration: 6000 });
    },
    onError: (e: Error) => toast.error(e.message ?? "AI prioritization failed"),
  });

  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "open" ? !t.completed : t.completed,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Plan your day. Let the AI sort priorities for you.</p>
        </div>
        <Button
          onClick={() => prioritize.mutate()}
          disabled={prioritize.isPending || tasks.filter((t) => !t.completed).length === 0}
          className="gradient-brand text-white shadow-[var(--shadow-elegant)]"
        >
          {prioritize.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Prioritize my day
        </Button>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          create.mutate();
        }}
        className="glass-card rounded-2xl p-4"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_160px_auto]">
          <Input
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High priority</SelectItem>
              <SelectItem value="medium">Medium priority</SelectItem>
              <SelectItem value="low">Low priority</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button type="submit" disabled={create.isPending} className="gradient-brand text-white">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        {(["open", "all", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <ListTodo className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No tasks here</p>
            <p className="text-xs text-muted-foreground">Add your first task above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={(c) => toggle.mutate({ id: t.id, completed: c })}
                onDelete={() => remove.mutate(t.id)}
                onChangePriority={(p) => updatePriority.mutate({ id: t.id, priority: p })}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onChangePriority,
}: {
  task: Task;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  onChangePriority: (p: Priority) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const qc = useQueryClient();

  async function saveEdit() {
    if (!draftTitle.trim() || draftTitle === task.title) {
      setEditing(false);
      return;
    }
    const { error } = await supabase.from("tasks").update({ title: draftTitle.trim() }).eq("id", task.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["tasks"] });
    setEditing(false);
  }

  const priorityColor =
    task.priority === "high"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : task.priority === "medium"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-primary/10 text-primary border-primary/20";

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40">
      <Checkbox
        checked={task.completed}
        onCheckedChange={(c) => onToggle(Boolean(c))}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-8"
            />
            <Button size="icon" variant="ghost" onClick={saveEdit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="block w-full text-left">
            <div className={cn("truncate text-sm font-medium", task.completed && "text-muted-foreground line-through")}>
              {task.title}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.due_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              {task.ai_suggested_priority && task.ai_suggested_priority !== task.priority && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI: try {task.ai_suggested_priority}
                </span>
              )}
            </div>
          </button>
        )}
      </div>

      <Select value={task.priority} onValueChange={(v) => onChangePriority(v as Priority)}>
        <SelectTrigger className={cn("h-7 w-[110px] border text-xs", priorityColor)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit">
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </li>
  );
}