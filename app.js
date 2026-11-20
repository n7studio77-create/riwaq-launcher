const steamImage = (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;

const previewItems = [
  { id: "cyberpunk", type: "game", name: "Cyberpunk 2077", subtitle: "سايبربنك 2077", detail: "عِش مدينة نايت سيتي بكل تفاصيلها، في عالم مفتوح مليء بالقصص والاختيارات.", image: 1091500, tag: "عالم مفتوح", platform: "PC", color: "#b47b50" },
  { id: "elden-ring", type: "game", name: "ELDEN RING", subtitle: "إلدن رينغ", detail: "رحلة فانتازيا مظلمة في الأراضي الوسطى، حيث كل اكتشاف حكاية وكل انتصار له طعمه.", image: 1245620, tag: "أكشن ومغامرات", platform: "PC", color: "#b18d49" },
  { id: "rdr2", type: "game", name: "Red Dead Redemption 2", subtitle: "ريد ديد ريدمبشن 2", detail: "حكاية آرثر مورغان وعصابة فان دير ليند في عالم مفتوح ينبض بالتفاصيل.", image: 1174180, tag: "قصة وعالم مفتوح", platform: "PC", color: "#9b554b" },
  { id: "witcher3", type: "game", name: "The Witcher 3", subtitle: "ذا ويتشر 3", detail: "رافق جيرالت في رحلة مليئة بالوحوش والقرارات الصعبة والعوالم الساحرة.", image: 292030, tag: "فانتازيا", platform: "PC", color: "#9c7550" },
  { id: "cyberpunk-mod", type: "mod", name: "Night City Reimagined", subtitle: "نايت سيتي بلمسة جديدة", detail: "استكشف إضافات المجتمع التي تمنح نايت سيتي أجواءً وتفاصيل مختلفة.", image: 1091500, tag: "تحسينات بصرية", platform: "Cyberpunk 2077", color: "#bb6b52" },
  { id: "skyrim-mod", type: "mod", name: "Skyrim: Beyond the North", subtitle: "ما وراء الشمال", detail: "اكتشف عالماً إضافياً ومغامرات جديدة من صناعة مجتمع Skyrim.", image: 489830, tag: "مغامرة جديدة", platform: "Skyrim Special Edition", color: "#678078" },
  { id: "witcher-mod", type: "mod", name: "The Witcher: Enhanced", subtitle: "تجربة ويتشر محسّنة", detail: "تعرّف على تعديلات المجتمع التي تضيف لمسات جديدة إلى رحلتك مع جيرالت.", image: 292030, tag: "تحسين التجربة", platform: "The Witcher 3", color: "#916a48" },
  { id: "elden-mod", type: "mod", name: "Lands Between: Remix", subtitle: "لمسات على الأراضي الوسطى", detail: "تصفح إضافات المجتمع وخيارات التخصيص المتاحة للعبة.", image: 1245620, tag: "تخصيص", platform: "ELDEN RING", color: "#9c8a55" },
  { id: "cyberpunk-ar", type: "translation", name: "Cyberpunk 2077", subtitle: "تعريب مجتمع نايت سيتي", detail: "تصفّح مشاريع المجتمع المرتبطة بالتعريب وتحسين تجربة العربية.", image: 1091500, tag: "واجهة وحوارات", platform: "واجهة عربية", color: "#bd8059" },
  { id: "witcher-ar", type: "translation", name: "The Witcher 3", subtitle: "تعريب عالم ويتشر", detail: "ابحث عن إضافات ومشاريع عربية لعالم ذا ويتشر 3.", image: 292030, tag: "واجهة ونصوص", platform: "واجهة عربية", color: "#a27852" },
  { id: "skyrim-ar", type: "translation", name: "Skyrim Special Edition", subtitle: "تعريب سكايرم", detail: "اكتشف محتوى المجتمع العربي وإضافاته لعالم سكايرم.", image: 489830, tag: "واجهة ونصوص", platform: "واجهة عربية", color: "#70857c" },
  { id: "elden-ar", type: "translation", name: "ELDEN RING", subtitle: "تعريب الأراضي الوسطى", detail: "تعرّف على مشاريع المجتمع المتاحة لتجربة عربية أقرب لعالم اللعبة.", image: 1245620, tag: "نصوص ومصطلحات", platform: "واجهة عربية", color: "#a89357" }
];

const typeNames = { game: "لعبة", mod: "مود", translation: "تعريب" };
const viewNames = { library: "المكتبة", myLibrary: "مكتبتي", games: "الألعاب", mods: "المودات", translations: "التعريبات", favorites: "المفضلة" };
const config = window.GAME_HUB_CONFIG || {};
const hasSupabaseConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const supabaseClient = hasSupabaseConfig ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const grid = document.querySelector("#gameGrid");
const searchInput = document.querySelector("#searchInput");
const dialog = document.querySelector("#detailsDialog");
const authDialog = document.querySelector("#authDialog");
const favorites = new Set();
const libraryIds = new Set();
const downloadedItemIds = new Set();
let items = supabaseClient ? [] : previewItems.map((item) => ({ ...item, imageUrl: steamImage(item.image) }));
let activeView = "library";
let activeFilter = "all";
let currentUser = null;
let isOwner = false;
let authGateActive = true;
let catalogErrorMessage = "";
let selectedItemId = null;
let pendingAddId = null;
let authMode = "signin";
let toastTimer;
let metadataTimer;
let metadataRequestId = 0;
let desktopDownloadItemId = null;
let desktopDownloadBusy = false;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function isSafeHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function setAutomaticValue(input, value) {
  if (!input.value.trim() || input.value.trim() === input.dataset.autoValue) {
    input.value = value;
    input.dataset.autoValue = value;
  }
}

function clearAutomaticValue(input) {
  if (input.dataset.autoValue && input.value.trim() === input.dataset.autoValue) input.value = "";
  delete input.dataset.autoValue;
}

function cleanFileTitle(filename) {
  let title = filename.replace(/\.(zip|7z|rar|exe|msi|iso)$/i, "");
  try {
    title = decodeURIComponent(title);
  } catch {
    console.warn("Could not decode the title from the source filename.");
  }
  return title.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

async function findZipCover(file) {
  const maxDirectorySize = 32 * 1024 * 1024;
  const tailSize = Math.min(file.size, 22 + 0xffff);
  const tailOffset = file.size - tailSize;
  const tail = await file.slice(tailOffset).arrayBuffer();
  const tailView = new DataView(tail);
  let endOffset = -1;
  for (let offset = tail.byteLength - 22; offset >= 0; offset -= 1) {
    if (tailView.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + tailView.getUint16(offset + 20, true) <= tail.byteLength) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("ملف ZIP غير صالح أو غير مكتمل.");

  const eocdFileOffset = tailOffset + endOffset;
  let entryCount = tailView.getUint16(endOffset + 10, true);
  let directorySize = tailView.getUint32(endOffset + 12, true);
  let directoryOffset = tailView.getUint32(endOffset + 16, true);
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    if (eocdFileOffset < 20) throw new Error("ملف ZIP64 غير صالح.");
    const locator = await file.slice(eocdFileOffset - 20, eocdFileOffset).arrayBuffer();
    const locatorView = new DataView(locator);
    if (locatorView.getUint32(0, true) !== 0x07064b50) throw new Error("ملف ZIP64 غير صالح.");
    const zip64Offset = Number(locatorView.getBigUint64(8, true));
    if (!Number.isSafeInteger(zip64Offset) || zip64Offset + 56 > file.size) {
      throw new Error("تعذر قراءة فهرس ملف ZIP64.");
    }
    const zip64Record = await file.slice(zip64Offset, zip64Offset + 56).arrayBuffer();
    const zip64View = new DataView(zip64Record);
    if (zip64View.getUint32(0, true) !== 0x06064b50) throw new Error("ملف ZIP64 غير صالح.");
    entryCount = Number(zip64View.getBigUint64(32, true));
    directorySize = Number(zip64View.getBigUint64(40, true));
    directoryOffset = Number(zip64View.getBigUint64(48, true));
  }
  if (!Number.isSafeInteger(entryCount) || !Number.isSafeInteger(directorySize) ||
    !Number.isSafeInteger(directoryOffset) || directoryOffset + directorySize > file.size) {
    throw new Error("فهرس ملف ZIP غير صالح.");
  }
  if (directorySize > maxDirectorySize) return null;

  const directory = await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer();
  const view = new DataView(directory);
  const decoder = new TextDecoder();
  const candidates = [];
  let directoryPosition = 0;
  const readZip64Value = (offset) => {
    const value = Number(view.getBigUint64(offset, true));
    if (!Number.isSafeInteger(value)) throw new Error("قيمة ZIP64 أكبر من الحد المدعوم.");
    return value;
  };
  for (let index = 0; index < entryCount && directoryPosition + 46 <= directory.byteLength; index += 1) {
    if (view.getUint32(directoryPosition, true) !== 0x02014b50) break;
    const flags = view.getUint16(directoryPosition + 8, true);
    const method = view.getUint16(directoryPosition + 10, true);
    let compressedSize = view.getUint32(directoryPosition + 20, true);
    let uncompressedSize = view.getUint32(directoryPosition + 24, true);
    const nameLength = view.getUint16(directoryPosition + 28, true);
    const extraLength = view.getUint16(directoryPosition + 30, true);
    const commentLength = view.getUint16(directoryPosition + 32, true);
    let localOffset = view.getUint32(directoryPosition + 42, true);
    const nameStart = directoryPosition + 46;
    const extraStart = nameStart + nameLength;
    const entryEnd = extraStart + extraLength + commentLength;
    if (entryEnd > directory.byteLength) break;
    const filename = decoder.decode(new Uint8Array(directory, nameStart, nameLength));
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      let extraPosition = extraStart;
      while (extraPosition + 4 <= extraStart + extraLength) {
        const fieldId = view.getUint16(extraPosition, true);
        const fieldLength = view.getUint16(extraPosition + 2, true);
        const fieldStart = extraPosition + 4;
        const fieldEnd = fieldStart + fieldLength;
        if (fieldEnd > extraStart + extraLength) break;
        if (fieldId === 0x0001) {
          let valuePosition = fieldStart;
          if (uncompressedSize === 0xffffffff) {
            uncompressedSize = readZip64Value(valuePosition);
            valuePosition += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = readZip64Value(valuePosition);
            valuePosition += 8;
          }
          if (localOffset === 0xffffffff) localOffset = readZip64Value(valuePosition);
          break;
        }
        extraPosition = fieldEnd;
      }
    }
    const extension = filename.split(".").pop().toLowerCase();
    const isCoverName = /(^|\/)(cover|capsule|poster|thumbnail|thumb|header|banner|box[-_ ]?art|artwork)[^/]*\.(png|jpe?g|webp)$/i.test(filename);
    if (isCoverName && !(flags & 1) && (method === 0 || method === 8) &&
      uncompressedSize > 0 && uncompressedSize <= 5 * 1024 * 1024 &&
      compressedSize <= 5 * 1024 * 1024 && Number.isSafeInteger(localOffset) &&
      ["png", "jpg", "jpeg", "webp"].includes(extension)) {
      candidates.push({ filename, method, compressedSize, uncompressedSize, localOffset, extension });
    }
    directoryPosition = entryEnd;
  }

  for (const candidate of candidates) {
    if (candidate.localOffset + 30 > file.size) continue;
    const localHeader = await file.slice(candidate.localOffset, candidate.localOffset + 30).arrayBuffer();
    const localView = new DataView(localHeader);
    if (localView.getUint32(0, true) !== 0x04034b50) continue;
    const localNameLength = localView.getUint16(26, true);
    const localExtraLength = localView.getUint16(28, true);
    const dataOffset = candidate.localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + candidate.compressedSize > file.size) continue;
    const compressedBuffer = await file.slice(dataOffset, dataOffset + candidate.compressedSize).arrayBuffer();
    const compressed = new Uint8Array(compressedBuffer);
    let imageBlob;
    if (candidate.method === 0) {
      imageBlob = new Blob([compressed]);
    } else if (typeof DecompressionStream === "function") {
      try {
        const reader = new Blob([compressed]).stream()
          .pipeThrough(new DecompressionStream("deflate-raw"))
          .getReader();
        const chunks = [];
        let totalSize = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          totalSize += value.byteLength;
          if (totalSize > 5 * 1024 * 1024) {
            await reader.cancel();
            throw new Error("Cover image in ZIP exceeds 5 megabytes.");
          }
          chunks.push(value);
        }
        imageBlob = new Blob(chunks);
      } catch (error) {
        console.warn("Could not extract a cover image from the ZIP:", error);
        continue;
      }
    } else {
      console.warn("This browser cannot decompress images from this ZIP file.");
      return null;
    }
    if (imageBlob.size > 5 * 1024 * 1024) {
      console.warn("Cover image in ZIP exceeds 5 megabytes.");
      continue;
    }
    const mimeType = candidate.extension === "png" ? "image/png" :
      candidate.extension === "webp" ? "image/webp" : "image/jpeg";
    return new File([imageBlob], candidate.filename.split("/").pop(), { type: mimeType });
  }
  return null;
}

