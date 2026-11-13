import { LineChart } from "@/components/ui/line-chart";
import type { Narrative } from "@/lib/api";
import { clock } from "@/lib/format";

export function Counterfactual({ narrative, height = 220 }: { narrative: Narrative; height?: number }) {
  const cf = narrative.counterfactual;
  const data = cf.all.map((v, i) => ({ t: clock(cf.start + i * cf.binSec * 1000), observed: v, organic: cf.organic[i] }));
  return (
    <LineChart
      data={data}
      xKey="t"
      label={`${narrative.id} volume`}
      series={[
        { key: "observed", label: "Observed", className: "text-danger" },
        { key: "organic", label: "Without operations", className: "text-success", variant: "dashed" },
      ]}
      height={height}
      area
      zero
    />
  );
}
