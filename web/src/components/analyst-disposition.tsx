import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { failure } from "@/components/error-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDecide, useDecision } from "@/lib/queries";
import { LAYERS, STATUS_LABEL, ago } from "@/lib/format";
import type { Confidence, Decision } from "@/lib/api";

const VERDICTS: Record<Decision["verdict"], { label: string; status: keyof typeof STATUS_LABEL }> = {
  coordinated: { label: "Operasi terkoordinasi", status: "confirmed" },
  benign: { label: "Koordinasi wajar", status: "dismissed" },
  false_positive: { label: "False positive", status: "dismissed" },
  insufficient: { label: "Bukti belum cukup", status: "investigating" },
};
const CONFIDENCE: Record<Confidence, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi" };

export function AnalystDisposition({ caseId }: { caseId: string }) {
  const { data } = useDecision(caseId);
  const decide = useDecide(caseId);
  const [verdict, setVerdict] = useState<Decision["verdict"]>("insufficient");
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [reasons, setReasons] = useState<Decision["reasons"]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!data) return;
    setVerdict(data.verdict);
    setConfidence(data.confidence);
    setReasons(data.reasons);
    setNote(data.note);
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keputusan analis</CardTitle>
        <CardDescription>{data ? `Ditinjau ${data.by} ${ago(data.at)}` : "Belum ditinjau. Keputusan dicatat terpisah dari hasil detektor dan masuk audit."}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 @xl/main:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="verdict">Verdict</FieldLabel>
              <Select value={verdict} onValueChange={(v) => setVerdict(v as Decision["verdict"])}>
                <SelectTrigger id="verdict" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VERDICTS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Status kasus menjadi {STATUS_LABEL[VERDICTS[verdict].status]}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confidence">Keyakinan</FieldLabel>
              <Select value={confidence} onValueChange={(v) => setConfidence(v as Confidence)}>
                <SelectTrigger id="confidence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONFIDENCE).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel>Sinyal yang meyakinkan</FieldLabel>
            <ToggleGroup type="multiple" variant="outline" className="flex-wrap justify-start" value={reasons} onValueChange={(v) => setReasons(v as Decision["reasons"])}>
              {Object.entries(LAYERS).map(([k, v]) => (
                <ToggleGroupItem key={k} value={k} className="px-3">
                  {v}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="note">Catatan</FieldLabel>
            <Textarea id="note" value={note} maxLength={4000} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="Apa yang menguatkan atau melemahkan keputusan ini" />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          disabled={decide.isPending}
          onClick={() => decide.mutate({ verdict, confidence, reasons, note }, { onSuccess: () => toast.success("Keputusan tersimpan"), onError: failure("Keputusan tidak tersimpan") })}
        >
          {decide.isPending ? <Spinner /> : <Save />}
          Simpan keputusan
        </Button>
      </CardFooter>
    </Card>
  );
}