function formatBytes(bytes) {
  const units = ["بايت", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function getSteamAppId(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "store.steampowered.com") return null;
    return url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1] || null;
  } catch {
    return null;
  }
}

function getSteamTitleFromUrl(value, appId) {
  const parts = new URL(value).pathname.split("/").filter(Boolean);
  const appIndex = parts.findIndex((part, index) => part === "app" && parts[index + 1] === appId);
  return appIndex >= 0 ? cleanFileTitle(parts[appIndex + 2] || "") : "";
}

function fillSourceMetadata(value, requestId) {
  if (requestId !== metadataRequestId || !isSafeHttpsUrl(value)) return;
  const status = document.querySelector("#metadataStatus");
  const steamAppId = getSteamAppId(value);
  const sourceName = new URL(value).pathname.split("/").filter(Boolean).pop() || "";
  const title = steamAppId ? getSteamTitleFromUrl(value, steamAppId) : cleanFileTitle(sourceName);
  if (title) {
    setAutomaticValue(titleInput, title);
    setAutomaticValue(subtitleInput, title);
  }
  if (steamAppId) {
    setAutomaticValue(imageInput, steamImage(steamAppId));
  }
  if (!title && !steamAppId) {
    status.textContent = "لم نستطع استخراج اسم من الرابط؛ أدخل الاسم يدويًا.";
    return;
  }
  if (!window.riwaqDesktop?.lookupSteamMetadata) {
    status.textContent = "تم اقتراح الاسم. استخدم تطبيق ويندوز للبحث التلقائي عن بقية المعلومات.";
    return;
  }

  status.textContent = "جارٍ البحث عن الاسم والصورة والوصف في متجر Steam...";
  window.riwaqDesktop.lookupSteamMetadata(title, steamAppId).then((metadata) => {
    if (requestId !== metadataRequestId) return;
    if (!metadata) {
      status.textContent = "لم نجد نتيجة مناسبة في Steam؛ راجع الاسم وأدخل صورة الغلاف يدويًا.";
      return;
    }
    setAutomaticValue(titleInput, metadata.title);
    setAutomaticValue(subtitleInput, metadata.title);
    setAutomaticValue(imageInput, metadata.imageUrl);
    setAutomaticValue(descriptionInput, metadata.description);
    setAutomaticValue(platformInput, metadata.platform);
    setAutomaticValue(tagInput, metadata.tag);
    status.textContent = "تم اقتراح المعلومات من Steam. راجعها وعدّلها قبل الإضافة.";
  }).catch((error) => {
    console.error("Could not search Steam metadata:", error);
    if (requestId === metadataRequestId) {
      status.textContent = "تعذر البحث في Steam الآن؛ أضف المعلومات والصورة يدويًا.";
    }
  });
}

