import assert from "node:assert/strict";
import test from "node:test";

import { decodeFlags } from "../../src/dns/decode-flags.js";
import { decodeQuery } from "../../src/dns/decode-query.js";
import {
  encodeAResponse,
  encodeEmptyResponse,
} from "../../src/dns/encode-response.js";

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

test("encode un Resource Record A avec une IPv4 et un TTL", () => {
  const result = encodeAResponse(createQuery(), {
    records: [{ address: "192.0.2.1", ttl: 300 }],
    authoritativeAnswer: true,
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

  assert.equal(decoded.query.header.answerCount, 1);
  assert.equal(decoded.query.flags.authoritativeAnswer, true);

  const answer = result.payload.subarray(decoded.bytesRead);
  const encodedName = Buffer.from([
    0x07,
    ...Buffer.from("example"),
    0x03,
    ...Buffer.from("com"),
    0x00,
  ]);

  assert.deepEqual(answer.subarray(0, encodedName.length), encodedName);

  const fieldsOffset = encodedName.length;
  assert.equal(answer.readUInt16BE(fieldsOffset), 1);
  assert.equal(answer.readUInt16BE(fieldsOffset + 2), 1);
  assert.equal(answer.readUInt32BE(fieldsOffset + 4), 300);
  assert.equal(answer.readUInt16BE(fieldsOffset + 8), 4);
  assert.deepEqual(
    answer.subarray(fieldsOffset + 10, fieldsOffset + 14),
    Buffer.from([192, 0, 2, 1]),
  );
});

test("encode tous les records d'un même RRset A", () => {
  const result = encodeAResponse(createQuery(), {
    records: [
      { address: "192.0.2.1", ttl: 300 },
      { address: "198.51.100.2", ttl: 600 },
    ],
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

  assert.equal(decoded.query.header.answerCount, 2);

  const encodedNameLength = 13;
  const resourceRecordLength = encodedNameLength + 14;
  const firstRecordOffset = decoded.bytesRead;
  const secondRecordOffset = firstRecordOffset + resourceRecordLength;

  assert.equal(result.payload.readUInt32BE(firstRecordOffset + 17), 300);
  assert.deepEqual(
    result.payload.subarray(firstRecordOffset + 23, firstRecordOffset + 27),
    Buffer.from([192, 0, 2, 1]),
  );
  assert.equal(result.payload.readUInt32BE(secondRecordOffset + 17), 600);
  assert.deepEqual(
    result.payload.subarray(secondRecordOffset + 23, secondRecordOffset + 27),
    Buffer.from([198, 51, 100, 2]),
  );
});

test("refuse une adresse qui n'est pas une IPv4", () => {
  assert.deepEqual(
    encodeAResponse(createQuery(), {
      records: [{ address: "2001:db8::1", ttl: 300 }],
    }),
    {
      ok: false,
      error: "INVALID_IPV4_ADDRESS",
      address: "2001:db8::1",
    },
  );
});

test("refuse un TTL qui ne tient pas dans un entier non signé de 32 bits", () => {
  assert.deepEqual(
    encodeAResponse(createQuery(), {
      records: [{ address: "192.0.2.1", ttl: 0x1_0000_0000 }],
    }),
    {
      ok: false,
      error: "INVALID_TTL",
      ttl: 0x1_0000_0000,
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
