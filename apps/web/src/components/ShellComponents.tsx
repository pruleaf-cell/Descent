import type { ReactNode } from "react";
import type { Difficulty, KeyColor, LeaderboardEntry, AppScreen, GameRuntimeSnapshot } from "../store/gameShellStore";

export function Panel({
  title,
  eyebrow,
  children,
  action
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          {eyebrow ? <div className="panel__eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div className="panel__action">{action}</div> : null}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Chip({
  tone = "normal",
  children
}: {
  tone?: "normal" | "good" | "alert";
  children: ReactNode;
}) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export function MenuButton({
  label,
  active,
  onClick
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`menuButton${active ? " menuButton--active" : ""}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

export function ShellHeader({
  screen,
  onChangeScreen,
  onTogglePause,
  profileName,
  accountType
}: {
  screen: AppScreen;
  onChangeScreen: (screen: AppScreen) => void;
  onTogglePause: () => void;
  profileName: string;
  accountType: string;
}) {
  return (
    <header className="shellHeader">
      <div>
        <div className="shellHeader__eyebrow">Foundry Operation Interface</div>
        <h1>Crimson Foundry</h1>
      </div>
      <nav className="shellHeader__nav" aria-label="Shell sections">
        <MenuButton label="Cockpit" active={screen === "cockpit"} onClick={() => onChangeScreen("cockpit")} />
        <MenuButton label="Leaderboard" active={screen === "leaderboard"} onClick={() => onChangeScreen("leaderboard")} />
        <MenuButton label="Profile" active={screen === "profile"} onClick={() => onChangeScreen("profile")} />
        <MenuButton label="Settings" active={screen === "settings"} onClick={() => onChangeScreen("settings")} />
        <MenuButton label="Pause" active={screen === "pause"} onClick={onTogglePause} />
      </nav>
      <div className="shellHeader__pilot">
        <span className="shellHeader__pilotName">{profileName}</span>
        <span className="shellHeader__pilotType">{accountType}</span>
      </div>
    </header>
  );
}

export function ViewportFrame({ runtime }: { runtime: GameRuntimeSnapshot }) {
  return (
    <section className="viewportFrame">
      <div className="viewportFrame__topline">
        <Chip tone={runtime.connected ? "good" : "alert"}>{runtime.connected ? "Runtime online" : "Runtime bridge pending"}</Chip>
        <Chip>{runtime.frameLabel}</Chip>
        <Chip tone="alert">{runtime.reactorSecondsRemaining > 0 ? `${runtime.reactorSecondsRemaining}s to overload` : "Reactor clear"}</Chip>
      </div>
      <div className="viewportFrame__scene">
        <div className="viewportFrame__sceneGlow" />
        <div className="viewportFrame__cockpit">
          <div className="viewportFrame__reticle" />
          <div className="viewportFrame__scanline" />
          <div className="viewportFrame__grid" />
          <div className="viewportFrame__centerLabel">6DOF INDOOR FLIGHT SYSTEM</div>
          <div className="viewportFrame__subLabel">Awaiting engine hookup from gameplay worker</div>
        </div>
      </div>
      <HudOverlay runtime={runtime} />
      <ControlLegend />
    </section>
  );
}

export function HudOverlay({ runtime }: { runtime: GameRuntimeSnapshot }) {
  const ship = runtime.ship;

  return (
    <div className="hudOverlay" data-testid="hud">
      <div className="hudOverlay__metric">
        <span>SHIELDS</span>
        <strong>{ship.shields.toFixed(0)}</strong>
      </div>
      <div className="hudOverlay__metric">
        <span>ENERGY</span>
        <strong>{ship.energy.toFixed(0)}</strong>
      </div>
      <div className="hudOverlay__metric">
        <span>PRIMARY</span>
        <strong>{ship.primaryWeapon}</strong>
      </div>
      <div className="hudOverlay__metric">
        <span>SECONDARY</span>
        <strong>{ship.secondaryWeapon}</strong>
      </div>
      <div className="hudOverlay__metric" data-testid="flare-control">
        <span>FLARES</span>
        <strong>{ship.flareAmmo}</strong>
      </div>
      <div className="hudOverlay__metric">
        <span>TIME</span>
        <strong>{formatSeconds(ship.elapsedSeconds)}</strong>
      </div>
    </div>
  );
}

export function MissionBrief({ runtime }: { runtime: GameRuntimeSnapshot }) {
  return (
    <div data-testid="mission-brief">
      <Panel eyebrow="Mission Brief" title={runtime.missionTitle} action={<Chip tone="alert">Hardpoint Run</Chip>}>
      <p className="panelCopy">
        {runtime.missionName} is a sealed industrial labyrinth. Push through the hub, harvest the colored keycards,
        arm the reactor, and run the clock down before the mine seals itself.
      </p>
      <ol className="objectiveList">
        {runtime.objectiveLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div className="statusRow">
        {runtime.statusFlags.map((flag) => (
          <Chip key={flag.label} tone={flag.tone}>
            {flag.label}
          </Chip>
        ))}
      </div>
      </Panel>
    </div>
  );
}

export function StatusPanel({ runtime }: { runtime: GameRuntimeSnapshot }) {
  const ship = runtime.ship;
  return (
    <Panel eyebrow="Status" title="Pilot Systems">
      <div className="statusGrid">
        <DataStat label="Velocity" value={`${ship.velocity.toFixed(1)} m/s`} />
        <DataStat label="Drift" value={`${ship.drift.toFixed(1)}°/s`} />
        <DataStat label="Pitch" value={`${ship.pitch.toFixed(2)}`} />
        <DataStat label="Yaw" value={`${ship.yaw.toFixed(2)}`} />
        <DataStat label="Roll" value={`${ship.roll.toFixed(2)}`} />
        <DataStat label="Difficulty" value={ship.difficulty} />
      </div>
      <KeyRow keys={ship.keys} />
      <div className="alertBox">
        <span className="alertBox__label">Warnings</span>
        {runtime.warnings.length ? runtime.warnings.map((warning) => <div key={warning}>{warning}</div>) : <div>All systems nominal.</div>}
      </div>
    </Panel>
  );
}

export function ProfilePanel({
  pilotName,
  accountType,
  preferredDifficulty,
  bestScore,
  bestTimeSeconds
}: {
  pilotName: string;
  accountType: string;
  preferredDifficulty: Difficulty;
  bestScore: number;
  bestTimeSeconds: number;
}) {
  return (
    <Panel eyebrow="Pilot" title="Profile">
      <div className="profileCard">
        <div>
          <div className="profileCard__name">{pilotName}</div>
          <div className="profileCard__type">{accountType}</div>
        </div>
        <Chip tone="good">{preferredDifficulty}</Chip>
      </div>
      <div className="profileMetrics">
        <DataStat label="Best Score" value={bestScore.toLocaleString()} />
        <DataStat label="Best Time" value={formatSeconds(bestTimeSeconds)} />
        <DataStat label="Pilot Slot" value="Slot A-07" />
      </div>
      <p className="panelCopy">Guest play is enabled. Upgrade the pilot when the account bridge lands.</p>
    </Panel>
  );
}

export function LeaderboardPanel({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div data-testid="leaderboard-panel">
      <Panel eyebrow="Network" title="Leaderboard">
      <div className="leaderboardTable" role="table" aria-label="Leaderboard">
        <div className="leaderboardTable__head" role="row">
          <span>Pilot</span>
          <span>Difficulty</span>
          <span>Score</span>
          <span>Time</span>
        </div>
        {entries.map((entry) => (
          <div className="leaderboardTable__row" role="row" key={entry.id}>
            <span className="leaderboardTable__pilot">{entry.pilotName}</span>
            <span>{entry.difficulty}</span>
            <span>{entry.score.toLocaleString()}</span>
            <span>{formatSeconds(entry.elapsedSeconds)}</span>
          </div>
        ))}
      </div>
      </Panel>
    </div>
  );
}

export function SettingsPanel({
  autoMapOpen,
  subtitles,
  damageFlash,
  invertY,
  musicVolume,
  sfxVolume,
  onToggleSetting
}: {
  autoMapOpen: boolean;
  subtitles: boolean;
  damageFlash: boolean;
  invertY: boolean;
  musicVolume: number;
  sfxVolume: number;
  onToggleSetting: (key: "autoMapOpen" | "subtitles" | "damageFlash" | "invertY") => void;
}) {
  return (
    <Panel eyebrow="System" title="Settings">
      <div className="settingsGrid">
        <Toggle label="Auto-map open" value={autoMapOpen} onToggle={() => onToggleSetting("autoMapOpen")} />
        <Toggle label="Subtitles" value={subtitles} onToggle={() => onToggleSetting("subtitles")} />
        <Toggle label="Damage flash" value={damageFlash} onToggle={() => onToggleSetting("damageFlash")} />
        <Toggle label="Invert Y" value={invertY} onToggle={() => onToggleSetting("invertY")} />
      </div>
      <div className="volumeBars">
        <DataStat label="Music" value={`${Math.round(musicVolume * 100)}%`} />
        <DataStat label="SFX" value={`${Math.round(sfxVolume * 100)}%`} />
      </div>
    </Panel>
  );
}

export function PauseOverlay({ onResume, onSettings }: { onResume: () => void; onSettings: () => void }) {
  return (
    <div className="pauseOverlay">
      <Panel eyebrow="Paused" title="Command Hold" action={<Chip tone="alert">Hold fire</Chip>}>
        <p className="panelCopy">
          The mine is frozen, but the briefing stack is still live. Resume the cockpit or tune the station before the
          next descent.
        </p>
        <div className="buttonRow">
          <button type="button" className="primaryButton" onClick={onResume}>
            Resume Descent
          </button>
          <button type="button" className="secondaryButton" onClick={onSettings}>
            Open Settings
          </button>
        </div>
      </Panel>
    </div>
  );
}

export function SplashCard({
  profileName,
  onEnterCockpit,
  onEnterLeaderboard,
  onEnterProfile
}: {
  profileName: string;
  onEnterCockpit: () => void;
  onEnterLeaderboard: () => void;
  onEnterProfile: () => void;
}) {
  return (
    <section className="splashCard">
      <div className="splashCard__eyebrow">Original-inspired 6DOF mine run</div>
      <h2>Crimson Foundry</h2>
      <p>
        Pilot {profileName}, choose your descent. The shell is ready for a live runtime bridge, but the briefing,
        HUD, save flow, and leaderboard stack are already wired.
      </p>
      <div className="buttonRow">
        <button className="primaryButton" type="button" onClick={onEnterCockpit}>
          Enter Cockpit
        </button>
        <button className="secondaryButton" type="button" onClick={onEnterLeaderboard}>
          Leaderboard
        </button>
        <button className="secondaryButton" type="button" onClick={onEnterProfile}>
          Profile
        </button>
      </div>
    </section>
  );
}

export function AuthStrip({
  accountType,
  onUpgrade
}: {
  accountType: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="authStrip">
      <div>
        <div className="authStrip__label">Identity</div>
        <strong>{accountType === "guest" ? "Guest Pilot" : "Registered Pilot"}</strong>
      </div>
      <button className="secondaryButton" type="button" onClick={onUpgrade}>
        Upgrade account
      </button>
    </div>
  );
}

export function RuntimeNotes({ runtime }: { runtime: GameRuntimeSnapshot }) {
  return (
    <Panel eyebrow="Telemetry" title="Runtime Notes">
      <div className="notesList">
        <DataStat label="Mission" value={runtime.missionTitle} />
        <DataStat label="Checkpoint" value={runtime.saveState.checkpointId} />
        <DataStat label="Keys" value={runtime.saveState.keys.join(", ") || "none"} />
        <DataStat label="Flare Ammo" value={String(runtime.saveState.flareAmmo)} />
        <DataStat label="Score" value={runtime.saveState.score.toLocaleString()} />
      </div>
    </Panel>
  );
}

function DataStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dataStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`toggleRow${value ? " toggleRow--on" : ""}`} onClick={onToggle}>
      <span>{label}</span>
      <span>{value ? "ON" : "OFF"}</span>
    </button>
  );
}

function KeyRow({ keys }: { keys: KeyColor[] }) {
  return (
    <div className="keyRow">
      <span className="keyRow__label">Access</span>
      <div className="keyRow__chips">
        {keys.length ? keys.map((key) => <Chip key={key}>{key}</Chip>) : <Chip tone="alert">No keys collected</Chip>}
      </div>
    </div>
  );
}

function ControlLegend() {
  return (
    <div className="controlLegend" aria-label="Controls">
      <span>WASD thrust</span>
      <span>QE roll</span>
      <span>Mouse aim</span>
      <span>F flare</span>
      <span>ESC pause</span>
    </div>
  );
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