function storageMarkerPath(sourceUrl, bucket) {
  const prefix = `storage://${bucket}/`;
  return sourceUrl.startsWith(prefix) ? sourceUrl.slice(prefix.length) : null;
}

function publicStoragePath(value, bucket) {
  try {
    const url = new URL(value);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    return url.pathname.startsWith(prefix) ? decodeURIComponent(url.pathname.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function updateDesktopDownload(update) {
  if (update.itemId !== desktopDownloadItemId) return;
  const panel = document.querySelector("#downloadPanel");
  const progress = document.querySelector("#downloadProgressBar");
  const status = document.querySelector("#downloadStatus");
  const pauseButton = document.querySelector("#downloadPauseButton");
  const cancelButton = document.querySelector("#downloadCancelButton");
  const retryButton = document.querySelector("#downloadRetryButton");
  const showButton = document.querySelector("#downloadShowButton");
  const received = Number(update.receivedBytes) || 0;
  const total = Number(update.totalBytes) || 0;
  panel.hidden = false;

  if (total > 0) {
    progress.hidden = false;
    progress.value = Math.min(100, Math.floor((received / total) * 100));
    status.textContent = `${progress.value}% — ${formatBytes(received)} من ${formatBytes(total)}`;
  } else {
    progress.hidden = true;
    status.textContent = `تم تنزيل ${formatBytes(received)}`;
  }

  if (update.state === "completed") {
    desktopDownloadBusy = false;
    if (update.savedToLibrary) {
      downloadedItemIds.add(update.itemId);
      status.textContent = `تمت إضافة ${update.fileName} إلى مكتبة رِواق على هذا الجهاز.`;
      render();
      showToast("اكتمل التنزيل وأصبحت اللعبة في مكتبة رِواق على هذا الجهاز.");
    } else {
      status.textContent = `اكتمل تنزيل ${update.fileName}، لكن تعذر تسجيله في المكتبة المحلية.`;
      showToast("اكتمل الملف، لكن تعذر إضافته للمكتبة المحلية.");
    }
    progress.hidden = false;
    progress.value = 100;
    pauseButton.hidden = true;
    cancelButton.hidden = true;
    retryButton.hidden = true;
    showButton.hidden = false;
  } else if (update.state === "interrupted") {
    desktopDownloadBusy = Boolean(update.canResume);
    status.textContent = update.canResume
      ? "انقطع الاتصال مؤقتًا. اضغط استئناف للمتابعة."
      : "تعذر إكمال التنزيل. أعد المحاولة.";
    pauseButton.hidden = !update.canResume;
    pauseButton.textContent = "استئناف";
    cancelButton.hidden = !update.canResume;
    retryButton.hidden = Boolean(update.canResume);
    showButton.hidden = true;
  } else if (update.state === "cancelled") {
    desktopDownloadBusy = false;
    status.textContent = "تم إلغاء التنزيل.";
    pauseButton.hidden = true;
    cancelButton.hidden = true;
    retryButton.hidden = false;
    showButton.hidden = true;
  } else if (update.state === "paused") {
    status.textContent = `متوقف مؤقتًا — ${formatBytes(received)} من ${formatBytes(total)}`;
    pauseButton.textContent = "استئناف";
    cancelButton.hidden = false;
    retryButton.hidden = true;
    showButton.hidden = true;
  } else {
    desktopDownloadBusy = true;
    pauseButton.hidden = false;
    pauseButton.textContent = "إيقاف مؤقت";
    cancelButton.hidden = false;
    retryButton.hidden = true;
    showButton.hidden = true;
  }
}

function suggestedDownloadName(item, sourceUrl, isUploadedZip) {
  if (isUploadedZip) return `${item.name}.zip`;
  try {
    const fileName = decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || "");
    return fileName || item.name;
  } catch {
    return item.name;
  }
}

async function startDesktopDownload(item, itemId, url, fileName) {
  if (desktopDownloadBusy) {
    showToast("انتظر انتهاء التنزيل الحالي أو أوقفه مؤقتًا أولاً.");
    return;
  }
  desktopDownloadItemId = itemId;
  desktopDownloadBusy = true;
  const panel = document.querySelector("#downloadPanel");
  panel.hidden = false;
  document.querySelector("#downloadTitle").textContent = item.subtitle;
  document.querySelector("#downloadStatus").textContent = "جارٍ تجهيز التنزيل…";
  document.querySelector("#downloadProgressBar").hidden = true;
  document.querySelector("#downloadProgressBar").value = 0;
  document.querySelector("#downloadPauseButton").hidden = false;
  document.querySelector("#downloadPauseButton").textContent = "إيقاف مؤقت";
  document.querySelector("#downloadCancelButton").hidden = false;
  document.querySelector("#downloadRetryButton").hidden = true;
  document.querySelector("#downloadShowButton").hidden = true;

  try {
    const result = await window.riwaqDesktop.startDownload({
      itemId,
      url,
      suggestedName: fileName,
      gameTitle: item.subtitle
    });
    if (result.canceled) {
      desktopDownloadBusy = false;
      if (desktopDownloadItemId === itemId) panel.hidden = true;
    }
  } catch (error) {
    desktopDownloadBusy = false;
    document.querySelector("#downloadStatus").textContent = error.message || "تعذر بدء التنزيل.";
    document.querySelector("#downloadPauseButton").hidden = true;
    document.querySelector("#downloadCancelButton").hidden = true;
    document.querySelector("#downloadRetryButton").hidden = false;
    showToast(error.message || "تعذر بدء التنزيل.");
  }
}

function getVisibleItems() {
  const query = searchInput.value.trim().toLocaleLowerCase("ar");
  return items.filter((item) => {
    const matchesView = activeView === "library" ||
      (activeView === "myLibrary" ? libraryIds.has(item.id) || downloadedItemIds.has(item.id) :
        activeView === "favorites" ? favorites.has(item.id) : item.type === activeView.slice(0, -1));
    const matchesFilter = activeFilter === "all" || item.type === activeFilter;
    const searchable = `${item.name} ${item.subtitle} ${item.detail} ${item.tag} ${item.platform}`.toLocaleLowerCase("ar");
    return matchesView && matchesFilter && searchable.includes(query);
  });
}

function render() {
  const visible = getVisibleItems();
  document.querySelector("#catalogTotal").textContent = items.length;
  document.querySelector("#modTotal").textContent = String(items.filter((item) => item.type === "mod").length).padStart(2, "0");
  document.querySelector("#translationTotal").textContent = String(items.filter((item) => item.type === "translation").length).padStart(2, "0");
  document.querySelector("#catalogCount").textContent = items.length;
  const myLibrarySize = new Set([...libraryIds, ...downloadedItemIds]).size;
  document.querySelector("#myLibraryCount").textContent = currentUser ? myLibrarySize : "—";
  document.querySelector("#resultCount").textContent = `${visible.length} ${visible.length === 1 ? "عنصر" : "عناصر"}`;
  document.querySelector("#adminButton").hidden = !isOwner;
  if (!isOwner) document.querySelector("#adminPanel").hidden = true;

  if (activeView === "myLibrary" && !currentUser) {
    grid.innerHTML = `<div class="empty-state"><span>♙</span><h3>سجّل دخولك لعرض مكتبتك</h3><p>العناصر التي تضيفها تظهر هنا وتبقى مرتبطة بحسابك.</p><button class="button button-primary" type="button" data-auth-open>تسجيل الدخول <span>←</span></button></div>`;
    return;
  }

  if (!visible.length) {
    const message = activeView === "favorites" ? "أضف عناصر للمفضلة وبتظهر لك هنا." :
      activeView === "myLibrary" ? "ما أضفت محتوى لمكتبتك للحين." :
        catalogErrorMessage || (hasSupabaseConfig ? "ما فيه محتوى هنا حالياً." : "اربط Supabase لتحميل المحتوى وتفعيل الحسابات.");
    grid.innerHTML = `<div class="empty-state"><span>⌕</span><h3>${catalogErrorMessage ? "تعذر تحميل المكتبة" : "ما لقينا شيء هنا"}</h3><p>${escapeHTML(message)}</p></div>`;
    return;
  }

  grid.innerHTML = visible.map((item, index) => {
    const inLibrary = libraryIds.has(item.id);
    const isDownloaded = window.riwaqDesktop && downloadedItemIds.has(item.id);
    const sourceAction = window.riwaqDesktop ? "تنزيل إلى الجهاز" : "افتح المصدر";
    const primaryAction = isDownloaded
      ? `<button class="card-action" type="button" data-show-download="${escapeHTML(item.id)}">موجودة في مكتبة رِواق <span>✓</span></button>`
      : activeView === "myLibrary"
      ? `<button class="card-action" type="button" data-source="${escapeHTML(item.id)}">${sourceAction} <span>↗</span></button>`
      : inLibrary
        ? `<button class="card-action" type="button" data-source="${escapeHTML(item.id)}">${sourceAction} <span>↗</span></button>`
        : `<button class="card-action" type="button" data-add="${escapeHTML(item.id)}">أضف لمكتبتي <span>＋</span></button>`;
    const removeLibrary = activeView === "myLibrary"
      ? `<button class="library-remove" type="button" data-remove-library="${escapeHTML(item.id)}">إزالة من مكتبتي</button>` : "";
    const removeContent = isOwner
      ? `<button class="owner-delete" type="button" data-delete-content="${escapeHTML(item.id)}" aria-label="حذف ${escapeHTML(item.subtitle)}">حذف</button>` : "";
    const imageUrl = isSafeHttpsUrl(item.imageUrl) ? item.imageUrl : "";
    const itemColor = /^#[\da-f]{6}$/i.test(item.color || "") ? item.color : "#637052";
    return `
      <article class="content-card" style="--card-accent:${itemColor};--card-order:${index}">
        <button class="favorite-button ${favorites.has(item.id) ? "is-favorite" : ""}" type="button" data-favorite="${escapeHTML(item.id)}" aria-label="${favorites.has(item.id) ? "إزالة من" : "إضافة إلى"} المفضلة" aria-pressed="${favorites.has(item.id)}">${favorites.has(item.id) ? "♥" : "♡"}</button>
        ${removeContent}
        <button class="card-art" type="button" data-details="${escapeHTML(item.id)}" aria-label="تفاصيل ${escapeHTML(item.subtitle)}">
          <img src="${escapeHTML(imageUrl)}" alt="" loading="lazy">
          <span class="art-wash"></span>
          <span class="art-type">${typeNames[item.type]}</span>
          <span class="art-open">↗</span>
        </button>
        <div class="card-info">
          <div class="card-kicker"><span>${escapeHTML(item.tag)}</span><i></i><span>${escapeHTML(item.platform)}</span></div>
          <h3>${escapeHTML(item.subtitle)}</h3>
          <p>${escapeHTML(item.name)}</p>
          ${primaryAction}
          ${removeLibrary}
        </div>
      </article>
    `;
  }).join("");
}

async function loadCatalog() {
  if (!supabaseClient) {
    catalogErrorMessage = "";
    items = previewItems.map((item) => ({ ...item, imageUrl: steamImage(item.image) }));
    render();
    return;
  }
  const { data, error } = await supabaseClient.from("catalog_items").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Could not load catalog:", error.message);
    catalogErrorMessage = "شغّل supabase/schema.sql في SQL Editor لإعداد قاعدة البيانات.";
    showToast("تعذر تحميل المكتبة؛ قاعدة البيانات تحتاج إلى إعداد.");
    items = [];
    render();
    return;
  }
  catalogErrorMessage = "";
  items = (data || []).map((row) => ({
    id: row.id,
    type: row.kind,
    name: row.title,
    subtitle: row.subtitle,
    detail: row.description || "",
    imageUrl: row.image_url,
    tag: row.tag,
    platform: row.platform,
    color: row.color || "#637052"
  }));
  render();
}

async function loadUserLibrary() {
  libraryIds.clear();
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient.from("user_library").select("item_id").eq("user_id", currentUser.id);
  if (error) {
    console.error("Could not load user library:", error.message);
    showToast("تعذر تحميل مكتبتك. حاول تسجيل الدخول مرة ثانية.");
    return;
  }
  (data || []).forEach((row) => libraryIds.add(row.item_id));
}

async function applySession(session) {
  const wasGateActive = authGateActive;
  currentUser = session ? session.user : null;
  isOwner = false;
  authGateActive = !currentUser;
  document.querySelector("#authClose").hidden = authGateActive;
  if (currentUser && wasGateActive && authDialog.open) authDialog.close();
  if (!currentUser && !authDialog.open) authDialog.showModal();
  if (currentUser && supabaseClient) {
    const { data, error } = await supabaseClient.from("site_admins").select("user_id").eq("user_id", currentUser.id).maybeSingle();
    if (error) {
      console.error("Could not check owner role:", error.message);
      showToast("تعذر التحقق من صلاحيات الحساب.");
    } else {
      isOwner = Boolean(data);
    }
  }
  await loadUserLibrary();
  updateAccountUi();
  render();
  if (currentUser && pendingAddId) {
    const itemId = pendingAddId;
    pendingAddId = null;
    await addToLibrary(itemId);
  }
}

function updateAccountUi() {
  const name = currentUser ? currentUser.email : null;
  document.querySelector(".profile-avatar").textContent = currentUser ? (name || "ر").slice(0, 1).toLocaleUpperCase() : "ر";
  document.querySelector(".profile-name").textContent = currentUser ? name : "لاعب جديد";
  document.querySelector(".chevron").hidden = !currentUser;
  document.querySelector("#signedOutPanel").hidden = Boolean(currentUser);
  document.querySelector("#signedInPanel").hidden = !currentUser;
  document.querySelector("#accountEmail").textContent = name || "";
}

function openAuthDialog(mode = "signin", pendingId = null) {
  if (!supabaseClient) {
    authGateActive = true;
    document.querySelector("#authClose").hidden = true;
    document.querySelector("#authSubmit").disabled = true;
    document.querySelector("#authMessage").textContent = "أكمل إعداد Supabase ورابط HTTPS لتفعيل تسجيل الدخول.";
    if (!authDialog.open) authDialog.showModal();
    return;
  }
  pendingAddId = pendingId;
  authMode = mode;
  document.querySelector("#authMessage").textContent = "";
  document.querySelectorAll(".auth-tab").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  document.querySelector("#authTitle").textContent = mode === "signin" ? "سجّل دخولك" : "أنشئ حسابك";
  document.querySelector("#authSubmit").innerHTML = `${mode === "signin" ? "دخول" : "إنشاء الحساب"} <span>←</span>`;
  document.querySelector("#authSubmit").disabled = false;
  const passwordInput = document.querySelector('#authForm [name="password"]');
  passwordInput.autocomplete = mode === "signin" ? "current-password" : "new-password";
  authDialog.showModal();
}

async function openSource(itemId) {
  const item = items.find((entry) => entry.id === itemId);
  if (!item) {
    showToast("المحتوى غير متوفر.");
    return;
  }
  if (!supabaseClient || !currentUser) {
    openAuthDialog("signin", itemId);
    return;
  }
  if (!libraryIds.has(itemId)) {
    requestAddToLibrary(itemId);
    return;
  }
  if (window.riwaqDesktop && downloadedItemIds.has(itemId)) {
    const shown = await window.riwaqDesktop.showDownloadedFile(itemId);
    if (!shown) {
      downloadedItemIds.delete(itemId);
      render();
      showToast("تعذر العثور على الملف في مكتبة رِواق المحلية؛ يمكنك تنزيله من جديد.");
    }
    return;
  }
  if (window.riwaqDesktop && desktopDownloadBusy) {
    showToast("انتظر انتهاء التنزيل الحالي أو أوقفه مؤقتًا أولاً.");
    return;
  }
  const sourceWindow = window.riwaqDesktop ? null : window.open("about:blank", "_blank");
  if (!window.riwaqDesktop && !sourceWindow) {
    showToast("اسمح بالنوافذ المنبثقة لفتح المصدر.");
    return;
  }
  if (sourceWindow) sourceWindow.opener = null;
  const { data, error } = await supabaseClient.from("catalog_item_links").select("source_url").eq("item_id", itemId).maybeSingle();
  if (error || !data) {
    if (sourceWindow) sourceWindow.close();
    console.error("Could not load a protected content source:", error ? error.message : "Source is missing.");
    showToast("تعذر فتح المصدر. تحقق من صلاحيات مكتبتك.");
    return;
  }
  const zipPath = storageMarkerPath(data.source_url, "game-files");
  let downloadUrl;
  if (zipPath) {
    const { data: signedFile, error: signedFileError } = await supabaseClient.storage
      .from("game-files")
      .createSignedUrl(zipPath, window.riwaqDesktop ? 7 * 24 * 60 * 60 : 300, { download: true });
    if (signedFileError || !signedFile?.signedUrl) {
      if (sourceWindow) sourceWindow.close();
      console.error("Could not create a private download link:", signedFileError?.message || "Signed URL is missing.");
      showToast("تعذر تجهيز رابط التحميل. تحقق من إعدادات التخزين.");
      return;
    }
    downloadUrl = signedFile.signedUrl;
  } else if (isSafeHttpsUrl(data.source_url)) {
    downloadUrl = data.source_url;
  } else {
    if (sourceWindow) sourceWindow.close();
    console.error("Could not load a protected content source: Source is invalid.");
    showToast("رابط المصدر غير صالح.");
    return;
  }
  if (window.riwaqDesktop) {
    await startDesktopDownload(item, itemId, downloadUrl, suggestedDownloadName(item, data.source_url, Boolean(zipPath)));
  } else {
    sourceWindow.location.replace(downloadUrl);
  }
}

async function requestAddToLibrary(itemId) {
  if (!supabaseClient) {
    showToast("اربط Supabase لتسجيل الدخول وإضافة المحتوى.");
    return;
  }
  if (!currentUser) {
    openAuthDialog("signin", itemId);
    return;
  }
  await addToLibrary(itemId);
}

async function addToLibrary(itemId) {
  const item = items.find((entry) => entry.id === itemId);
  if (!item || !currentUser || !supabaseClient) return;
  if (libraryIds.has(itemId)) {
    openSource(itemId);
    return;
  }
  const { error } = await supabaseClient.from("user_library").insert({ user_id: currentUser.id, item_id: itemId });
  if (error) {
    console.error("Could not add item to user library:", error.message);
    showToast(error.code === "23505" ? "العنصر موجود في مكتبتك بالفعل." : "تعذرت إضافة العنصر. حاول مرة ثانية.");
    return;
  }
  libraryIds.add(itemId);
  render();
  if (selectedItemId === itemId && dialog.open) updateDetailsActions(item);
  showToast("أُضيف إلى مكتبتك. افتح المصدر من مكتبتك عند رغبتك.");
}

function updateDetailsActions(item) {
  const inLibrary = Boolean(currentUser && libraryIds.has(item.id));
  document.querySelector("#addToLibraryButton").hidden = inLibrary;
  const link = document.querySelector("#dialogLink");
  link.hidden = !inLibrary;
  link.innerHTML = `${window.riwaqDesktop ? "تنزيل إلى الجهاز" : "افتح المصدر"} <span>↗</span>`;
  document.querySelector("#dialogNotice").textContent = window.riwaqDesktop
    ? "بعد تسجيل الدخول وإضافة العنصر لمكتبتك، يُحفظ الملف في مجلد Riwaq Library داخل المستندات ويظهر هنا بعد اكتماله."
    : "هذا رابط خارجي للمحتوى. أضفه إلى مكتبتك بعد تسجيل الدخول للوصول إلى المصدر.";
}

function openDetails(itemId) {
  const item = items.find((entry) => entry.id === itemId);
  if (!item) return;
  selectedItemId = itemId;
  document.querySelector("#dialogTitle").textContent = item.subtitle;
  document.querySelector("#dialogDescription").textContent = item.detail;
  document.querySelector("#dialogCategory").textContent = typeNames[item.type];
  document.querySelector("#dialogPlatform").textContent = item.platform;
  const cover = isSafeHttpsUrl(item.imageUrl) ? item.imageUrl : "";
  document.querySelector("#dialogCover").style.backgroundImage = `linear-gradient(0deg, rgba(10,12,10,.88), transparent 68%), url(${JSON.stringify(cover)})`;
  updateDetailsActions(item);
  dialog.showModal();
}

function setView(view) {
  if (!viewNames[view]) return;
  activeView = view;
  activeFilter = "all";
  document.querySelector("#currentSection").textContent = viewNames[view];
  document.querySelector("#sectionTitle").innerHTML = `${view === "library" ? "مختارة لك" : viewNames[view]} <span class="heading-dot">.</span>`;
  document.querySelectorAll(".nav-link").forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".filter-tab").forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
  render();
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#sidebarScrim").classList.remove("visible");
}

