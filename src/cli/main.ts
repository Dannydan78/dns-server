import { parseArguments } from "./parse-arguments.js";
import { USAGE } from "./usage.js";

const result = parseArguments(process.argv.slice(2));

switch (result.kind) {
  case "help":
    console.log(USAGE);
    break;

  case "error":
    console.error(`Error: ${result.message}\n\n${USAGE}`);
    process.exitCode = 1;
    break;

  case "start":
    console.log(
      `Configuration validated: ${result.config.host}:${result.config.port}`,
    );
    console.log("The UDP server layer will be connected in the next step.");
    break;
}
