import { useEffect, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { date } from "@/lib/format";

export interface Problem {
  title: string;
  description: string;
  detail?: string;
  action?: { label: string; to?: string; params?: Record<string, string>; run?: () => void };
}

let queue: Problem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export function showProblem(p: Problem) {
  queue = [...queue, p];
  emit();
}

export const failure = (title: string, action?: Problem["action"]) => (e: Error) => showProblem({ title, description: e.message, detail: e.stack, action });

function ProblemBody({ p }: { p: Problem }) {
  return (
    <div className="grid gap-2 text-left">
      <p className="text-sm">{p.description}</p>
      {p.detail && (
        <Accordion type="single" collapsible>
          <AccordionItem value="detail" className="border-b-0">
            <AccordionTrigger className="py-1 text-xs text-muted-foreground">Detail teknis</AccordionTrigger>
            <AccordionContent>
              <div className="flex items-start gap-2">
                <pre className="max-h-40 flex-1 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{p.detail}</pre>
                <Button variant="ghost" size="icon" aria-label="Salin detail" onClick={() => navigator.clipboard.writeText(p.detail!).then(() => toast.success("Disalin"))}>
                  <Copy />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

export function ErrorDialog() {
  const local = useSyncExternalStore(subscribe, () => queue);
  const qc = useQueryClient();
  const server = useQuery({ queryKey: ["errors"], queryFn: api.errors, refetchInterval: 15_000 }).data ?? [];
  useEffect(() => {
    if (server.length) qc.invalidateQueries({ queryKey: ["state"] });
  }, [server.length, qc]);
  const open = local.length > 0 || server.length > 0;
  const close = async () => {
    queue = [];
    emit();
    if (server.length) {
      await api.seenErrors(server.map((e) => e.id));
      qc.invalidateQueries({ queryKey: ["errors"] });
    }
  };
  const first = local[0];
  const title = local.length + server.length > 1 ? `${local.length + server.length} masalah perlu perhatian` : (first?.title ?? "Proses latar belakang gagal");
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">Daftar error yang perlu ditinjau</AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <div className="grid gap-4 pr-3">
            {local.map((p, i) => (
              <div key={`l${i}`} className="grid gap-1">
                {local.length + server.length > 1 && <p className="text-sm font-medium">{p.title}</p>}
                <ProblemBody p={p} />
              </div>
            ))}
            {server.map((e) => (
              <div key={e.id} className="grid gap-1 text-sm">
                <p>{e.text}</p>
                <p className="text-xs text-muted-foreground">{date(e.ts)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Tutup</AlertDialogCancel>
          {first?.action ? (
            first.action.to ? (
              <AlertDialogAction asChild onClick={close}>
                <Link to={first.action.to} params={first.action.params}>
                  {first.action.label}
                </Link>
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={() => (first.action!.run?.(), close())}>{first.action.label}</AlertDialogAction>
            )
          ) : server[0] ? (
            <AlertDialogAction asChild onClick={close}>
              <Link to="/threats/$id/complaints" params={{ id: server[0].caseId }}>
                Buka aduan
              </Link>
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
