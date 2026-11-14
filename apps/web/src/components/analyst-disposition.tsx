import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CaseConfidence, CaseDecisionReason, CaseVerdict } from "@/lib/api";
import { useCaseDecision, useSaveCaseDecision } from "@/lib/queries";

const VERDICTS: Array<{ value: CaseVerdict; label: string }> = [
  { value: "insufficient_evidence", label: "Bukti belum cukup" },
  { value: "coordinated_influence", label: "Influence operation terkoordinasi" },
  { value: "benign_coordination", label: "Koordinasi benign" },
  { value: "false_positive", label: "False positive" },
];
const CONFIDENCES: Array<{ value: CaseConfidence; label: string }> = [
  { value: "low", label: "Rendah" },
  { value: "medium", label: "Sedang" },
  { value: "high", label: "Tinggi" },
];
const REASONS: Array<{ value: CaseDecisionReason; label: string }> = [
  { value: "copy_paste", label: "Copy-paste / teks identik" },
  { value: "synchronized_actions", label: "Aksi serentak" },
  { value: "shared_urls_or_tags", label: "URL atau tagar bersama" },
  { value: "rhythm_or_cadence", label: "Ritme / cadence" },
  { value: "lifecycle_pattern", label: "Pola lifecycle akun" },
  { value: "statistical_cluster", label: "Bukti statistik cluster" },
];

export function AnalystDisposition({ caseId }: { caseId: string }) {
  const query = useCaseDecision(caseId);
  const save = useSaveCaseDecision(caseId);
  const [verdict, setVerdict] = useState<CaseVerdict>("insufficient_evidence");
  const [confidence, setConfidence] = useState<CaseConfidence>("medium");
  const [reasons, setReasons] = useState<CaseDecisionReason[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const decision = query.data;
    if (!decision) return;
    setVerdict(decision.verdict);
    setConfidence(decision.confidence);
    setReasons(decision.reasons);
    setNote(decision.note);
  }, [query.data]);

  const toggleReason = (reason: CaseDecisionReason) => setReasons((current) => current.includes(reason) ? current.filter((value) => value !== reason) : [...current, reason]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">Analyst disposition {query.data && <Badge variant="outline">Reviewed {query.data.reviewedBy}</Badge>}</CardTitle>
        <CardDescription>Record the human decision separately from detector output. Every update is appended to the audit trail.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isError && <Alert variant="destructive"><AlertTitle>Disposition unavailable</AlertTitle><AlertDescription>{query.error instanceof Error ? query.error.message : String(query.error)}</AlertDescription></Alert>}
        <div className="grid gap-4 @xl/main:grid-cols-2">
          <div className="flex flex-col gap-2"><label className="text-sm font-medium" htmlFor="case-verdict">Verdict</label><Select value={verdict} onValueChange={(value) => setVerdict(value as CaseVerdict)}><SelectTrigger id="case-verdict"><SelectValue /></SelectTrigger><SelectContent>{VERDICTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium" htmlFor="case-confidence">Confidence</label><Select value={confidence} onValueChange={(value) => setConfidence(value as CaseConfidence)}><SelectTrigger id="case-confidence"><SelectValue /></SelectTrigger><SelectContent>{CONFIDENCES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <fieldset className="flex flex-col gap-2"><legend className="text-sm font-medium">Evidence reasons</legend><div className="grid gap-2 @xl/main:grid-cols-2">{REASONS.map((item) => <label key={item.value} className="flex items-center gap-2 text-sm"><Input type="checkbox" className="size-4" checked={reasons.includes(item.value)} onChange={() => toggleReason(item.value)} />{item.label}</label>)}</div></fieldset>
        <div className="flex flex-col gap-2"><label className="text-sm font-medium" htmlFor="case-disposition-note">Analyst note</label><Textarea id="case-disposition-note" value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} placeholder="Apa yang mendukung atau melemahkan keputusan ini?" rows={4} /><p className="text-xs text-muted-foreground">{note.length}/4000</p></div>
        <div className="flex items-center justify-between gap-3"><div className="text-sm text-muted-foreground">{saved ? "Disposition tersimpan dan masuk audit trail." : query.data ? `Terakhir ditinjau ${new Date(query.data.reviewedAt).toLocaleString("id-ID")}` : "Belum ada disposition."}</div><Button disabled={save.isPending || query.isPending} onClick={() => save.mutate({ verdict, confidence, reasons, note }, { onSuccess: () => setSaved(true) })}>{save.isPending && <Spinner />} Simpan disposition</Button></div>
      </CardContent>
    </Card>
  );
}
