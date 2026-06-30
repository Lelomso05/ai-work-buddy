import { createFileRoute, Link, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { createThread, deleteThread, listThreads } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();

  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: () => create(),
    onSuccess: (thread) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } } as never),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (pathname.endsWith(id)) navigate({ to: "/chat" });
    },
  });

  // Auto-create first thread when landing on /chat with no thread
  useEffect(() => {
    if (pathname === "/chat" && threads.length === 0 && !createMut.isPending) {
      createMut.mutate();
    } else if (pathname === "/chat" && threads.length > 0) {
      navigate({ to: "/chat/$threadId", params: { threadId: threads[0].id }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, threads.length]);

  const activeId = pathname.startsWith("/chat/") ? pathname.split("/chat/")[1] : null;

  return (
    <div className="grid h-[calc(100vh-9rem)] gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="glass-card flex flex-col rounded-2xl p-3">
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Conversations</span>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            aria-label="New chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {threads.map((t) => {
            const isActive = activeId === t.id;
            return (
              <li key={t.id} className="group relative">
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 pr-9 text-sm transition",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.title || "New conversation"}</span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    delMut.mutate(t.id);
                  }}
                  aria-label="Delete conversation"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
          {threads.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">No conversations yet</li>
          )}
        </ul>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}