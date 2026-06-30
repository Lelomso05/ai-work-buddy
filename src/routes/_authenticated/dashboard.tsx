import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Plus,
  Mail,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.user.id).maybeSingle();
      return { profile: data, email: user.user.email };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, priority, due_date, completed, completed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const { data: threads } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3);
      const all = tasks ?? [];
      const completed = all.filter((t) => t.completed).length;
      const open = all.filter((t) => !t.completed);
      const score = all.length === 0 ? 70 : Math.min(100, Math.round((completed / all.length) * 100));
      return { upcoming: open.slice(0, 5), completed, total: all.length, score, threads: threads ?? [] };
    },
  });

  const name = profile?.profile?.full_name ?? profile?.email?.split("@")[0] ?? "there";
  const score = stats?.score ?? 0;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl gradient-brand p-6 text-white shadow-[var(--shadow-elegant)] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/80">
              <Sparkles className="h-3.5 w-3.5" /> Today
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {name.split(" ")[0]}.
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Your AI assistant has reviewed your day. Stay focused on what matters most.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickAction to="/tasks" icon={Plus} label="New task" />
            <QuickAction to="/chat" icon={MessageSquare} label="Ask AI" />
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Productivity score" value={`${score}%`} trend="+4% this week" icon={TrendingUp} accent />
        <StatCard label="Tasks completed" value={`${stats?.completed ?? 0}`} trend={`of ${stats?.total ?? 0} total`} icon={CheckCircle2} />
        <StatCard label="Open tasks" value={`${stats?.upcoming.length ?? 0}`} trend="ready to tackle" icon={Clock} />
        <StatCard label="AI conversations" value={`${stats?.threads.length ?? 0}`} trend="recent threads" icon={MessageSquare} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming tasks
            </h2>
            <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          {stats?.upcoming.length ? (
            <ul className="divide-y divide-border">
              {stats.upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      t.priority === "high"
                        ? "bg-destructive"
                        : t.priority === "medium"
                          ? "bg-warning"
                          : "bg-primary/50",
                    )}
                    style={t.priority === "medium" ? { background: "var(--warning)" } : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                  {t.due_date && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle2} title="No open tasks" body="You're all caught up. Add a task to get going.">
              <Link to="/tasks">
                <Button size="sm" className="gradient-brand text-white">Add a task</Button>
              </Link>
            </EmptyState>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Productivity tip
          </h2>
          <div className="rounded-xl bg-primary/5 p-4 ring-1 ring-primary/10">
            <Sparkles className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm leading-relaxed">
              <strong>Two-minute rule.</strong> If a task takes less than two minutes to complete, do
              it now instead of adding it to your list. Small things stack up fast.
            </p>
          </div>

          <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent AI activity
          </h3>
          {stats?.threads.length ? (
            <ul className="space-y-2">
              {stats.threads.map((th) => (
                <li key={th.id}>
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: th.id }}
                    className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{th.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No chats yet — start one from the assistant.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ComingSoonCard icon={Mail} title="Email Generator" desc="Draft polished emails from a one-line brief." />
        <ComingSoonCard icon={FileText} title="Meeting Notes" desc="Paste notes and get clean summaries, action items and decisions." />
        <ComingSoonCard icon={TrendingUp} title="Analytics" desc="Visualize time saved and productivity trends." />
      </section>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={cn("glass-card relative overflow-hidden rounded-2xl p-5")}>
      {accent && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20" style={{ background: "var(--gradient-brand)" }} />
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{trend}</div>
    </div>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Coming soon
        </span>
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}