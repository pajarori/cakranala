type Value = string | number | false | null | undefined;

export function cn(...values: Value[]) {
  let out = "";
  for (const v of values) if (v) out += (out ? " " : "") + v;
  return out;
}
