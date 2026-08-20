// Generates the initial migration from DevelopmentPlan/SCHEMA.md.
//
// SCHEMA.md is the source of truth for the data model (see CLAUDE.md), so the
// migration is derived from it rather than maintained alongside it. Run with
// `npm run db:extract`; `npm run db:check` asserts the committed migration
// still matches the document.
//
// This applies to the INITIAL migration only. Once a migration has been applied
// anywhere real, later schema changes are new migration files, written by hand
// and accompanied by the matching edit to SCHEMA.md in the same commit.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "DevelopmentPlan", "SCHEMA.md");
const TARGET = join(root, "supabase", "migrations", "20260820000000_initial_schema.sql");

/** Pull every ```sql fence out of the document, in order. */
function extractSqlBlocks(markdown) {
  const blocks = [];
  let current = null;
  let heading = "";

  for (const line of markdown.split("\n")) {
    if (current === null) {
      if (line.startsWith("#")) heading = line.replace(/^#+\s*/, "").trim();
      if (line.trim() === "```sql") current = { heading, lines: [] };
      continue;
    }
    if (line.trim() === "```") {
      blocks.push(current);
      current = null;
      continue;
    }
    current.lines.push(line);
  }

  if (current !== null) throw new Error("unterminated ```sql fence in SCHEMA.md");
  return blocks;
}

function render(blocks) {
  const header = [
    "-- GENERATED FROM DevelopmentPlan/SCHEMA.md -- DO NOT EDIT BY HAND.",
    "-- Regenerate with `npm run db:extract`. Edit SCHEMA.md instead: it is the",
    "-- source of truth for the data model and outranks this file.",
    "",
  ].join("\n");

  const body = blocks
    .map((b, i) => `\n-- ===== block ${i + 1} : ${b.heading} =====\n${b.lines.join("\n")}\n`)
    .join("");

  return header + body;
}

const sql = render(extractSqlBlocks(readFileSync(SOURCE, "utf8")));
const check = process.argv.includes("--check");

if (check) {
  if (!existsSync(TARGET)) {
    console.error(`missing ${TARGET}; run \`npm run db:extract\``);
    process.exit(1);
  }
  if (readFileSync(TARGET, "utf8") !== sql) {
    console.error(
      "The committed migration no longer matches SCHEMA.md.\n" +
        "Run `npm run db:extract` and review the diff.",
    );
    process.exit(1);
  }
  console.log("migration matches SCHEMA.md");
} else {
  writeFileSync(TARGET, sql, "utf8");
  console.log(`wrote ${TARGET}`);
}
