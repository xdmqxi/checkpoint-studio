const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");
module.exports = function floating(owner) {
  let pill,
    textWindow,
    state = {
      status: "idle",
      elapsed: 0,
      checkpointCount: 0,
      text: { enabled: false },
    },
    disposed = false,
    watchdog;
  const windows = () => [pill, textWindow].filter((w) => w && !w.isDestroyed());
  const authorized = (e) =>
    e.sender === owner.webContents ||
    windows().some((w) => w.webContents === e.sender);
  // Never activate/focus the pill just to keep it visible: typing belongs to the user's app.
  function raisePill() {
    if (disposed || state.status === "idle" || !pill || pill.isDestroyed())
      return;
    pill.setAlwaysOnTop(true, "screen-saver", 1);
    if (pill.isMinimized()) pill.restore();
    if (!pill.isVisible() && !pill.webContents.isLoadingMainFrame())
      pill.showInactive();
    pill.moveTop();
  }
  function keepPillOnScreen() {
    if (!pill || pill.isDestroyed()) return;
    const bounds = pill.getBounds(),
      area = screen.getDisplayMatching(bounds).workArea;
    const x = Math.max(
      area.x,
      Math.min(bounds.x, area.x + area.width - bounds.width),
    );
    const y = Math.max(
      area.y,
      Math.min(bounds.y, area.y + area.height - bounds.height),
    );
    if (x !== bounds.x || y !== bounds.y)
      pill.setPosition(Math.round(x), Math.round(y));
    raisePill();
  }
  function make(kind, bounds) {
    const w = new BrowserWindow({
      ...bounds,
      title:
        kind === "pill" ? "Checkpoint · Aufnahme" : "Checkpoint · Live-Text",
      frame: false,
      transparent: kind === "pill",
      backgroundColor: kind === "pill" ? "#00000000" : "#182019",
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    w.setAlwaysOnTop(true, "screen-saver", kind === "pill" ? 1 : 0);
    w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    w.setContentProtection(true);
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    w.loadFile(path.join(__dirname, "../dist/index.html"), { hash: kind });
    w.once("ready-to-show", () => {
      if (state.status !== "idle") {
        if (kind === "pill") {
          w.showInactive();
          raisePill();
        } else if (state.text.enabled) w.show();
      }
    });
    w.on("close", (e) => {
      if (!disposed && state.status !== "idle") {
        e.preventDefault();
        if (kind === "text")
          owner.webContents.send("live:command", { action: "textHide" });
        else w.showInactive();
      }
    });
    if (kind === "pill")
      w.on("hide", () => {
        if (state.status !== "idle" && !disposed) setTimeout(raisePill, 0);
      });
    return w;
  }
  function ensure() {
    if (!pill || pill.isDestroyed()) {
      const area = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
      ).workArea;
      pill = make("pill", {
        width: 650,
        height: 96,
        x: Math.round(area.x + (area.width - 650) / 2),
        y: area.y + area.height - 116,
      });
    }
  }
  function broadcast() {
    for (const w of windows()) w.webContents.send("live:state", state);
  }
  ipcMain.handle("live:state", (e, next) => {
    if (e.sender !== owner.webContents) throw Error("Invalid capture owner");
    state = next;
    if (state.status === "idle") {
      clearInterval(watchdog);
      watchdog = undefined;
      for (const w of windows()) w.hide();
    } else {
      ensure();
      if (!watchdog) {
        watchdog = setInterval(raisePill, 750);
        raisePill();
      }
      if (!pill.isVisible()) pill.showInactive();
      if (state.text.enabled) {
        if (!textWindow || textWindow.isDestroyed()) {
          const area = screen.getDisplayMatching(pill.getBounds()).workArea;
          textWindow = make("text", {
            width: Math.round(area.width * 0.8),
            height: Math.round(area.height * 0.8),
            x: Math.round(area.x + area.width * 0.1),
            y: Math.round(area.y + area.height * 0.08),
          });
        } else if (!textWindow.isVisible()) textWindow.show();
      } else if (textWindow && !textWindow.isDestroyed()) textWindow.hide();
    }
    broadcast();
    return true;
  });
  ipcMain.handle("live:fit", (e, width, height) => {
    if (!pill || pill.isDestroyed() || e.sender !== pill.webContents)
      throw Error("Only the pill may resize itself");
    if (!Number.isFinite(width) || !Number.isFinite(height))
      throw Error("Invalid pill size");
    const bounds = pill.getBounds();
    const nextWidth = Math.max(360, Math.min(900, Math.ceil(width))),
      nextHeight = Math.max(80, Math.min(160, Math.ceil(height)));
    if (bounds.width !== nextWidth || bounds.height !== nextHeight)
      pill.setBounds({
        x: Math.round(bounds.x + (bounds.width - nextWidth) / 2),
        y: bounds.y,
        width: nextWidth,
        height: nextHeight,
      });
    keepPillOnScreen();
    return pill.getBounds();
  });
  ipcMain.handle("live:get", (e) => {
    if (!authorized(e)) throw Error("Invalid window");
    return state;
  });
  ipcMain.handle("live:action", (e, action) => {
    if (!authorized(e)) throw Error("Invalid window");
    if (action === "showMain") {
      owner.show();
      raisePill();
      return;
    }
    if (
      [
        "pause",
        "stop",
        "checkpoint",
        "retake",
        "textToggle",
        "textHide",
      ].includes(action) &&
      state.status !== "idle"
    )
      owner.webContents.send("live:command", { action });
  });
  ipcMain.handle("live:text", (e, text) => {
    if (
      !authorized(e) ||
      !text ||
      typeof text.text !== "string" ||
      text.text.length > 20000
    )
      throw Error("Invalid text");
    const clean = {
      enabled: !!text.enabled,
      text: text.text,
      fontSize: Math.max(20, Math.min(120, Number(text.fontSize) || 48)),
      color: /^#[0-9a-f]{6}$/i.test(text.color) ? text.color : "#ffffff",
      background: /^#[0-9a-f]{6}$/i.test(text.background)
        ? text.background
        : "#182019",
      bold: !!text.bold,
      align: text.align === "center" ? "center" : "left",
    };
    owner.webContents.send("live:command", {
      action: "textChange",
      text: clean,
    });
  });
  for (const event of [
    "focus",
    "show",
    "restore",
    "enter-full-screen",
    "leave-full-screen",
  ])
    owner.on(event, raisePill);
  screen.on("display-removed", keepPillOnScreen);
  screen.on("display-metrics-changed", keepPillOnScreen);
  owner.on("closed", () => {
    disposed = true;
    clearInterval(watchdog);
    screen.removeListener("display-removed", keepPillOnScreen);
    screen.removeListener("display-metrics-changed", keepPillOnScreen);
    windows().forEach((w) => w.destroy());
  });
};
