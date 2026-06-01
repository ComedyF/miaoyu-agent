import { spawn } from "node:child_process";
import path from "node:path";

const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");

const processes = [
  {
    name: "api",
    command: process.execPath,
    args: ["server/index.js"],
  },
  {
    name: "web",
    command: process.execPath,
    args: [viteBin, "--host", "127.0.0.1", "--port", "5173"],
  },
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      shutdown();
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
