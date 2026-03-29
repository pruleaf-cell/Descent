import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentCatalog,
  contentManifest,
  getLevelSummary,
  missionBrief,
  missionRoute,
  primaryLevel
} from "./index.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(dir, "..", "dist");
const reportDir = path.join(outDir, "reports");

await mkdir(reportDir, { recursive: true });

await Promise.all([
  writeFile(path.join(outDir, "manifest.json"), JSON.stringify(contentManifest, null, 2), "utf8"),
  writeFile(path.join(outDir, "catalog.json"), JSON.stringify(contentCatalog, null, 2), "utf8"),
  writeFile(path.join(outDir, "mission-brief.json"), JSON.stringify(missionBrief, null, 2), "utf8"),
  writeFile(
    path.join(outDir, "difficulty-tuning.json"),
    JSON.stringify(contentCatalog.difficultyTuning, null, 2),
    "utf8"
  ),
  writeFile(
    path.join(outDir, "level-summary.json"),
    JSON.stringify(getLevelSummary(primaryLevel), null, 2),
    "utf8"
  ),
  writeFile(path.join(outDir, "mission-route.json"), JSON.stringify(missionRoute, null, 2), "utf8"),
  writeFile(
    path.join(reportDir, "mission-brief.md"),
    [
      `# ${missionBrief.title}`,
      "",
      `Tone: ${contentCatalog.theme}`,
      "",
      missionBrief.missionText,
      "",
      "## Objectives",
      ...missionBrief.objectiveChain.map((line) => `- ${line}`),
      "",
      "## Keys",
      ...missionBrief.keyTargets.map((line) => `- ${line}`),
      "",
      "## Combat Notes",
      ...missionBrief.combatNotes.map((line) => `- ${line}`),
      "",
      `Escape: ${missionBrief.escapeCondition}`
    ].join("\n"),
    "utf8"
  )
]);

console.log(
  JSON.stringify(
    {
      status: "ok",
      generated: [
        "manifest.json",
        "catalog.json",
        "mission-brief.json",
        "difficulty-tuning.json",
        "level-summary.json",
        "mission-route.json",
        "reports/mission-brief.md"
      ],
      levelCount: contentManifest.levels.length,
      primaryLevel: primaryLevel.id
    },
    null,
    2
  )
);
