import { useEffect } from "react";
import {
  AuthStrip,
  LeaderboardPanel,
  MissionBrief,
  PauseOverlay,
  ProfilePanel,
  RuntimeNotes,
  SettingsPanel,
  ShellHeader,
  SplashCard,
  StatusPanel,
  ViewportFrame
} from "./components/ShellComponents";
import { defaultLevelId, shellScreens, useShellStore } from "./store/gameShellStore";

export function App() {
  const screen = useShellStore((state) => state.screen);
  const profile = useShellStore((state) => state.profile);
  const runtime = useShellStore((state) => state.runtime);
  const leaderboard = useShellStore((state) => state.leaderboard);
  const settings = useShellStore((state) => state.settings);
  const setScreen = useShellStore((state) => state.setScreen);
  const upgradeAccount = useShellStore((state) => state.upgradeAccount);
  const toggleSetting = useShellStore((state) => state.toggleSetting);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setScreen(screen === "pause" ? "cockpit" : "pause");
      }
      if (event.key === "F1") setScreen("cockpit");
      if (event.key === "F2") setScreen("leaderboard");
      if (event.key === "F3") setScreen("profile");
      if (event.key === "F4") setScreen("settings");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, setScreen]);

  return (
    <div className="appShell" data-testid="app-shell">
      <div className="appShell__backdrop" />
      <ShellHeader
        screen={screen}
        onChangeScreen={setScreen}
        onTogglePause={() => setScreen(screen === "pause" ? "cockpit" : "pause")}
        profileName={profile.pilotName}
        accountType={profile.accountType}
      />

      <main className="commandDeck">
        <section className="commandDeck__left">
          <div className="stack">
            <SplashCard
              profileName={profile.pilotName}
              onEnterCockpit={() => setScreen("cockpit")}
              onEnterLeaderboard={() => setScreen("leaderboard")}
              onEnterProfile={() => setScreen("profile")}
            />
            <AuthStrip
              accountType={profile.accountType}
              onUpgrade={() => {
                upgradeAccount();
                setScreen("profile");
              }}
            />
          </div>

          <ViewportFrame runtime={runtime} />
        </section>

        <aside className="commandDeck__right">
          <MissionBrief runtime={runtime} />
          <StatusPanel runtime={runtime} />
          <ProfilePanel
            pilotName={profile.pilotName}
            accountType={profile.accountType}
            preferredDifficulty={profile.preferredDifficulty}
            bestScore={profile.bestScore}
            bestTimeSeconds={profile.bestTimeSeconds}
          />
          <LeaderboardPanel entries={leaderboard} />
          <SettingsPanel
            autoMapOpen={settings.autoMapOpen}
            subtitles={settings.subtitles}
            damageFlash={settings.damageFlash}
            invertY={settings.invertY}
            musicVolume={settings.musicVolume}
            sfxVolume={settings.sfxVolume}
            onToggleSetting={toggleSetting}
          />
          <RuntimeNotes runtime={runtime} />
        </aside>
      </main>

      {screen === "pause" ? <PauseOverlay onResume={() => setScreen("cockpit")} onSettings={() => setScreen("settings")} /> : null}

      {screen === "splash" ? (
        <section className="modeBanner">
          <div className="modeBanner__inner">
            <div className="modeBanner__label">Startup</div>
            <strong>{defaultLevelId}</strong>
            <div className="modeBanner__chips">
              {shellScreens.map((entry) => (
                <button key={entry.id} className="modeBanner__chip" type="button" onClick={() => setScreen(entry.id)}>
                  {entry.label}
                </button>
              ))}
            </div>
            <button type="button" className="primaryButton" onClick={() => setScreen("cockpit")}>
              Launch descent
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default App;
