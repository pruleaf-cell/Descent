import { describe, expect, it } from "vitest";
import { contentCatalog, contentManifest, missionBrief, primaryLevel } from "./index.js";
import { defaultLevelId } from "@descent/shared";

describe("content catalog", () => {
  it("exports a single handcrafted v1 mission", () => {
    expect(primaryLevel.id).toBe(defaultLevelId);
    expect(contentCatalog.levelIds).toEqual([defaultLevelId]);
    expect(contentManifest.levels[0]?.enemyCount).toBeGreaterThan(0);
  });

  it("derives a readable mission brief", () => {
    expect(missionBrief.objectiveChain).toHaveLength(primaryLevel.objectives.length);
    expect(missionBrief.combatNotes.length).toBeGreaterThan(0);
    expect(contentCatalog.gameplayBeats[0]).toContain("Entry bay");
  });
});

