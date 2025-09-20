import { runHeadless } from '../cli/source/headless-runner';

const args = process.argv.slice(2);
let command = '';

const commandFlagIndex = args.indexOf('--command');
if (commandFlagIndex !== -1) {
  command = args.slice(commandFlagIndex + 1).join(' ');
} else {
  command = args.join(' ');
}

process.env.CONVERSATIONAL_AGENT_ROOT =
  process.env.CONVERSATIONAL_AGENT_ROOT || process.cwd();

(async () => {
  try {
    const result = await runHeadless({ command });
    if (result.stdout) {
      const output = result.stdout.endsWith('\n')
        ? result.stdout
        : `${result.stdout}\n`;
      process.stdout.write(output);
    }
    process.exit(result.exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
})();
