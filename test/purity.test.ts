import { expect, test } from "bun:test";
import { Glob } from "bun";

test("engine stays free of IO, runtimes and the other modules", async () => {
  const bad: string[] = [];
  for await (const file of new Glob("src/engine/**/*.ts").scan()) {
    const text = await Bun.file(file).text();
    for (const [, spec] of text.matchAll(/from "([^"]+)"/g)) if (/^(node:|bun|\.\.\/(collect|embed|cli)|\.\.\/\.\.\/)/.test(spec)) bad.push(`${file}: ${spec}`);
  }
  expect(bad).toEqual([]);
});
