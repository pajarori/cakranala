import { useEffect, useState } from "react";
import { BarChart } from "@/components/ui/bar-chart";
import { SortableTable } from "@/components/ui/sortable-table";
import { Panel } from "@/components/kit";
import { api, pct, type AblationRow, type View } from "@/lib/api";

export function Arena({ view }: { view: View }) {
  const [data, setData] = useState<{ seeds: number[]; rows: AblationRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.ablation().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-5">
      <Panel title="Detection by operation type">
        {error ? (
          <div className="text-danger">{error}</div>
        ) : !data ? (
          <div className="py-16 text-center text-fg-3">Running ablation…</div>
        ) : (
          <>
            <BarChart
              data={data.rows.map((r) => ({ name: r.name, paid: r.paid * 100, botfarm: r.botfarm * 100, swarm: r.swarm * 100 }))}
              categoryKey="name"
              label="Recall by operation type"
              series={[
                { key: "botfarm", label: "Bot farm" },
                { key: "paid", label: "Paid buzzer" },
                { key: "swarm", label: "LLM swarm" },
              ]}
              layout="horizontal"
              formatValue={(v) => `${Math.round(v)}%`}
              legend
            />
          </>
        )}
      </Panel>

      {data && (
        <Panel title="Precision & false positives">
          <SortableTable<AblationRow>
            caption="Ablation"
            getRowId={(r) => r.name}
            rows={data.rows}
            columns={[
              { key: "name", header: "Configuration", sortValue: (r) => r.name },
              { key: "precision", header: "Precision", numeric: true, cell: (r) => pct(r.precision), sortValue: (r) => r.precision },
              { key: "recall", header: "Recall", numeric: true, cell: (r) => pct(r.recall), sortValue: (r) => r.recall },
              { key: "f1", header: "F1", numeric: true, cell: (r) => r.f1.toFixed(2), sortValue: (r) => r.f1 },
              { key: "org", header: "Organic FP", numeric: true, cell: (r) => pct(r.organicFP), sortValue: (r) => r.organicFP },
              { key: "viral", header: "Viral FP", numeric: true, cell: (r) => pct(r.viralFP), sortValue: (r) => r.viralFP },
            ]}
          />
        </Panel>
      )}

      {view.evaluation && (
        <Panel title="Current run vs ground truth">
          <div className="grid gap-3 md:grid-cols-3">
            {view.evaluation.operations.map((o) => (
              <div key={o.id} className="rounded-lg border border-line p-3">
                <div className="text-[12px] uppercase tracking-wider text-fg-3">
                  {o.id} · {o.kind}
                </div>
                <div className="tabular mt-1 text-xl">{pct(o.recall)}</div>
                <div className="text-[12px] text-fg-3">of {o.size}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
