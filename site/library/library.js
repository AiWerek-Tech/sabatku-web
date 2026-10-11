const DEFAULT_CATALOG = "https://aiwerek-tech.github.io/sabatku-books/catalog.json";
const catalogUrl = new URLSearchParams(location.search).get("catalog") || DEFAULT_CATALOG;
const list = document.querySelector("#book-list");
const status = document.querySelector("#status");
const reader = document.querySelector("#reader");
const search = document.querySelector("#search");
const languageFilter = document.querySelector("#language-filter");
const themeFilter = document.querySelector("#theme-filter");
const collectionFilter = document.querySelector("#collection-filter");
const seriesFilter = document.querySelector("#series-filter");
let books = [];
let taxonomyLabels = new Map();
let activePositionKey = null;
let positionSaveTimer = null;
const uiLocale = new URLSearchParams(location.search).get("ui") === "en" ? "en" : "id";

function safeUrl(path, base) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\")) throw new Error("Path konten tidak valid.");
  const url = new URL(path, base);
  const root = new URL("./", base);
  if (url.protocol !== "https:" || url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error("Konten berada di luar host katalog.");
  return url;
}

function safeExternalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Sumber buku eksternal harus memakai HTTPS.");
  return url;
}

function text(tag, value, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value || "";
  return element;
}

function workGroups() {
  const grouped = new Map();
  for (const book of books) {
    if (!grouped.has(book.workId)) grouped.set(book.workId, []);
    grouped.get(book.workId).push(book);
  }
  return [...grouped.values()].map(group => group.sort((a, b) => a.locale.localeCompare(b.locale)));
}

function preferredEdition(group) {
  const locale = languageFilter.value || document.documentElement.lang || "id";
  return group.find(book => book.locale.toLowerCase() === locale.toLowerCase()) || group[0];
}

function localeName(locale) {
  if (locale === "id") return "Indonesia";
  if (locale === "en") return "English";
  return locale.toUpperCase();
}

