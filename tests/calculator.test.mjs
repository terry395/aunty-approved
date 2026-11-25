// The browser calculator (coach-widget.js) must give exactly the same answers
// as the Python one (aunty-coach/calculator.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { Calc, wantsCalculator } = createRequire(import.meta.url)(path.join(root, "coach-widget.js"));

test("JS calculator matches Python calculator for every chain up to 4 picks", () => {
  const py = JSON.parse(execFileSync("python3", ["-I", path.join(root, "tests", "calc_dump.py"), path.join(root, "aunty-coach")],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  let checked = 0;
  for (const [key, expected] of Object.entries(py)) {
    const seq = key.split(">");
    const st = Calc.newState();
    const got = seq.map((p) => Calc.relativeCalculator(p, st));
    if (expected.length > seq.length) got.push(st.calcDone);
    assert.deepEqual(got, expected, "mismatch for " + key);
    checked++;
  }
  assert.ok(checked > 11000);
});

test("typed names are matched case-insensitively", () => {
  assert.equal(Calc.normalisePick("  older BROTHER "), "Older brother");
  assert.equal(Calc.normalisePick("done"), "Done");
});

test("calculator trigger words", () => {
  assert.ok(wantsCalculator("Can I use the CALCULATOR?"));
  assert.ok(wantsCalculator("show family tree step by step"));
  assert.ok(!wantsCalculator("how much is delivery"));
});
