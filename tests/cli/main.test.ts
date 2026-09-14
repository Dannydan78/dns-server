import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("--help present command and this options", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli/main.ts", "--help"],
    { encoding: "utf8" },
  );

  assert.match(
    result.stdout,
    /dns-server \[--host <address>\] \[--port <number>\]/,
  );
});
