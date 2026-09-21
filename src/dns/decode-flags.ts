export type DnsFlags = {
  isResponse: boolean;
  opcode: number;
  authoritativeAnswer: boolean;
  truncated: boolean;
  recursionDesired: boolean;
  recursionAvailable: boolean;
  reservedZ: boolean;
  authenticatedData: boolean;
  checkingDisabled: boolean;
  responseCode: number;
};

export function decodeFlags(flags: number): DnsFlags {
  return {
    isResponse: (flags & 0x8000) !== 0,
    opcode: (flags & 0x7800) >>> 11,
    authoritativeAnswer: (flags & 0x0400) !== 0,
    truncated: (flags & 0x0200) !== 0,
    recursionDesired: (flags & 0x0100) !== 0,
    recursionAvailable: (flags & 0x0080) !== 0,
    reservedZ: (flags & 0x0040) !== 0,
    authenticatedData: (flags & 0x0020) !== 0,
    checkingDisabled: (flags & 0x0010) !== 0,
    responseCode: flags & 0x000f,
  };
}
