const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  session,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
let window,
  scanner,
  diagnostics,
  providers,
  cleanup,
  watcher,
  networkTimer,
  previousGateway,
  scanning = false,
  analyzing = false,
  networkBusy = false;
const chosenRoots = new Set();
const watchQueue = new Set();
let settings = {
  autoQuarantine: false,
  watchDownloads: false,
  watchNetwork: false,
};
const indexPath = path.join(__dirname, "..", "dist", "index.html");
const trustedURL = pathToFileURL(indexPath).href;
const send = (type, data) => {
  if (window && !window.isDestroyed())
    window.webContents.send("aegis:event", { type, data });
};
const failure = (error) =>
  error instanceof Error ? error.message : String(error);
async function confirm(title, message, detail) {
  const result = await dialog.showMessageBox(window, {
    type: "warning",
    title,
    message,
    detail,
    buttons: ["Cancel", "Continue"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
}
async function persistSettings() {
  const destination = path.join(app.getPath("userData"), "settings.json");
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = path.join(
    path.dirname(destination),
    `.settings-${randomUUID()}.tmp`,
  );
  // Exclusive creation rejects an existing file or symlink, even if its name is guessed.
  const file = await fs.open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(JSON.stringify(settings));
      await file.sync();
    } finally {
      await file.close();
    }
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
async function scanRoot(root) {
  if (scanning) throw new Error("A scan is already running.");
  scanning = true;
  try {
    const result = await scanner.scan({
      root,
      autoQuarantine: settings.autoQuarantine,
    });
    send("scan", result);
    return result;
  } finally {
    scanning = false;
    void drainQueue();
  }
}
async function drainQueue() {
  if (scanning || !watchQueue.size || !settings.watchDownloads) return;
  const [root] = watchQueue;
  watchQueue.delete(root);
  try {
    await scanRoot(root);
  } catch (e) {
    send("notice", failure(e));
  }
}
async function applyWatchers() {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  if (networkTimer) {
    clearInterval(networkTimer);
    networkTimer = null;
  }
  watchQueue.clear();
  if (settings.watchDownloads) {
    const { watch } = await import("chokidar");
    const downloads = await fs.realpath(app.getPath("downloads"));
    watcher = watch(downloads, {
      ignoreInitial: true,
      followSymlinks: false,
      depth: 6,
      awaitWriteFinish: { stabilityThreshold: 2500, pollInterval: 500 },
      ignored: (p) => /\.(crdownload|download|part|tmp)$/i.test(p),
    });
    let debounce;
    const queue = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (settings.watchDownloads) {
          watchQueue.add(downloads);
          void drainQueue();
        }
      }, 4000);
    };
    watcher
      .on("add", queue)
      .on("change", queue)
      .on("error", (e) => {
        send("notice", `Download watch error: ${failure(e)}`);
      });
  }
  if (settings.watchNetwork) {
    networkTimer = setInterval(async () => {
      if (networkBusy) return;
      networkBusy = true;
      try {
        const result = await diagnostics.auditNetwork();
        const current = result.gateway;
        if (previousGateway && current && current !== previousGateway)
          send(
            "notice",
            "Your network gateway changed. This can be normal when switching Wi-Fi; review Network if unexpected.",
          );
        previousGateway = current;
      } catch (e) {
        send("notice", `Network watch: ${failure(e)}`);
      } finally {
        networkBusy = false;
      }
    }, 60000);
    networkTimer.unref();
  }
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1450,
    height: 960,
    minWidth: 720,
    minHeight: 640,
    backgroundColor: "#f2f3f7",
    title: "Aegis AI",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url.split("#")[0] !== trustedURL) {
      event.preventDefault();
      if (isAllowedExternal(url)) void shell.openExternal(url);
    }
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  await window.loadFile(indexPath);
  window.show();
  window.on("closed", () => {
    window = null;
    app.quit();
  });
}
function isAllowedExternal(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      (u.pathname === "/heinrichryodigital" ||
        u.pathname.startsWith("/heinrichryodigital/aegis-ai"))
    );
  } catch {
    return false;
  }
}
function object(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid request.");
  return payload;
}
function id(payload) {
  const value = object(payload).id;
  if (typeof value !== "string" || value.length > 100)
    throw new Error("Invalid record ID.");
  return value;
}
async function knownRoot(payload) {
  const root = object(payload).root;
  if (typeof root !== "string" || !chosenRoots.has(root))
    throw new Error(
      "Choose this folder through the native folder picker first.",
    );
  if ((await fs.realpath(root)) !== root)
    throw new Error("Folder location changed. Choose it again.");
  return root;
}
async function handle(action, payload) {
  switch (action) {
    case "diagnostics":
      return diagnostics.getDiagnostics();
    case "engines":
      return scanner.engines();
    case "providers":
      return providers.detectProviders();
    case "chooseFolder": {
      const result = await dialog.showOpenDialog(window, {
        title: "Choose a folder you are authorized to inspect",
        properties: ["openDirectory"],
        buttonLabel: "Choose folder",
      });
      if (result.canceled) return null;
      const root = await fs.realpath(result.filePaths[0]);
      chosenRoots.add(root);
      return root;
    }
    case "scan":
      return scanRoot(await knownRoot(payload));
    case "scan.cancel":
      scanner.cancel();
      return { cancelled: true };
    case "quarantine.list":
      return scanner.listQuarantine();
    case "quarantine.add":
      return scanner.quarantine(id(payload));
    case "quarantine.restore": {
      const recordId = id(payload);
      if (
        !(await confirm(
          "Restore quarantined file",
          "Restore this potentially unsafe file?",
          "The file will return to its original location without overwriting an existing file. Re-scan it before opening.",
        ))
      )
        throw new Error("Restore cancelled.");
      return scanner.restore(recordId);
    }
    case "settings.get":
      return settings;
    case "settings.set": {
      const next = object(payload);
      for (const key of Object.keys(settings))
        if (typeof next[key] !== "boolean")
          throw new Error("Invalid protection preference.");
      if (
        next.autoQuarantine &&
        !settings.autoQuarantine &&
        !(await confirm(
          "Enable automatic quarantine",
          "Automatically isolate confirmed detections?",
          "Files detected in your selected scan folders or Downloads watch will move into Aegis quarantine. You can restore them later.",
        ))
      )
        throw new Error("Automatic quarantine not enabled.");
      settings = {
        autoQuarantine: next.autoQuarantine,
        watchDownloads: next.watchDownloads,
        watchNetwork: next.watchNetwork,
      };
      try {
        await applyWatchers();
        await persistSettings();
      } catch (e) {
        settings.watchDownloads = false;
        settings.watchNetwork = false;
        await applyWatchers();
        await persistSettings();
        throw e;
      }
      return settings;
    }
    case "network.audit":
      return diagnostics.auditNetwork();
    case "power.get":
      return diagnostics.getPowerProfile();
    case "power.set": {
      const profile = object(payload).profile;
      if (!["balanced", "performance", "battery"].includes(profile))
        throw new Error("Invalid profile.");
      if (
        !(await confirm(
          "Change power profile",
          `Apply the ${profile} power profile?`,
          "This changes an operating system preference and may affect battery life or responsiveness. No administrator password is requested by Aegis.",
        ))
      )
        throw new Error("Profile change cancelled.");
      return diagnostics.setPowerProfile(profile);
    }
    case "process.priority": {
      const { pid, priority } = object(payload);
      if (
        !Number.isSafeInteger(pid) ||
        pid <= 0 ||
        !["low", "normal", "high"].includes(priority)
      )
        throw new Error("Invalid process priority.");
      if (
        !(await confirm(
          "Change process priority",
          `Set PID ${pid} to ${priority} priority?`,
          "Only processes owned by your user are eligible. Check that the app is the one you intended.",
        ))
      )
        throw new Error("Priority change cancelled.");
      return diagnostics.setProcessPriority(pid, priority);
    }
    case "cleanup.preview":
      return cleanup.preview({ root: await knownRoot(payload) });
    case "cleanup.trash": {
      const { ids } = object(payload);
      if (
        !Array.isArray(ids) ||
        ids.length > 5000 ||
        ids.some((i) => typeof i !== "string")
      )
        throw new Error("Invalid cleanup selection.");
      if (
        !(await confirm(
          "Move files to Trash",
          `Move ${ids.length} reviewed temporary files to Trash?`,
          "The app will re-check file identity and age first. Personal documents are not eligible.",
        ))
      )
        throw new Error("Cleanup cancelled.");
      return cleanup.trash({ ids });
    }
    case "analyze": {
      if (analyzing) throw new Error("An analysis is already running.");
      const request = object(payload);
      if (
        typeof request.provider !== "string" ||
        !["local", "codex", "claude", "antigravity"].includes(
          request.provider,
        ) ||
        typeof request.question !== "string" ||
        request.question.length > 2000 ||
        !request.report ||
        typeof request.report !== "object" ||
        Array.isArray(request.report) ||
        JSON.stringify(request.report).length > 2_000_000
      )
        throw new Error("Invalid analysis request.");
      // Lock before the first await, including the confirmation dialog.
      analyzing = true;
      try {
        if (
          request.provider !== "local" &&
          !(await confirm(
            "Send summary for AI analysis",
            `Use your ${request.provider} account to analyze this report?`,
            "A redacted metadata summary and your question will be sent to the provider using its local CLI. Account limits apply. File contents are not included. Codex uses a read-only sandbox; its CLI remains a trusted local application, not an OS privacy boundary.",
          ))
        )
          throw new Error("Cloud analysis cancelled.");
        return await providers.analyzeReport(request);
      } finally {
        analyzing = false;
      }
    }
    default:
      throw new Error("Unknown operation.");
  }
}
async function handleIPC(event, action, payload) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame?.url?.split("#")[0] !== trustedURL
  )
    throw new Error("Untrusted request.");
  return handle(action, payload);
}
app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    const [{ createScanner }, diag, prov, { createCleanup }] =
      await Promise.all([
        import("./scanner.mjs"),
        import("./diagnostics.mjs"),
        import("./providers.mjs"),
        import("./cleanup.mjs"),
      ]);
    diagnostics = diag;
    providers = prov;
    scanner = createScanner({
      dataDir: path.join(app.getPath("userData"), "security"),
      onProgress: (data) => send("progress", data),
    });
    cleanup = createCleanup({ trashItem: (target) => shell.trashItem(target) });
    try {
      const saved = JSON.parse(
        await fs.readFile(
          path.join(app.getPath("userData"), "settings.json"),
          "utf8",
        ),
      );
      for (const key of Object.keys(settings))
        settings[key] = saved[key] === true;
    } catch {}
    ipcMain.handle("aegis:call", handleIPC);
    await createWindow();
    try {
      await applyWatchers();
    } catch (e) {
      settings.watchDownloads = false;
      settings.watchNetwork = false;
      await applyWatchers();
      send("settings", settings);
      send("notice", failure(e));
    }
  })
  .catch((error) => {
    dialog.showErrorBox("Aegis could not start", failure(error));
    app.quit();
  });
let shutdownComplete = false,
  shutdownStarted = false;
app.on("before-quit", (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  settings.watchDownloads = false;
  settings.watchNetwork = false;
  watchQueue.clear();
  if (networkTimer) clearInterval(networkTimer);
  Promise.allSettled([watcher?.close(), scanner?.close()]).finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});
app.on("window-all-closed", () => app.quit());
