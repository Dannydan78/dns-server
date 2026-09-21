import assert from "node:assert/strict";
import test from "node:test";

import { decodeFlags } from "../../src/dns/decode-flags.js";
import { decodeQuery } from "../../src/dns/decode-query.js";
import { encodeEmptyResponse } from "../../src/dns/encode-response.js";

import type { ValidatedQuery } from "../../src/dns/validate-query.js";

test("encode une réponse corrélée à la requête et recopie sa question", () => {
  const query = createQuery(0x0110);
  const result = encodeEmptyResponse(query, {
    responseCode: 0,
    recursionAvailable: true,
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  const decoded = decodeQuery(result.payload);
  assert.equal(decoded.ok, true);

  if (!decoded.ok) {
    return;
  }

  assert.equal(decoded.query.header.id, 0x1234);
  assert.equal(decoded.query.flags.isResponse, true);
  assert.equal(decoded.query.flags.recursionDesired, true);
  assert.equal(decoded.query.flags.recursionAvailable, true);
  assert.equal(decoded.query.flags.checkingDisabled, true);
  assert.equal(decoded.query.flags.responseCode, 0);
  assert.deepEqual(decoded.query.questions, query.questions);
});

test("encode les propriétés choisies par le serveur", () => {
  const result = encodeEmptyResponse(createQuery(), {
    responseCode: 3,
    authoritativeAnswer: true,
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  const flags = result.payload.readUInt16BE(2);

  assert.deepEqual(decodeFlags(flags), {
    isResponse: true,
    opcode: 0,
    authoritativeAnswer: true,
    truncated: false,
    recursionDesired: false,
    recursionAvailable: false,
    reservedZ: false,
    authenticatedData: false,
    checkingDisabled: false,
    responseCode: 3,
  });
});

test("refuse un RCODE qui ne tient pas dans les quatre bits du header", () => {
  assert.deepEqual(
    encodeEmptyResponse(createQuery(), { responseCode: 16 }),
    {
      ok: false,
      error: "INVALID_RESPONSE_CODE",
      responseCode: 16,
    },
  );
});

test("refuse un label qui dépasse 63 octets", () => {
  const query = createQuery();
  query.questions[0].name = "a".repeat(64);

  assert.deepEqual(
    encodeEmptyResponse(query, { responseCode: 0 }),
    {
      ok: false,
      error: "LABEL_TOO_LONG",
      label: "a".repeat(64),
      actualBytes: 64,
      maximumBytes: 63,
    },
  );
});

function createQuery(flags = 0): ValidatedQuery {
  return {
    header: {
      id: 0x1234,
      flags,
      questionCount: 1,
      answerCount: 0,
      authorityCount: 0,
      additionalCount: 0,
    },
    flags: decodeFlags(flags),
    questions: [{ name: "example.com", type: 1, class: 1 }],
  };
}
