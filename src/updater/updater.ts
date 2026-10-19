// The first check waits for the game feed to have polled, so a game already
// running at startup is seen before anything downloads.
export const FIRST_CHECK_DELAY_MS = 15_000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** The part of electron-updater's `autoUpdater` that Updates drives. */
export interface UpdateSource {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: "update-downloaded", listener: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdatesOptions {
  source: UpdateSource;
  isGameRunning: () => boolean;
  /** Show "Restart to update" running `restart`, or hide it when `undefined`. */
  offerRestart: (restart: (() => void) | undefined) => void;
  /** Tell the user, once, that an update is ready. */
  announce: () => void;
}

export interface Updates {
  gameStarted(): void;
  gameEnded(): void;
  stop(): void;
}

/**
 * Keeps the installed app up to date without ever interrupting a game: checks
 * and downloads quietly in the background, installs when the app quits, and
 * offers an immediate restart only between games. Checks that fall due during
 * a game wait until it ends.
 */
export function startUpdates({ source, isGameRunning, offerRestart, announce }: UpdatesOptions): Updates {
  source.autoDownload = true;
  source.autoInstallOnAppQuit = true;

  let checkDue = false;
  let downloaded = false;
  let announced = false;

  const check = () => {
    checkDue = false;
    source.checkForUpdates().catch((error) => console.error("Update check failed:", error));
  };
  const checkWhenFree = () => {
    if (isGameRunning()) checkDue = true;
    else check();
  };

  const restart = () => {
    if (!isGameRunning()) source.quitAndInstall(true, true);
  };
  const refreshOffer = () => {
    if (!downloaded) return;
    if (isGameRunning()) {
      offerRestart(undefined);
      return;
    }
    offerRestart(restart);
    if (!announced) {
      announced = true;
      announce();
    }
  };

  source.on("error", (error) => console.error("Update failed:", error));
  source.on("update-downloaded", () => {
    downloaded = true;
    refreshOffer();
  });

  const firstCheck = setTimeout(checkWhenFree, FIRST_CHECK_DELAY_MS);
  const laterChecks = setInterval(checkWhenFree, CHECK_INTERVAL_MS);

  return {
    gameStarted: refreshOffer,
    gameEnded() {
      if (checkDue) check();
      refreshOffer();
    },
    stop() {
      clearTimeout(firstCheck);
      clearInterval(laterChecks);
    },
  };
}