function showAuthError(message) {
  const messages = {
    "Invalid login credentials": "البريد أو كلمة المرور غير صحيحة.",
    "Email not confirmed": "أكد بريدك الإلكتروني أولاً ثم سجّل الدخول.",
    "User already registered": "هذا البريد مسجّل من قبل. جرّب تسجيل الدخول.",
    "Password should be at least 6 characters": "كلمة المرور قصيرة جداً."
  };
  document.querySelector("#authMessage").textContent = messages[message] || message;
}

document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  render();
}));

document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => {
  setView(button.dataset.viewTarget);
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
}));
document.querySelectorAll("[data-scroll]").forEach((button) => button.addEventListener("click", () => {
  document.querySelector(`#${button.dataset.scroll}`).scrollIntoView({ behavior: "smooth" });
}));
document.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.toast)));
searchInput.addEventListener("input", render);

grid.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-favorite")) {
    const id = target.dataset.favorite;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    render();
  } else if (target.hasAttribute("data-details")) {
    openDetails(target.dataset.details);
  } else if (target.hasAttribute("data-add")) {
    await requestAddToLibrary(target.dataset.add);
  } else if (target.hasAttribute("data-show-download")) {
    const itemId = target.dataset.showDownload;
    const shown = await window.riwaqDesktop?.showDownloadedFile(itemId);
    if (!shown) {
      downloadedItemIds.delete(itemId);
      render();
      showToast("لم أعثر على الملف في مكتبة رِواق؛ يمكنك تنزيله من جديد.");
    }
  } else if (target.hasAttribute("data-source")) {
    openSource(target.dataset.source);
  } else if (target.hasAttribute("data-remove-library")) {
    if (!currentUser || !supabaseClient) return;
    const itemId = target.dataset.removeLibrary;
    const { error } = await supabaseClient.from("user_library").delete().eq("user_id", currentUser.id).eq("item_id", itemId);
    if (error) {
      console.error("Could not remove item from user library:", error.message);
      showToast("تعذرت إزالة العنصر من مكتبتك.");
      return;
    }
    libraryIds.delete(itemId);
    render();
    showToast("تمت إزالة العنصر من مكتبتك.");
  } else if (target.hasAttribute("data-delete-content")) {
    if (!isOwner || !supabaseClient) return;
    const itemId = target.dataset.deleteContent;
    const item = items.find((entry) => entry.id === itemId);
    if (!item || !window.confirm(`حذف "${item.subtitle}" من المكتبة؟`)) return;
    const { data: sourceData, error: sourceError } = await supabaseClient
      .from("catalog_item_links").select("source_url").eq("item_id", itemId).maybeSingle();
    if (sourceError) {
      console.error("Could not load catalog source before deletion:", sourceError.message);
      showToast("تعذر حذف المحتوى. لم نستطع التحقق من ملفاته.");
      return;
    }
    const { error } = await supabaseClient.from("catalog_items").delete().eq("id", itemId);
    if (error) {
      console.error("Could not delete catalog item:", error.message);
      showToast("تعذر حذف المحتوى. تحقق من صلاحيات المالك.");
      return;
    }
    const storageFiles = {
      "game-files": sourceData ? storageMarkerPath(sourceData.source_url, "game-files") : null,
      "game-covers": publicStoragePath(item.imageUrl, "game-covers")
    };
    let storageCleanupFailed = false;
    for (const [bucket, path] of Object.entries(storageFiles)) {
      if (!path) continue;
      const { error: storageError } = await supabaseClient.storage.from(bucket).remove([path]);
      if (storageError) {
        storageCleanupFailed = true;
        console.error(`Could not remove ${bucket} object after catalog deletion:`, storageError.message);
      }
    }
    items = items.filter((entry) => entry.id !== itemId);
    libraryIds.delete(itemId);
    render();
    showToast(storageCleanupFailed
      ? "حُذف المحتوى، لكن تعذر حذف أحد الملفات من التخزين."
      : "تم حذف المحتوى.");
  } else if (target.hasAttribute("data-auth-open")) {
    openAuthDialog();
  }
});

