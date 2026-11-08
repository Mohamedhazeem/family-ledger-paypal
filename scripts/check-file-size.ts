/**
 * File-size policy check (AGENTS §12, ADR-0013).
 * Fails when any source file under src/ exceeds 300 lines.
 * Run with: npm run check:file-size
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const LIMIT = 300;
const SRC_DIR = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

const violations: { file: string; lines: number }[] = [];
for (const file of walk(SRC_DIR)) {
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (lines > LIMIT) {
    violations.push({ file: relative(process.cwd(), file), lines });
  }
}

if (violations.length > 0) {
  console.error(`File-size violations (limit ${LIMIT} lines):`);
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.lines} lines`);
  }
  process.exit(1);
}
process.stdout.write(`File-size check passed: no src/ file exceeds ${LIMIT} lines.\n`);
