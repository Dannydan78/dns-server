import { parseArgs } from "node:util";

import type { ServerConfig } from "../config/server-config.js";

export type CliResult =
  | { kind: "start"; config: ServerConfig }
  | { kind: "help" }
  | { kind: "error"; message: string };

const DEFAULT_CONFIG: ServerConfig = {
  host: "127.0.0.1",
  port: 5353,
};

export function parseArguments(args: readonly string[]): CliResult {
  try {
    const { values } = parseArgs({
      args: [...args],
      strict: true,
      allowPositionals: false,
      options: {
        host: {
          type: "string",
          default: DEFAULT_CONFIG.host,
        },
        port: {
          type: "string",
          default: String(DEFAULT_CONFIG.port),
        },
        help: {
          type: "boolean",
          default: false,
        },
      },
    });

    if (values.help) {
      return { kind: "help" };
    }

    const host = values.host ?? DEFAULT_CONFIG.host;
    const port = Number(values.port);

    if (host.trim().length === 0) {
      return {
        kind: "error",
        message: "The listening address cannot be empty.",
      };
    }

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      return {
        kind: "error",
        message: "The port must be an integer between 1 and 65535.",
      };
    }

    return {
      kind: "start",
      config: { host, port },
    };
  } catch (cause) {
    return {
      kind: "error",
      message:
        cause instanceof Error ? cause.message : "Invalid command arguments.",
    };
  }
}