document.querySelector("#addToLibraryButton").addEventListener("click", async () => {
  if (selectedItemId) await requestAddToLibrary(selectedItemId);
});
document.querySelector("#dialogLink").addEventListener("click", async () => {
  if (selectedItemId) await openSource(selectedItemId);
});
if (window.riwaqDesktop) {
  window.riwaqDesktop.listDownloadedGames().then((games) => {
    games.forEach((game) => downloadedItemIds.add(game.itemId));
    render();
  }).catch((error) => {
    console.error("Could not load the local game library:", error);
    showToast("تعذر تحميل مكتبة رِواق على هذا الجهاز.");
  });
  window.riwaqDesktop.onAppUpdateStatus((status) => {
    if (status.state === "available") {
      showToast(`يتوفر تحديث ${status.version}. جارٍ تنزيله تلقائيًا.`);
    } else if (status.state === "downloaded") {
      showToast("تم تنزيل التحديث. أعد تشغيل رِواق لتثبيته.");
    } else if (status.state === "error") {
      showToast("تعذر التحقق من تحديث رِواق. سيُعاد الفحص عند تشغيله لاحقًا.");
    }
  });
  window.riwaqDesktop.onDownloadUpdate(updateDesktopDownload);
  document.querySelector("#downloadPauseButton").addEventListener("click", async () => {
    const action = document.querySelector("#downloadPauseButton").textContent === "استئناف" ? "resume" : "pause";
    const updated = await window.riwaqDesktop.controlDownload(desktopDownloadItemId, action);
    if (!updated) showToast("تعذر تحديث حالة التنزيل.");
  });
  document.querySelector("#downloadCancelButton").addEventListener("click", async () => {
    const updated = await window.riwaqDesktop.controlDownload(desktopDownloadItemId, "cancel");
    if (!updated) showToast("تعذر إلغاء التنزيل.");
  });
  document.querySelector("#downloadRetryButton").addEventListener("click", () => {
    if (desktopDownloadItemId) openSource(desktopDownloadItemId);
  });
  document.querySelector("#downloadShowButton").addEventListener("click", async () => {
    const shown = await window.riwaqDesktop.showDownloadedFile(desktopDownloadItemId);
    if (!shown) showToast("تعذر فتح موقع الملف.");
  });
  document.querySelector("#downloadCloseButton").addEventListener("click", () => {
    document.querySelector("#downloadPanel").hidden = true;
  });
}
document.querySelector("#viewAllButton").addEventListener("click", () => {
  searchInput.value = "";
  setView("library");
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});
document.querySelector("#menuButton").addEventListener("click", () => {
  const isOpen = document.querySelector("#sidebar").classList.toggle("open");
  document.querySelector("#sidebarScrim").classList.toggle("visible", isOpen);
});
document.querySelector("#sidebarScrim").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#sidebarScrim").classList.remove("visible");
});
document.querySelector("#dialogClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { selectedItemId = null; });
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.querySelector("#accountButton").addEventListener("click", () => {
  document.querySelector("#authMessage").textContent = "";
  updateAccountUi();
  if (!supabaseClient) {
    openAuthDialog();
    return;
  }
  authDialog.showModal();
});
document.querySelector("#authClose").addEventListener("click", () => {
  if (!authGateActive) authDialog.close();
});
authDialog.addEventListener("close", () => {
  if (!currentUser) pendingAddId = null;
  if (authGateActive && !authDialog.open) authDialog.showModal();
});
authDialog.addEventListener("click", (event) => {
  if (!authGateActive && event.target === authDialog) authDialog.close();
});
authDialog.addEventListener("cancel", (event) => {
  if (authGateActive) event.preventDefault();
});
document.querySelectorAll(".auth-tab").forEach((button) => button.addEventListener("click", () => openAuthDialog(button.dataset.authMode, pendingAddId)));
document.querySelector("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const form = event.currentTarget;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const submit = document.querySelector("#authSubmit");
  submit.disabled = true;
  document.querySelector("#authMessage").textContent = "";
  const result = authMode === "signin"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });
  submit.disabled = false;
  if (result.error) {
    showAuthError(result.error.message);
    return;
  }
  if (authMode === "signup" && !result.data.session) {
    document.querySelector("#authMessage").textContent = "تم إنشاء الحساب. افتح رسالة التأكيد في بريدك، ثم سجّل الدخول.";
    return;
  }
  if (result.data.session) {
    await applySession(result.data.session);
  }
});
document.querySelector("#signOutButton").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Could not sign out:", error.message);
    document.querySelector("#authMessage").textContent = "تعذر تسجيل الخروج. حاول مرة ثانية.";
    return;
  }
  authDialog.close();
  showToast("تم تسجيل الخروج.");
});
document.querySelector("#adminButton").addEventListener("click", () => {
  const panel = document.querySelector("#adminPanel");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) panel.scrollIntoView({ behavior: "smooth" });
});
document.querySelector("#closeAdminButton").addEventListener("click", () => {
  document.querySelector("#adminPanel").hidden = true;
});
const itemForm = document.querySelector("#itemForm");
const sourceInput = itemForm.elements.source_url;
const metadataInput = itemForm.elements.metadata_url;
const titleInput = itemForm.elements.title;
const subtitleInput = itemForm.elements.subtitle;
const imageInput = itemForm.elements.image_url;
const descriptionInput = itemForm.elements.description;
const platformInput = itemForm.elements.platform;
const tagInput = itemForm.elements.tag;
const metadataStatus = document.querySelector("#metadataStatus");
const automaticMetadataInputs = [titleInput, subtitleInput, imageInput, descriptionInput, platformInput, tagInput];

