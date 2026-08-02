#!/usr/bin/env node
// Pure text-rewrite helper for reminder-fire.sh. No vault/CDP knowledge lives
// here on purpose: all the safety checks (env vars, realpath, marker file) are
// done by reminder-fire.sh *before* this is ever invoked, so this file can stay
// a small, easily-inspectable string transformation.
//
// Finds the first line in FILE containing MATCH_TEXT, and rewrites the first
// "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" date pattern on that line to MINUTES_AGO
// minutes before now (same shape: keeps the time-of-day component only if the
// original had one). This works across all three reminder formats (default
// "(@...)", Tasks plugin "⏰ ...", Kanban) because it doesn't care about the
// surrounding syntax — it only looks for the bare date/time text.
//
// Usage: node reminder-fire-rewrite.mjs <file> <matchText> <minutesAgo>
// Prints the new date/time string that was written, on success.

import { readFileSync, writeFileSync } from "node:fs";

const [, , file, matchText, minutesAgoRaw] = process.argv;
if (!file || !matchText || !minutesAgoRaw) {
  console.error("usage: reminder-fire-rewrite.mjs <file> <matchText> <minutesAgo>");
  process.exit(2);
}
const minutesAgo = Number(minutesAgoRaw);
if (!Number.isFinite(minutesAgo)) {
  console.error(`error: minutesAgo must be a number, got ${JSON.stringify(minutesAgoRaw)}`);
  process.exit(2);
}

const DATE_TIME_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
const DATE_ONLY_RE = /\d{4}-\d{2}-\d{2}/;

function pad(n) {
  return String(n).padStart(2, "0");
}

const target = new Date(Date.now() - minutesAgo * 60_000);
const withTime = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(
  target.getDate(),
)} ${pad(target.getHours())}:${pad(target.getMinutes())}`;
const dateOnly = withTime.slice(0, 10);

const original = readFileSync(file, "utf8");
const lines = original.split("\n");

let matchedLineIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(matchText)) {
    matchedLineIndex = i;
    break;
  }
}
if (matchedLineIndex === -1) {
  console.error(`error: no line in ${file} contains ${JSON.stringify(matchText)}`);
  process.exit(3);
}

const line = lines[matchedLineIndex];
let newLine;
let written;
if (DATE_TIME_RE.test(line)) {
  newLine = line.replace(DATE_TIME_RE, withTime);
  written = withTime;
} else if (DATE_ONLY_RE.test(line)) {
  newLine = line.replace(DATE_ONLY_RE, dateOnly);
  written = dateOnly;
} else {
  console.error(
    `error: matched line has no YYYY-MM-DD date pattern to rewrite: ${JSON.stringify(line)}`,
  );
  process.exit(3);
}

lines[matchedLineIndex] = newLine;
writeFileSync(file, lines.join("\n"));
console.log(written);
