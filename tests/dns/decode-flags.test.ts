import assert from "node:assert/strict";
import test from "node:test";

import { decodeFlags } from "../../src/dns/decode-flags.js";

test("décode les flags d'une réponse récursive sans erreur", () => {
  assert.deepEqual(decodeFlags(0x8180), {
    isResponse: true,
    opcode: 0,
    authoritativeAnswer: false,
    truncated: false,
    recursionDesired: true,
    recursionAvailable: true,
    reservedZ: false,
    authenticatedData: false,
    checkingDisabled: false,
    responseCode: 0,
  });
});

test("décode chaque bit et les valeurs maximales des champs groupés", () => {
  assert.deepEqual(decodeFlags(0xffff), {
    isResponse: true,
    opcode: 15,
    authoritativeAnswer: true,
    truncated: true,
    recursionDesired: true,
    recursionAvailable: true,
    reservedZ: true,
    authenticatedData: true,
    checkingDisabled: true,
    responseCode: 15,
  });
});

test("décode des flags entièrement désactivés", () => {
  assert.deepEqual(decodeFlags(0), {
    isResponse: false,
    opcode: 0,
    authoritativeAnswer: false,
    truncated: false,
    recursionDesired: false,
    recursionAvailable: false,
    reservedZ: false,
    authenticatedData: false,
    checkingDisabled: false,
    responseCode: 0,
  });
});
