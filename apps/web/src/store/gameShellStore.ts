import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AppScreen = "splash" | "cockpit" | "leaderboard" | "profile" | "settings" | "pause";
export type Difficulty = "easy" | "normal" | "hard";
export type KeyColor = "amber" | "azure" | "crimson";
export type WeaponId = "pulse" | "volley" | "shredder" | "concussion" | "nova";

export type PlayerProfile = {
  id: string;
  pilotName: string;
  accountType: "guest" | "registered";
  createdAt: string;
  updatedAt: string;
  preferredDifficulty: Difficulty;
  bestScore: number;
  bestTimeSeconds: number;
};

export type SaveState = {
  checkpointId: string;
  shields: number;
  energy: number;
  flareAmmo: number;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  keys: KeyColor[];
  destroyedEncounters: string[];
  collectedPickups: string[];
  objectiveIds: string[];
  score: number;
  elapsedSeconds: number;
  reactorArmed: boolean;
  reactorDestroyed: boolean;
};

export type LeaderboardEntry = {
  id: string;
  pilotName: string;
  levelId: string;
  difficulty: Difficulty;
  score: number;
  elapsedSeconds: number;
  escaped: boolean;
  reactorDestroyed: boolean;
  createdAt: string;
};

export const defaultLevelId = "crimson-foundry";
export const defaultPilotName = "CALLSIGN-7";

export type GameRuntimeSnapshot = {
  connected: boolean;
  frameLabel: string;
  missionName: string;
  missionTitle: string;
  objectiveLines: string[];
  reactorSecondsRemaining: number;
  ship: {
    shields: number;
    energy: number;
    flareAmmo: number;
    primaryWeapon: WeaponId;
    secondaryWeapon: WeaponId;
    keys: KeyColor[];
    velocity: number;
    drift: number;
    pitch: number;
    yaw: number;
    roll: number;
    score: number;
    elapsedSeconds: number;
    difficulty: Difficulty;
  };
  saveState: SaveState;
  warnings: string[];
  statusFlags: Array<{ label: string; tone: "normal" | "alert" | "good" }>;
};

type ShellSettings = {
  autoMapOpen: boolean;
  subtitles: boolean;
  damageFlash: boolean;
  invertY: boolean;
  musicVolume: number;
  sfxVolume: number;
};

