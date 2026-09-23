import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../extension/data.js", import.meta.url), "utf8");
const context = { console, URL, Set, Date, Number, Object, String, Math };
vm.createContext(context);
vm.runInContext(source, context);

test("backup validation accepts a valid versioned counts-only backup", () => {
  const result = context.thValidateBackup({
    formatVersion: 1,
    data: {
      samples: [{ ts: 1, t: 4, w: 1 }],
      actions: [{ ts: 1, kind: "old", closed: 1, discarded: 0 }],
      settings: { retention: "90d" },
    },
  });
  assert.equal(result.samples.length, 1);
});

test("backup validation rejects URLs and malformed rows", () => {
  assert.throws(
    () =>
      context.thValidateBackup({
        formatVersion: 1,
        data: { samples: [{ ts: 1, t: 1, w: 1, url: "https://example.com" }] },
      }),
    /invalid sample row/,
  );
  assert.throws(
    () => context.thValidateBackup({ formatVersion: 2, data: {} }),
    /unsupported backup format/,
  );
});

test("duration and retention helpers preserve expected behavior", () => {
  assert.equal(context.thParseDuration("2h30m"), 9_000_000);
  assert.equal(context.thParseDuration(""), null);
  assert.equal(context.thRetentionMs("all"), Infinity);
});
