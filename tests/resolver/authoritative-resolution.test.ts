import assert from "node:assert/strict";
import test from "node:test";

import { resolveAuthoritativeQuestion } from "../../src/resolver/authoritative-resolution.js";

import type { DnsQuestion } from "../../src/dns/decode-question.js";
import type { AuthoritativeZone } from "../../src/resolver/authoritative-resolution.js";

const zone = [
  {
    name: "example.test.",
    aRecords: [
      { address: "192.0.2.1", ttl: 300 },
      { address: "192.0.2.2", ttl: 300 },
    ],
  },
  {
    name: "empty.example.test",
    aRecords: [],
  },
] satisfies AuthoritativeZone;

test("retourne le RRset A associé à un nom existant", () => {
  assert.deepEqual(
    resolveAuthoritativeQuestion(zone, createQuestion("example.test", 1)),
    {
      kind: "answer",
      records: [
        { address: "192.0.2.1", ttl: 300 },
        { address: "192.0.2.2", ttl: 300 },
      ],
    },
  );
});

test("compare les noms DNS sans tenir compte de la casse ou du point final", () => {
  assert.equal(
    resolveAuthoritativeQuestion(zone, createQuestion("EXAMPLE.TEST.", 1))
      .kind,
    "answer",
  );
});

test("retourne NODATA quand le nom existe mais pas le type demandé", () => {
  assert.deepEqual(
    resolveAuthoritativeQuestion(zone, createQuestion("example.test", 28)),
    { kind: "nodata" },
  );
});

test("retourne NODATA quand le nom existe sans record A", () => {
  assert.deepEqual(
    resolveAuthoritativeQuestion(
      zone,
      createQuestion("empty.example.test", 1),
    ),
    { kind: "nodata" },
  );
});

test("retourne NXDOMAIN uniquement quand le nom n'existe pas", () => {
  assert.deepEqual(
    resolveAuthoritativeQuestion(zone, createQuestion("unknown.test", 1)),
    { kind: "nxdomain" },
  );
});

test("refuse une classe DNS que cette zone ne sert pas", () => {
  assert.deepEqual(
    resolveAuthoritativeQuestion(
      zone,
      createQuestion("example.test", 1, 3),
    ),
    { kind: "refused", reason: "UNSUPPORTED_CLASS" },
  );
});

function createQuestion(
  name: string,
  type: number,
  dnsClass = 1,
): DnsQuestion {
  return { name, type, class: dnsClass };
}