type ShellState = {
  screen: AppScreen;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  runtime: GameRuntimeSnapshot;
  settings: ShellSettings;
  setScreen: (screen: AppScreen) => void;
  setProfileName: (pilotName: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  upgradeAccount: () => void;
  toggleSetting: (key: keyof ShellSettings) => void;
  setRuntime: (runtime: Partial<GameRuntimeSnapshot>) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
};

const nowIso = () => new Date().toISOString();

const initialProfile: PlayerProfile = {
  id: "guest-callsign-7",
  pilotName: defaultPilotName,
  accountType: "guest",
  createdAt: nowIso(),
  updatedAt: nowIso(),
  preferredDifficulty: "normal",
  bestScore: 24850,
  bestTimeSeconds: 11 * 60 + 42
};

const initialSaveState: SaveState = {
  checkpointId: "cp-hub",
  shields: 92,
  energy: 67,
  flareAmmo: 6,
  primaryWeapon: "pulse",
  secondaryWeapon: "concussion",
  keys: ["azure"],
  destroyedEncounters: ["entry-drone"],
  collectedPickups: ["flare-start", "energy-cache"],
  objectiveIds: ["reach-hub", "collect-azure"],
  score: 24850,
  elapsedSeconds: 702,
  reactorArmed: false,
  reactorDestroyed: false
};

const initialRuntime: GameRuntimeSnapshot = {
  connected: false,
  frameLabel: "Runtime bridge idle",
  missionName: defaultLevelId,
  missionTitle: "Crimson Foundry",
  objectiveLines: [
    "Reach the hub core and secure the mine layout.",
    "Collect both keycards and arm the reactor.",
    "Escape before the overload timer hits zero."
  ],
  reactorSecondsRemaining: 75,
  ship: {
    shields: 92,
    energy: 67,
    flareAmmo: 6,
    primaryWeapon: "pulse",
    secondaryWeapon: "concussion",
    keys: ["azure"],
    velocity: 14.2,
    drift: 2.8,
    pitch: -0.12,
    yaw: 1.9,
    roll: 0.04,
    score: 24850,
    elapsedSeconds: 702,
    difficulty: "normal"
  },
  saveState: initialSaveState,
  warnings: ["No engine attached yet", "HUD is running on shell state"],
  statusFlags: [
    { label: "Guest pilot", tone: "normal" },
    { label: "Weapons hot", tone: "good" },
    { label: "Reactor dormant", tone: "normal" }
  ]
};

const settingsDefault: ShellSettings = {
  autoMapOpen: true,
  subtitles: true,
  damageFlash: true,
  invertY: false,
  musicVolume: 0.72,
  sfxVolume: 0.84
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      screen: "splash",
      profile: initialProfile,
      leaderboard: [
        {
          id: "run-1",
          pilotName: "VEGA-13",
          levelId: defaultLevelId,
          difficulty: "hard",
          score: 40280,
          elapsedSeconds: 654,
          escaped: true,
          reactorDestroyed: true,
          createdAt: nowIso()
        },
        {
          id: "run-2",
          pilotName: "CALLSIGN-7",
          levelId: defaultLevelId,
          difficulty: "normal",
          score: 24850,
          elapsedSeconds: 702,
          escaped: true,
          reactorDestroyed: true,
          createdAt: nowIso()
        },
        {
          id: "run-3",
          pilotName: "NOVA-02",
          levelId: defaultLevelId,
          difficulty: "easy",
          score: 17620,
          elapsedSeconds: 816,
          escaped: true,
          reactorDestroyed: true,
          createdAt: nowIso()
        }
      ],
      runtime: initialRuntime,
      settings: settingsDefault,
      setScreen: (screen) => set({ screen }),
      setProfileName: (pilotName) =>
        set((state) => ({
          profile: {
            ...state.profile,
            pilotName,
            updatedAt: nowIso()
          }
        })),
      setDifficulty: (difficulty) =>
        set((state) => ({
          profile: {
            ...state.profile,
            preferredDifficulty: difficulty,
            updatedAt: nowIso()
          },
          runtime: {
            ...state.runtime,
            ship: {
              ...state.runtime.ship,
              difficulty
            }
          }
        })),
      upgradeAccount: () =>
        set((state) => ({
          profile: {
            ...state.profile,
            accountType: "registered",
            updatedAt: nowIso()
          },
          runtime: {
            ...state.runtime,
            statusFlags: state.runtime.statusFlags.map((flag) =>
              flag.label === "Guest pilot" ? { ...flag, label: "Registered pilot", tone: "good" } : flag
            )
          }
        })),
      toggleSetting: (key) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: typeof state.settings[key] === "boolean" ? !state.settings[key] : state.settings[key]
          }
        })),
      setRuntime: (runtime) =>
        set((state) => ({
          runtime: {
            ...state.runtime,
            ...runtime,
            ship: runtime.ship ? { ...state.runtime.ship, ...runtime.ship } : state.runtime.ship,
            saveState: runtime.saveState ?? state.runtime.saveState,
            statusFlags: runtime.statusFlags ?? state.runtime.statusFlags,
            warnings: runtime.warnings ?? state.runtime.warnings
          }
        })),
      setLeaderboard: (entries) => set({ leaderboard: entries })
    }),
    {
      name: "descent-shell",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        screen: state.screen,
        profile: state.profile,
        settings: state.settings
      })
    }
  )
);

export const shellScreens: Array<{ id: AppScreen; label: string }> = [
  { id: "splash", label: "Splash" },
  { id: "cockpit", label: "Cockpit" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
  { id: "pause", label: "Pause" }
];
