const DEFAULT_CATALOG = "https://aiwerek-tech.github.io/sabatku-books/catalog.json";
const catalogUrl = new URLSearchParams(location.search).get("catalog") || DEFAULT_CATALOG;
const list = document.querySelector("#book-list");
const status = document.querySelector("#status");
const reader = document.querySelector("#reader");
const search = document.querySelector("#search");
let books = [];

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

function renderList() {
  list.replaceChildren();
  const query = search.value.trim().toLocaleLowerCase();
  const matches = books.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(query));
  for (const book of matches) {
    const li = document.createElement("li");
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
    const localeLabel = book.locale === "id" ? "Indonesia" : book.locale === "en" ? "English" : book.locale.toUpperCase();
    const modeLabel = book.contentMode === "external-link" ? " · penyedia resmi" : " · SabatKu";
    copy.append(text("span", book.title, "book-title"), text("span", `${book.author} · ${localeLabel}${modeLabel}`, "book-meta"));
    button.append(image, copy);
    li.append(button);
    list.append(li);
  }
  if (!matches.length && books.length) status.textContent = "Tidak ada buku yang cocok.";
  else status.textContent = `${books.length} buku tersedia`;
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
  try {
    if (new URL(catalogUrl).protocol !== "https:") throw new Error("Katalog buku harus memakai HTTPS.");
    const catalog = await getJson(catalogUrl);
    if (catalog.schemaVersion !== "sabatku-library-v1" || catalog.domain !== "books" || !Array.isArray(catalog.entries)) throw new Error("Format katalog buku tidak didukung.");
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
    renderList();
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

async function openBook(book) {
  if (book.contentMode === "external-link") {
    const heading = text("h2", book.title);
    const author = text("p", book.author || "Ellen G. White");
    const note = text("p", "Edisi bahasa Inggris ini tersedia langsung dari penyedia resmi. SabatKu tidak menyimpan atau menyalin teks sumber.", "edition-note");
    const cover = document.createElement("img"); cover.className = "reader-cover"; cover.alt = ""; if (book.cover?.path) cover.src = safeUrl(book.cover.path, catalogUrl);
    const metadata = document.createElement("div"); metadata.append(heading, author, note, text("p", "English · sumber resmi · perlu internet", "edition-note"));
    const top = document.createElement("div"); top.className = "reader-top"; top.append(cover, metadata);
    const formats = document.createElement("nav"); formats.className = "toc"; formats.setAttribute("aria-label", "Sumber edisi bahasa Inggris"); formats.append(text("h3", "Buka edisi bahasa Inggris"));
    for (const source of book.sources || []) {
      const url = safeExternalUrl(source.url);
      const link = text("a", `${source.label} ↗`, "source-link"); link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
      formats.append(link);
    }
    const otherEditions = books.filter(item => item.workId === book.workId && item.id !== book.id);
    if (otherEditions.length) {
      const languages = document.createElement("div"); languages.className = "edition-languages"; languages.append(text("h3", "Edisi bahasa lain"));
      for (const edition of otherEditions) { const button = text("button", edition.locale === "id" ? "Baca Bahasa Indonesia" : edition.locale.toUpperCase()); button.type = "button"; button.addEventListener("click", () => openBook(edition)); languages.append(button); }
      reader.replaceChildren(top, formats, languages);
    } else reader.replaceChildren(top, formats);
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
    const cover = document.createElement("img"); cover.className = "reader-cover"; cover.alt = ""; if (book.cover?.path) cover.src = safeUrl(book.cover.path, catalogUrl);
    const top = document.createElement("div"); top.className = "reader-top"; const metadata = document.createElement("div"); metadata.append(heading, author, attribution, text("p", `${edition.locale.toUpperCase()} · ${edition.revision} · Baca online`, "edition-note"));
    top.append(cover, metadata);
    const otherEditions = books.filter(item => item.workId === book.workId && item.id !== book.id);
    const toc = document.createElement("nav"); toc.className = "toc"; toc.setAttribute("aria-label", "Daftar isi"); toc.append(text("h3", "Daftar isi")); const ol = document.createElement("ol");
    const nodes = [...manifest.nodes].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    for (const node of nodes) { const li = document.createElement("li"); const button = text("button", node.title); button.type = "button"; button.addEventListener("click", () => openChapter(book, node, reader)); li.append(button); ol.append(li); }
    toc.append(ol);
    const languages = document.createElement("div"); languages.className = "edition-languages"; languages.append(text("h3", "Edisi bahasa lain"));
    for (const other of otherEditions) { const button = text("button", other.locale === "en" ? "Read in English" : other.locale === "id" ? "Baca Bahasa Indonesia" : other.locale.toUpperCase()); button.type = "button"; button.addEventListener("click", () => openBook(other)); languages.append(button); }
    reader.replaceChildren(top, ...(otherEditions.length ? [languages] : []), toc);
  } catch (error) { reader.replaceChildren(text("p", error.message || "Detail buku belum dapat dimuat.", "error")); }
}

async function openChapter(book, node, destination) {
  destination.replaceChildren(text("p", "Memuat bab…", "status"));
  try {
    const contentUrl = safeUrl(node.content.path, catalogUrl);
    const response = await fetch(contentUrl, { redirect: "error" });
    if (!response.ok) throw new Error(`Bab belum dapat dimuat (HTTP ${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== node.content.bytes || bytes.byteLength > 2 * 1024 * 1024) throw new Error("Ukuran bab tidak sesuai manifest.");
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    if (digest !== node.content.sha256) throw new Error("Checksum bab tidak cocok.");
    const section = document.createElement("article"); section.className = "chapter";
    const bar = document.createElement("div"); bar.className = "chapter-heading"; const back = text("button", "← Daftar isi"); back.type = "button"; back.addEventListener("click", () => openBook(book)); bar.append(back, text("h2", node.title));
    const body = document.createElement("div"); body.className = "chapter-body"; renderMarkdown(new TextDecoder().decode(bytes), body); section.append(bar, body); destination.replaceChildren(section); section.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { destination.replaceChildren(text("p", error.message || "Bab belum dapat dimuat.", "error")); }
}

search.addEventListener("input", renderList);
document.querySelector("#refresh").addEventListener("click", loadCatalog);
loadCatalog();
