const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const localPort = 43128;
const downloadsInProgress = new Map();
const pendingDownloads = new Map();
const completedDownloads = new Map();
const downloadedGamesPath = path.join(app.getPath("userData"), "downloaded-games.json");
const gameLibraryPath = path.join(app.getPath("documents"), "Riwaq Library");
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let localServer;
let mainWindow;
let updateErrorReported = false;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' https: data: blob:",
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join("; ");

function createLocalServer() {
  return new Promise((resolve, reject) => {
    localServer = http.createServer((request, response) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405).end();
        return;
      }

      let requestedPath;
      try {
        requestedPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (requestedPath.includes("\0")) {
        response.writeHead(400).end();
        return;
      }

      const relativePath = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");
      const filePath = path.resolve(appRoot, relativePath);
      if (filePath !== appRoot && !filePath.startsWith(`${appRoot}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }

      fs.stat(filePath, (statError, stats) => {
        if (statError || !stats.isFile()) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Content-Length": stats.size,
          "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Content-Security-Policy": contentSecurityPolicy,
          "X-Content-Type-Options": "nosniff"
        });
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        const stream = fs.createReadStream(filePath);
        stream.on("error", () => {
          if (!response.headersSent) response.writeHead(500);
          response.end();
        });
        stream.pipe(response);
      });
    });

    localServer.once("error", reject);
    localServer.listen(localPort, "127.0.0.1", () => {
      localServer.removeListener("error", reject);
      resolve(localPort);
    });
  });
}

function safeFileName(value) {
  const cleaned = String(value || "download")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 180);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "download";
}

function isWithinDirectory(directory, filePath) {
  const relativePath = path.relative(path.resolve(directory), path.resolve(filePath));
  return relativePath !== "" && relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

async function lookupSteamMetadata(query, requestedAppId) {
  let appId = /^\d{1,12}$/.test(String(requestedAppId || "")) ? String(requestedAppId) : "";
  let candidate;
  if (!appId) {
    const searchUrl = new URL("https://store.steampowered.com/api/storesearch/");
    searchUrl.searchParams.set("term", query);
    searchUrl.searchParams.set("l", "english");
    searchUrl.searchParams.set("cc", "US");
    const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    if (!searchResponse.ok) throw new Error(`Steam search failed with HTTP ${searchResponse.status}.`);
    const searchData = await searchResponse.json();
    candidate = Array.isArray(searchData.items)
      ? searchData.items.find((item) => /^\d+$/.test(String(item.id)) && typeof item.name === "string")
      : null;
    if (!candidate) return null;
    appId = String(candidate.id);
  }

  const detailsUrl = new URL("https://store.steampowered.com/api/appdetails");
  detailsUrl.searchParams.set("appids", appId);
  detailsUrl.searchParams.set("l", "english");
  detailsUrl.searchParams.set("cc", "US");
  const detailsResponse = await fetch(detailsUrl, { signal: AbortSignal.timeout(10000) });
  if (!detailsResponse.ok) throw new Error(`Steam metadata request failed with HTTP ${detailsResponse.status}.`);
  const detailsResult = await detailsResponse.json();
  const details = detailsResult[appId]?.success ? detailsResult[appId].data : null;
  const title = details?.name || candidate?.name;
  if (!title) return null;
  const platforms = [];
  if (details?.platforms?.windows) platforms.push("Windows");
  if (details?.platforms?.mac) platforms.push("macOS");
  if (details?.platforms?.linux) platforms.push("Linux");

  return {
    title,
    imageUrl: details?.header_image || candidate?.tiny_image ||
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    description: details?.short_description || "",
    platform: platforms.join(" / ") || "PC",
    tag: details?.genres?.[0]?.description || ""
  };
}

async function readDownloadedGames() {
  let contents;
  try {
    contents = await fs.promises.readFile(downloadedGamesPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  let games;
  try {
    games = JSON.parse(contents);
  } catch {
    throw new Error("تعذر قراءة فهرس مكتبة رِواق المحلية.");
  }
  if (!Array.isArray(games)) throw new Error("فهرس مكتبة رِواق المحلية غير صالح.");

  return games.map((game) => {
    if (!game || !/^[0-9a-f-]{36}$/i.test(String(game.itemId || "")) ||
      typeof game.title !== "string" || typeof game.fileName !== "string" ||
      typeof game.filePath !== "string" || !isWithinDirectory(gameLibraryPath, game.filePath)) {
      throw new Error("يحتوي فهرس مكتبة رِواق المحلية على سجل غير صالح.");
    }
    return game;
  });
}

async function saveDownloadedGame(job) {
  const games = await readDownloadedGames();
  const updatedGames = games.filter((game) => game.itemId !== job.itemId);
  updatedGames.push({
    itemId: job.itemId,
    title: job.title,
    fileName: job.fileName,
    filePath: job.savePath,
    downloadedAt: new Date().toISOString()
  });
  await fs.promises.mkdir(path.dirname(downloadedGamesPath), { recursive: true });
  await fs.promises.writeFile(downloadedGamesPath, JSON.stringify(updatedGames, null, 2), "utf8");
}

function sendDownloadUpdate(job, state, extra = {}) {
  if (job.sender.isDestroyed()) return;
  job.sender.send("riwaq:download:update", {
    itemId: job.itemId,
    fileName: job.fileName,
    savePath: job.savePath,
    state,
    receivedBytes: job.downloadItem?.getReceivedBytes() || 0,
    totalBytes: job.downloadItem?.getTotalBytes() || 0,
    canResume: job.downloadItem?.canResume() || false,
    ...extra
  });
}

function registerDownloadHandlers() {
  ipcMain.handle("riwaq:metadata:steam", async (_event, { query, appId } = {}) => {
    if (appId && !/^\d{1,12}$/.test(String(appId))) throw new Error("معرّف Steam غير صالح.");
    if (!appId && (typeof query !== "string" || !query.trim() || query.length > 100)) {
      throw new Error("اسم البحث غير صالح.");
    }
    return lookupSteamMetadata(String(query || "").trim(), appId);
  });

  session.defaultSession.on("will-download", (event, downloadItem, webContents) => {
    const job = pendingDownloads.get(webContents.id);
    if (!job) {
      event.preventDefault();
      return;
    }
    pendingDownloads.delete(webContents.id);
    job.downloadItem = downloadItem;
    downloadItem.setSavePath(job.savePath);
    downloadsInProgress.set(webContents.id, job);
    sendDownloadUpdate(job, "progressing");

    downloadItem.on("updated", (_updateEvent, state) => {
      sendDownloadUpdate(job, downloadItem.isPaused() ? "paused" : state);
    });
    downloadItem.once("done", async (_doneEvent, state) => {
      downloadsInProgress.delete(webContents.id);
      if (state === "completed") {
        completedDownloads.set(`${webContents.id}:${job.itemId}`, job.savePath);
        try {
          await saveDownloadedGame(job);
          sendDownloadUpdate(job, state, { savedToLibrary: true });
        } catch (error) {
          console.error("Could not register the downloaded game in the local library:", error);
          sendDownloadUpdate(job, state, { savedToLibrary: false });
        }
        return;
      }
      sendDownloadUpdate(job, state);
    });
  });

  ipcMain.handle("riwaq:download:start", async (event, request) => {
    const { itemId, url, suggestedName, gameTitle } = request || {};
    if (!/^[0-9a-f-]{36}$/i.test(String(itemId || ""))) throw new Error("معرّف المحتوى غير صالح.");
    if (typeof gameTitle !== "string" || !gameTitle.trim() || gameTitle.length > 100) {
      throw new Error("اسم اللعبة غير صالح.");
    }
    let downloadUrl;
    try {
      downloadUrl = new URL(url);
    } catch {
      throw new Error("رابط التنزيل غير صالح.");
    }
    if (downloadUrl.protocol !== "https:" || downloadUrl.username || downloadUrl.password) {
      throw new Error("يسمح بالتنزيل من روابط HTTPS فقط.");
    }

    const webContentsId = event.sender.id;
    if (downloadsInProgress.has(webContentsId) || pendingDownloads.has(webContentsId)) {
      throw new Error("يوجد تنزيل آخر قيد التنفيذ. أوقفه أو انتظر اكتماله أولاً.");
    }
    const gameFolder = path.join(gameLibraryPath, `${safeFileName(gameTitle)} - ${itemId.slice(0, 8)}`);
    const fileName = safeFileName(suggestedName || gameTitle);
    await fs.promises.mkdir(gameFolder, { recursive: true });
    const savePath = path.join(gameFolder, fileName);
    try {
      await fs.promises.access(savePath);
      throw new Error("الملف موجود مسبقًا في مكتبة رِواق على هذا الجهاز.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    const job = {
      itemId,
      title: gameTitle.trim(),
      fileName,
      savePath,
      sender: event.sender
    };
    pendingDownloads.set(webContentsId, job);
    try {
      event.sender.downloadURL(downloadUrl.href);
    } catch (error) {
      pendingDownloads.delete(webContentsId);
      throw new Error(`تعذر بدء التنزيل: ${error.message}`);
    }
    return { canceled: false };
  });

  ipcMain.handle("riwaq:library:list-downloaded", async () => {
    const games = await readDownloadedGames();
    const availableGames = [];
    for (const game of games) {
      try {
        await fs.promises.access(game.filePath);
        availableGames.push({
          itemId: game.itemId,
          title: game.title,
          fileName: game.fileName
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return availableGames;
  });

  ipcMain.handle("riwaq:download:control", (event, { itemId, action } = {}) => {
    const job = downloadsInProgress.get(event.sender.id);
    if (!job || job.itemId !== itemId) return false;
    if (action === "pause") {
      job.downloadItem.pause();
      sendDownloadUpdate(job, "paused");
    } else if (action === "resume") {
      job.downloadItem.resume();
      sendDownloadUpdate(job, "progressing");
    } else if (action === "cancel") job.downloadItem.cancel();
    else return false;
    return true;
  });

  ipcMain.handle("riwaq:download:show", async (event, itemId) => {
    let savePath = completedDownloads.get(`${event.sender.id}:${itemId}`);
    if (!savePath) {
      const games = await readDownloadedGames();
      savePath = games.find((game) => game.itemId === itemId)?.filePath;
    }
    if (!savePath || !isWithinDirectory(gameLibraryPath, savePath)) return false;
    try {
      await fs.promises.access(savePath);
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    shell.showItemInFolder(savePath);
    return true;
  });
}

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("riwaq:update:status", status);
  }
}

function reportUpdateError(error) {
  if (updateErrorReported) return;
  updateErrorReported = true;
  console.error("Could not check or download an app update:", error);
  sendUpdateStatus({ state: "error" });
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.on("checking-for-update", () => {
    updateErrorReported = false;
  });
  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({ state: "available", version: info.version });
  });
  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({ state: "downloading", percent: progress.percent });
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus({ state: "downloaded", version: info.version });
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "تحديث رِواق جاهز",
      message: `تم تنزيل الإصدار ${info.version}.`,
      detail: "أعد تشغيل التطبيق الآن لتثبيت التحديث، أو اختر لاحقًا ليُثبّت عند إغلاق التطبيق.",
      buttons: ["إعادة التشغيل الآن", "لاحقًا"],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    }).catch((error) => {
      console.error("Could not show the update-ready dialog:", error);
    });
  });
  autoUpdater.on("error", reportUpdateError);
  autoUpdater.checkForUpdates().catch(reportUpdateError);
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#10120f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) {
      event.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId("com.riwaq.gamehub");
    const port = await createLocalServer();
    registerDownloadHandlers();
    createWindow(port);
    setupAutoUpdates();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  }).catch((error) => {
    dialog.showErrorBox("تعذر تشغيل رِواق", error.message);
    app.quit();
  });
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (localServer) localServer.close();
});
