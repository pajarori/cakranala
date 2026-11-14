const color = !!process.stderr.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const paint = (code: number) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

export const bold = paint(1);
export const dim = paint(2);
export const red = paint(31);
export const green = paint(32);
export const yellow = paint(33);
export const cyan = paint(36);

export const say = (s = "") => process.stderr.write(`${s}\n`);
export const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;

const WIDTH = 24;
const LABEL = 9;

export function line(mark: string, label: string, note = "", hint = "") {
  say(`  ${mark} ${label.padEnd(LABEL)} ${note}${hint ? `  ${dim(hint)}` : ""}`);
}

export const ok = (label: string, note = "") => line(green("✓"), label, dim(note));
export const missing = (label: string, note: string, hint = "") => line(red("✗"), label, note, hint);
export const optional = (label: string, note: string) => line(dim("-"), label, dim(note));

export function task(label: string) {
  let shown = 0;
  let text = "";
  const draw = (s: string) => {
    if (!color) return;
    text = s;
    process.stderr.write(`\r\x1b[2K  ${cyan("↓")} ${label.padEnd(LABEL)} ${s}`);
  };
  const clear = () => color && text && process.stderr.write("\r\x1b[2K");
  return {
    note: (s: string) => (color ? draw(dim(s)) : say(`  ${label} ${s}`)),
    progress(loaded: number, total: number) {
      const now = Date.now();
      if (now - shown < 80 && loaded < total) return;
      shown = now;
      const filled = total ? Math.min(WIDTH, Math.round((WIDTH * loaded) / total)) : 0;
      draw(`${"━".repeat(filled)}${dim("━".repeat(WIDTH - filled))}  ${mb(loaded)}${total ? ` / ${mb(total)}` : ""}`);
    },
    done: (note = "") => (clear(), ok(label, note)),
    fail: (error: string) => (clear(), missing(label, red(error))),
  };
}

export type Task = ReturnType<typeof task>;