function themeName(id) {
  const officialLabel = taxonomyLabels.get(`theme:${id}`)?.[uiLocale];
  if (officialLabel) return officialLabel;
  const labels = {
    "prophecy-eschatology": "Nubuat dan Akhir Zaman",
    "history-biography": "Sejarah dan Biografi",
    "biblical-studies": "Studi Alkitab",
    "theology-beliefs": "Teologi dan Keyakinan",
  };
  return labels[id] || id.replace(/[-:]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function collectionName(id) {
  const officialLabel = taxonomyLabels.get(`collection:${id}`)?.[uiLocale];
  if (officialLabel) return officialLabel;
  const labels = {
    "egw-writings": "Roh Nubuat",
    "conflict-of-the-ages": "Conflict of the Ages",
    "young-reader-adaptations": "Adaptasi Pembaca Muda",
    "sabbath-school-companions": "Buku Pendamping Sekolah Sabat",
    "official-church-guides": "Pedoman Resmi Gereja",
  };
  return labels[id] || id.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function seriesName(id) {
  const officialLabel = taxonomyLabels.get(`series:${id}`)?.[uiLocale];
  return officialLabel || id.replace(/[-:]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function audienceName(id) {
  return taxonomyLabels.get(`audience:${id}`)?.[uiLocale] || ({ teens: "Remaja", "young-adults": "Pemuda dewasa", adults: "Dewasa", children: "Anak-anak", all: "Semua pembaca", "teachers-parents": "Pengajar dan orang tua" }[id] || id);
}

function storageGet(key) {
  try { return localStorage.getItem(`sabatku-library:${key}`); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(`sabatku-library:${key}`, value); } catch { /* private browsing may disable storage */ }
}

function flushReadingPosition() {
  clearTimeout(positionSaveTimer);
  if (activePositionKey) storageSet(activePositionKey, String(window.scrollY));
  positionSaveTimer = null;
}

window.addEventListener("scroll", () => {
  const key = activePositionKey;
  if (!key) return;
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => storageSet(key, String(window.scrollY)), 650);
}, { passive: true });
window.addEventListener("pagehide", flushReadingPosition);

function editionStatus(book) {
  return book.contentMode === "external-link" ? "Online · penyedia resmi" : "Online · SabatKu";
}

function populateFilters() {
  const preserve = [languageFilter.value, themeFilter.value, collectionFilter.value, seriesFilter.value];
  const themes = [...new Set(books.flatMap(book => book.themeIds || []))].sort();
  const collections = [...new Set(books.flatMap(book => book.collectionIds || []))].sort();
  const series = [...new Set(books.flatMap(book => book.seriesIds || []))].sort();
  themeFilter.replaceChildren(new Option("Semua tema", ""), ...themes.map(id => new Option(themeName(id), id)));
  collectionFilter.replaceChildren(new Option("Semua koleksi", ""), ...collections.map(id => new Option(collectionName(id), id)));
  seriesFilter.replaceChildren(new Option("Semua seri", ""), ...series.map(id => new Option(seriesName(id), id)));
  [languageFilter, themeFilter, collectionFilter, seriesFilter].forEach((select, index) => {
    if ([...select.options].some(option => option.value === preserve[index])) select.value = preserve[index];
  });
}

function renderList() {
  list.replaceChildren();
  const query = search.value.trim().toLocaleLowerCase();
  const groups = workGroups().filter(group => {
    const allText = group.flatMap(book => [
      book.title, book.author,
      ...(book.themeIds || []).flatMap(id => [id, themeName(id)]),
      ...(book.collectionIds || []).flatMap(id => [id, collectionName(id)]),
      ...(book.audienceIds || []).flatMap(id => [id, audienceName(id)]),
      ...(book.seriesIds || []).flatMap(id => [id, seriesName(id)]),
    ]).join(" ").toLocaleLowerCase();
    return (!languageFilter.value || group.some(book => book.locale === languageFilter.value))
      && (!themeFilter.value || group.some(book => book.themeIds?.includes(themeFilter.value)))
      && (!collectionFilter.value || group.some(book => book.collectionIds?.includes(collectionFilter.value)))
      && (!seriesFilter.value || group.some(book => book.seriesIds?.includes(seriesFilter.value)))
      && allText.includes(query);
  }).sort((a, b) => preferredEdition(a).title.localeCompare(preferredEdition(b).title, "id", { sensitivity: "base" }));

  for (const group of groups) {
    const book = preferredEdition(group);
    const li = document.createElement("li");
    li.className = "work-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "book-button";
    button.addEventListener("click", () => openBook(book));
    const image = document.createElement("img");
    image.className = "cover";
    image.alt = "";
    image.loading = "lazy";
    if (book.cover?.path) image.src = safeUrl(book.cover.path, catalogUrl);
    const copy = document.createElement("span");
    copy.className = "work-copy";
    copy.append(text("span", book.title, "book-title"), text("span", book.author || "Penulis", "book-meta"), text("span", editionStatus(book), "book-meta"));
    button.append(image, copy);
    li.append(button);

    const editions = document.createElement("div");
    editions.className = "edition-chips";
    for (const locale of ["id", "en"]) {
      const edition = group.find(item => item.locale.toLowerCase() === locale);
      if (!edition) {
        const unavailable = text("span", `${locale.toUpperCase()} · belum tersedia`, "edition-chip unavailable");
        unavailable.setAttribute("aria-disabled", "true");
        editions.append(unavailable);
      } else {
        const select = text("button", `${locale.toUpperCase()} · ${edition.contentMode === "external-link" ? "penyedia" : "online"}`, "edition-chip");
        select.type = "button";
        select.setAttribute("aria-label", `Pilih edisi ${localeName(locale)}: ${edition.title}`);
        select.addEventListener("click", () => openBook(edition));
        editions.append(select);
      }
    }
    li.append(editions);
    list.append(li);
  }
  status.classList.remove("error");
  status.textContent = groups.length ? `${groups.length} karya tersedia · edisi dikelompokkan berdasarkan bahasa` : "Tidak ada buku yang cocok dengan pencarian atau filter.";
}

async function getJson(url, maxBytes = 2 * 1024 * 1024) {
  const response = await fetch(url, { cache: "no-cache", redirect: "error" });
  if (!response.ok) throw new Error(`Tidak dapat memuat konten (HTTP ${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("Ukuran konten melebihi batas.");
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function loadCatalog() {
  status.textContent = "Memuat katalog…";
  status.classList.remove("error");
  try {
    if (new URL(catalogUrl).protocol !== "https:") throw new Error("Katalog buku harus memakai HTTPS.");
    const catalog = await getJson(catalogUrl);
    if (catalog.schemaVersion !== "sabatku-library-v1" || catalog.domain !== "books" || !Array.isArray(catalog.entries)) throw new Error("Format katalog buku tidak didukung.");
    taxonomyLabels = new Map();
    if (catalog.taxonomy) {
      const taxonomyUrl = safeUrl(catalog.taxonomy, catalogUrl);
      try {
        const taxonomy = await getJson(taxonomyUrl);
        for (const [kind, field] of [["theme", "themes"], ["collection", "collections"], ["audience", "audiences"]]) {
          for (const item of taxonomy[field] || []) taxonomyLabels.set(`${kind}:${item.id}`, item.label || {});
        }
      } catch { taxonomyLabels = new Map(); }
    }
    books = catalog.entries.map(entry => {
      const contentMode = entry.contentMode || "hosted";
      if (contentMode === "external-link") {
        const sourceUrl = safeExternalUrl(entry.sourceUrl);
        const sources = (entry.sources || []).map(source => ({ ...source, url: safeExternalUrl(source.url) }));
        if (!sources.some(source => source.kind === "online-text")) throw new Error("Edisi penyedia tidak memiliki teks daring.");
        return { ...entry, contentMode, sourceUrl, sources, manifestUrl: null, author: entry.author || "Penulis" };
      }
      if (contentMode !== "hosted") throw new Error("Jenis edisi buku tidak didukung.");
      return { ...entry, contentMode, manifestUrl: safeUrl(entry.manifest, catalogUrl), author: entry.author || "Penulis" };
    });
    populateFilters();
    renderList();
    openRequestedBook();
  } catch (error) {
    status.textContent = error.message || "Katalog buku belum dapat dimuat.";
    status.classList.add("error");
    list.replaceChildren();
  }
}

function renderMarkdown(markdown, container) {
  container.replaceChildren();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph = [];
  let listNode = null;
  const flush = () => {
    if (!paragraph.length) return;
    const value = paragraph.join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
    container.append(text("p", value)); paragraph = [];
  };
  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (!line.trim()) { flush(); listNode = null; continue; }
    if (heading) { flush(); listNode = null; container.append(text(`h${heading[1].length}`, heading[2])); continue; }
    if (line.startsWith("> ")) { flush(); listNode = null; container.append(text("blockquote", line.slice(2))); continue; }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) { flush(); if (!listNode) { listNode = document.createElement("ul"); container.append(listNode); } listNode.append(text("li", bullet[1])); continue; }
    listNode = null; paragraph.push(line.trim());
  }
  flush();
}

function addEditionChoices(container, book) {
  const siblings = books.filter(item => item.workId === book.workId && item.id !== book.id);
  if (!siblings.length) return;
  const section = document.createElement("section");
  section.className = "edition-languages";
  section.append(text("h3", "Edisi bahasa"));
  const chips = document.createElement("div");
  chips.className = "edition-chips";
  for (const locale of ["id", "en"]) {
    const edition = books.find(item => item.workId === book.workId && item.locale.toLowerCase() === locale);
    if (!edition) {
      const unavailable = text("span", `${locale.toUpperCase()} · belum tersedia`, "edition-chip unavailable");
      unavailable.setAttribute("aria-disabled", "true");
      chips.append(unavailable);
    } else {
      const choose = text("button", localeName(locale), "edition-chip");
      choose.type = "button";
      choose.setAttribute("aria-current", edition.id === book.id ? "true" : "false");
      choose.addEventListener("click", () => openBook(edition));
      chips.append(choose);
    }
  }
  section.append(chips);
  container.append(section);
}

function addClassification(container, book) {
  const groups = [
    ["Tema", (book.themeIds || []).map(themeName)],
    ["Koleksi", (book.collectionIds || []).map(collectionName)],
    ["Seri", (book.seriesIds || []).map(seriesName)],
    ["Untuk", (book.audienceIds || []).map(audienceName)],
  ].filter(([, values]) => values.length);
  for (const [label, values] of groups) container.append(text("p", `${label}: ${values.join(" · ")}`, "edition-note"));
}

async function openBook(book, options = {}) {
  flushReadingPosition();
  activePositionKey = null;
  if (book.contentMode === "external-link") {
    const heading = text("h2", book.title);
    const author = text("p", book.author || "Ellen G. White");
    const cover = document.createElement("img"); cover.className = "reader-cover"; cover.alt = `Sampul ${book.title}`; if (book.cover?.path) cover.src = safeUrl(book.cover.path, catalogUrl);
    const metadata = document.createElement("div"); metadata.append(heading, author, text("p", "Edisi bahasa Inggris tersedia langsung dari penyedia resmi. Perlu internet; SabatKu tidak menyimpan salinan offline.", "edition-note"));
    addClassification(metadata, book);
    const top = document.createElement("div"); top.className = "reader-top"; top.append(cover, metadata);
    const contents = [top];
    addEditionChoicesTo(contents, book);
    if (options.chapterId) {
      const chapterNumber = options.chapterId.match(/\d+/)?.[0];
      if (chapterNumber) contents.push(text("p", `Bacaan terkait: bab ${Number(chapterNumber)}. Buka daftar isi penyedia dan pilih bab yang sama.`, "chapter-target"));
    }
    const formats = document.createElement("nav"); formats.className = "toc"; formats.setAttribute("aria-label", "Sumber edisi bahasa Inggris"); formats.append(text("h3", "Pilih format bacaan"));
    for (const source of book.sources || []) {
      const url = safeExternalUrl(source.url);
      const card = document.createElement("a"); card.className = "source-card"; card.href = url.href; card.target = "_blank"; card.rel = "noopener noreferrer";
      card.append(text("span", source.label, "source-title"), text("span", "Online · dibuka dari penyedia resmi ↗", "source-meta"));
      formats.append(card);
    }
    contents.push(formats);
    reader.replaceChildren(...contents);
    reader.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  reader.replaceChildren(text("p", "Memuat detail buku…", "status"));
  try {
    const manifest = await getJson(book.manifestUrl);
    const edition = manifest.edition;
    if (manifest.schemaVersion !== "sabatku-library-v1" || edition?.id !== book.id || edition?.revision !== book.revision || edition?.status !== "published" || !["verified", "public-domain"].includes(edition?.rights?.status)) throw new Error("Manifest buku tidak cocok atau belum disetujui.");
    const heading = text("h2", book.title);
    const author = text("p", manifest.work?.author || book.author || "Penulis");
    const attribution = text("p", edition.rights.attribution, "edition-note");
    const cover = document.createElement("img"); cover.className = "reader-cover"; cover.alt = `Sampul ${book.title}`; if (book.cover?.path) cover.src = safeUrl(book.cover.path, catalogUrl);
    const metadata = document.createElement("div"); metadata.append(heading, author, attribution, text("p", "Online · dihosting SabatKu · belum tersedia offline", "edition-note"));
    if (manifest.work?.summary || edition.summary) metadata.append(text("p", manifest.work?.summary || edition.summary, "book-summary"));
    addClassification(metadata, book);
    const top = document.createElement("div"); top.className = "reader-top"; top.append(cover, metadata);
    const nodes = [...manifest.nodes].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    if (options.chapterId) {
      const requested = nodes.find(node => node.id === options.chapterId);
      if (requested) { await openChapter(book, requested, reader); return; }
    }
    const readCount = nodes.filter(node => storageGet(`read:${book.workId}:${book.locale}:${node.id}`) === "true").length;
    const progress = document.createElement("div"); progress.className = "book-progress";
    const progressBar = document.createElement("progress"); progressBar.max = Math.max(nodes.length, 1); progressBar.value = readCount;
    progress.append(progressBar, text("span", `${readCount} dari ${nodes.length} bab selesai`), text("span", "Posisi dan progres tersimpan di browser ini."));
    const toc = document.createElement("nav"); toc.className = "toc"; toc.setAttribute("aria-label", "Daftar isi"); toc.append(text("h3", "Daftar isi")); const ol = document.createElement("ol");
    for (const node of nodes) {
      const li = document.createElement("li");
      const row = document.createElement("div"); row.className = "toc-row";
      const button = text("button", node.title); button.type = "button"; button.addEventListener("click", () => openChapter(book, node, reader));
      const saved = storageGet(`bookmark:${book.workId}:${book.locale}:${node.id}`) === "true";
      const bookmark = text("button", saved ? "Tersimpan" : "Simpan"); bookmark.className = "bookmark-button"; bookmark.type = "button"; bookmark.setAttribute("aria-pressed", String(saved));
      bookmark.addEventListener("click", () => { const next = storageGet(`bookmark:${book.workId}:${book.locale}:${node.id}`) !== "true"; storageSet(`bookmark:${book.workId}:${book.locale}:${node.id}`, String(next)); bookmark.textContent = next ? "Tersimpan" : "Simpan"; bookmark.setAttribute("aria-pressed", String(next)); });
      row.append(button, bookmark); li.append(row); ol.append(li);
    }
    toc.append(ol);
    const otherEditions = books.filter(item => item.workId === book.workId && item.id !== book.id);
    const parts = [top, progress];
    addEditionChoicesTo(parts, book);
    const lastId = storageGet(`last:${book.workId}:${book.locale}`);
    const lastNode = nodes.find(node => node.id === lastId);
    if (lastNode) {
      const resume = text("button", `Lanjutkan membaca · ${lastNode.title}`, "resume-button"); resume.type = "button"; resume.addEventListener("click", () => openChapter(book, lastNode, reader)); parts.push(resume);
    }
    parts.push(toc);
    reader.replaceChildren(...parts);
  } catch (error) {
    const message = text("p", error.message || "Detail buku belum dapat dimuat.", "error");
    const retry = text("button", "Coba lagi", "retry"); retry.type = "button"; retry.addEventListener("click", () => openBook(book, options));
    reader.replaceChildren(message, retry);
  }
  reader.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addEditionChoicesTo(destination, book) {
  const siblings = books.filter(item => item.workId === book.workId);
  if (siblings.length < 2) return;
  const section = document.createElement("section"); section.className = "edition-languages"; section.append(text("h3", "Edisi bahasa"));
  const chips = document.createElement("div"); chips.className = "edition-chips";
  for (const locale of ["id", "en"]) {
    const edition = siblings.find(item => item.locale.toLowerCase() === locale);
    if (!edition) { const unavailable = text("span", `${locale.toUpperCase()} · belum tersedia`, "edition-chip unavailable"); unavailable.setAttribute("aria-disabled", "true"); chips.append(unavailable); }
    else { const button = text("button", localeName(locale), "edition-chip"); button.type = "button"; button.setAttribute("aria-current", String(edition.id === book.id)); button.addEventListener("click", () => openBook(edition)); chips.append(button); }
  }
  section.append(chips); destination.push(section);
}

async function openChapter(book, node, destination) {
  flushReadingPosition();
  activePositionKey = null;
  destination.replaceChildren(text("p", "Memuat bab…", "status"));
  try {
    const contentUrl = safeUrl(node.content.path, catalogUrl);
    const response = await fetch(contentUrl, { redirect: "error" });
    if (!response.ok) throw new Error(`Bab belum dapat dimuat (HTTP ${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== node.content.bytes || bytes.byteLength > 2 * 1024 * 1024) throw new Error("Ukuran bab tidak sesuai manifest.");
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    if (digest !== node.content.sha256) throw new Error("Checksum bab tidak cocok.");
    storageSet(`last:${book.workId}:${book.locale}`, node.id);
    const section = document.createElement("article"); section.className = "chapter";
    const bar = document.createElement("div"); bar.className = "chapter-heading"; const back = text("button", "← Daftar isi"); back.type = "button"; back.addEventListener("click", () => openBook(book)); bar.append(back, text("h2", node.title));
    const body = document.createElement("div"); body.className = "chapter-body"; renderMarkdown(new TextDecoder().decode(bytes), body);
    const end = document.createElement("div"); end.className = "reading-end"; end.setAttribute("aria-label", "Akhir bab"); body.append(end);
    section.append(bar, body); destination.replaceChildren(section);
    activePositionKey = `position:${book.workId}:${book.locale}:${node.id}`;
    const savedY = Number(storageGet(activePositionKey));
    requestAnimationFrame(() => {
      if (Number.isFinite(savedY) && savedY > 0) window.scrollTo({ top: savedY, behavior: "instant" });
      else section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    let readTimer = null;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        clearTimeout(readTimer);
        readTimer = setTimeout(() => {
          const rect = end.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom >= 0) {
            storageSet(`read:${book.workId}:${book.locale}:${node.id}`, "true");
            observer.disconnect();
          }
        }, 1_000);
      } else clearTimeout(readTimer);
    });
    observer.observe(end);
  } catch (error) {
    const message = text("p", error.message || "Bab belum dapat dimuat.", "error");
    const retry = text("button", "Coba lagi", "retry"); retry.type = "button"; retry.addEventListener("click", () => openChapter(book, node, destination));
    destination.replaceChildren(message, retry);
  }
}

function openRequestedBook() {
  const params = new URLSearchParams(location.search);
  const workId = params.get("work");
  if (!workId) return;
  const locale = params.get("locale") || document.documentElement.lang || "id";
  const book = books.find(item => item.workId === workId && item.locale.toLowerCase() === locale.toLowerCase());
  if (!book) { status.textContent = `Edisi ${localeName(locale)} untuk buku ini belum tersedia.`; return; }
  const rawChapter = params.get("chapter");
  const chapterId = rawChapter ? (/^chapter-\d{1,3}$/.test(rawChapter) ? rawChapter : `chapter-${String(Number(rawChapter)).padStart(2, "0")}`) : null;
  openBook(book, chapterId ? { chapterId } : {});
}

search.addEventListener("input", renderList);
languageFilter.addEventListener("change", renderList);
themeFilter.addEventListener("change", renderList);
collectionFilter.addEventListener("change", renderList);
seriesFilter.addEventListener("change", renderList);
document.querySelector("#refresh").addEventListener("click", loadCatalog);
loadCatalog();