automaticMetadataInputs.forEach((input) => input.addEventListener("input", () => {
  if (input.dataset.autoValue && input.value.trim() !== input.dataset.autoValue) delete input.dataset.autoValue;
}));

function updateSourceMetadata() {
  window.clearTimeout(metadataTimer);
  metadataRequestId += 1;
  automaticMetadataInputs.forEach(clearAutomaticValue);
  const value = metadataInput.value.trim() || sourceInput.value.trim();
  metadataStatus.textContent = "";
  if (!value) return;
  if (!isSafeHttpsUrl(value)) {
    metadataStatus.textContent = "رابط صفحة اللعبة يجب أن يبدأ بـ HTTPS.";
    return;
  }
  const requestId = ++metadataRequestId;
  metadataTimer = window.setTimeout(() => fillSourceMetadata(value, requestId), 650);
}

sourceInput.addEventListener("input", updateSourceMetadata);
metadataInput.addEventListener("input", updateSourceMetadata);

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner || !supabaseClient || !currentUser) return;
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const sourceUrl = sourceInput.value.trim();
  const metadataUrl = metadataInput.value.trim();
  const manualImageUrl = imageInput.value.trim();
  if (!sourceUrl) {
    showToast("أدخل رابط HTTPS مباشر للملف.");
    return;
  }
  if (!isSafeHttpsUrl(sourceUrl)) {
    showToast("رابط التحميل يجب أن يبدأ بـ HTTPS.");
    return;
  }
  if (getSteamAppId(sourceUrl)) {
    showToast("رابط صفحة Steam ليس رابط تنزيل. ضعه في خانة صفحة اللعبة وأدخل رابط الملف المباشر.");
    return;
  }
  if (metadataUrl && !isSafeHttpsUrl(metadataUrl)) {
    showToast("رابط صفحة اللعبة يجب أن يبدأ بـ HTTPS.");
    return;
  }
  if (manualImageUrl && !isSafeHttpsUrl(manualImageUrl)) {
    showToast("رابط صورة الغلاف يجب أن يبدأ بـ HTTPS.");
    return;
  }
  if (!manualImageUrl) {
    showToast("أضف رابط HTTPS لصورة الغلاف، أو أدخل رابط صفحة Steam لاقتراحه تلقائيًا.");
    return;
  }

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  const itemId = crypto.randomUUID();
  let itemCreated = false;
  let savedItem;

  try {
    const { data, error } = await supabaseClient.from("catalog_items").insert({
      id: itemId,
      kind: values.kind,
      title: values.title.trim(),
      subtitle: values.subtitle.trim(),
      description: values.description.trim(),
      platform: values.platform.trim(),
      tag: values.tag.trim(),
      image_url: manualImageUrl,
      created_by: currentUser.id
    }).select("*").single();
    if (error) throw new Error(`Could not add catalog item: ${error.message}`);
    itemCreated = true;
    savedItem = data;

    const { error: linkError } = await supabaseClient.from("catalog_item_links").insert({
      item_id: itemId,
      source_url: sourceUrl
    });
    if (linkError) throw new Error(`Could not save protected catalog source: ${linkError.message}`);
  } catch (error) {
    console.error("Could not add catalog item:", error);
    if (itemCreated) {
      const { error: cleanupError } = await supabaseClient.from("catalog_items").delete().eq("id", itemId);
      if (cleanupError) console.error("Could not clean up item after upload failed:", cleanupError.message);
    }
    submit.disabled = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    showToast(`تعذرت إضافة المحتوى: ${errorMessage.slice(0, 100)}`);
    return;
  }
  submit.disabled = false;
  items.unshift({
    id: savedItem.id, type: savedItem.kind, name: savedItem.title, subtitle: savedItem.subtitle,
    detail: savedItem.description || "", platform: savedItem.platform, tag: savedItem.tag,
    imageUrl: savedItem.image_url, color: savedItem.color || "#637052"
  });
  form.reset();
  automaticMetadataInputs.forEach((input) => delete input.dataset.autoValue);
  metadataStatus.textContent = "";
  render();
  showToast("تمت إضافة المحتوى للمكتبة.");
});

grid.addEventListener("error", (event) => {
  if (event.target instanceof HTMLImageElement && event.target.matches(".card-art img")) {
    event.target.classList.add("image-unavailable");
  }
}, true);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

authDialog.showModal();
document.querySelector("#authClose").hidden = true;
document.querySelector("#authSubmit").disabled = !supabaseClient;

if (supabaseClient) {
  const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => applySession(session), 0);
  });
  window.addEventListener("beforeunload", () => subscription.unsubscribe(), { once: true });
  Promise.all([
    loadCatalog(),
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Could not restore sign-in session:", error.message);
        showToast("تعذر استعادة الجلسة. سجّل الدخول من جديد.");
        return null;
      }
      return applySession(data.session);
    })
  ]);
} else {
  document.querySelector("#authMessage").textContent = "أكمل إعداد Supabase ورابط HTTPS لتفعيل تسجيل الدخول.";
  render();
}
