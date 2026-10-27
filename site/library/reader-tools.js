/* Book-only appearance and selections. No source HTML is executed. */
const BOOK_PAPERS = ["system", "white", "sepia", "slate", "black"];
const BOOK_COLORS = { yellow: "#ffd966", green: "#8ccca3", blue: "#8dbbe8", pink: "#e5a1b8", purple: "#b69ae8" };

function appendBookInline(parent, value, footnotes = {}, locale = "id") {
  value = value.replace(/\[\[EM [0-9]+(?:\.[0-9]+)?]]/g, "");
  const token = /\*\*(.+?)\*\*|__(.+?)__|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\[\^([^]]+)]/g;
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    parent.append(document.createTextNode(value.slice(cursor, match.index)));
    if (match[7]) {
      const button = text("button", match[7], "footnote-button"); button.type = "button"; button.setAttribute("aria-label", `Catatan kaki ${match[7]}`);
      button.addEventListener("click", () => {
        const dialog = document.createElement("dialog"); dialog.className = "reader-dialog"; dialog.append(text("h3", `Catatan kaki ${match[7]}`));
        const note = text("p", ""); appendBookInline(note, footnotes[match[7]] || "Catatan tidak tersedia.", {}, locale); dialog.append(note); linkBookBibleReferences(note, locale);
        const close = text("button", "Tutup"); close.type = "button"; close.addEventListener("click", () => dialog.close()); dialog.append(close);
        dialog.addEventListener("close", () => dialog.remove()); document.body.append(dialog); dialog.showModal();
      }); parent.append(button);
    } else if (match[5]) {
      try {
        const url = safeExternalUrl(match[6]);
        const link = text("a", match[5]); link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer"; parent.append(link);
      } catch { parent.append(document.createTextNode(match[5])); }
    } else parent.append(text(match[1] || match[2] ? "strong" : match[3] ? "em" : "code", match[1] || match[2] || match[3] || match[4]));
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(value.slice(cursor)));
}

const BOOK_BIBLE_NAMES = [
  ["Genesis", "Kejadian", "Kej"], ["Exodus", "Keluaran", "Kel"], ["Leviticus", "Imamat", "Im"], ["Numbers", "Bilangan", "Bil"], ["Deuteronomy", "Ulangan", "Ul"], ["Joshua", "Yosua", "Yos"], ["Judges", "Hakim-hakim", "Hak"], ["Ruth", "Rut"],
  ["1 Samuel", "1 Sam"], ["2 Samuel", "2 Sam"], ["1 Kings", "1 Raja-raja", "1 Raja", "1 Raj"], ["2 Kings", "2 Raja-raja", "2 Raja", "2 Raj"], ["1 Chronicles", "1 Tawarikh", "1 Taw"], ["2 Chronicles", "2 Tawarikh", "2 Taw"], ["Ezra", "Ezr"], ["Nehemiah", "Nehemia", "Neh"], ["Esther", "Ester", "Est"], ["Job", "Ayub", "Ayb"], ["Psalms", "Psalm", "Mazmur", "Mzm"], ["Proverbs", "Amsal", "Ams"], ["Ecclesiastes", "Pengkhotbah", "Pkh"], ["Song of Solomon", "Kidung Agung", "Kid"],
  ["Isaiah", "Yesaya", "Yes"], ["Jeremiah", "Yeremia", "Yer"], ["Lamentations", "Ratapan", "Rat"], ["Ezekiel", "Yeheskiel", "Yeh"], ["Daniel", "Dan"], ["Hosea", "Hos"], ["Joel", "Yoel", "Yl"], ["Amos", "Am"], ["Obadiah", "Obaja", "Ob"], ["Jonah", "Yunus", "Yun"], ["Micah", "Mikha", "Mi"], ["Nahum", "Nah"], ["Habakkuk", "Habakuk", "Hab"], ["Zephaniah", "Zefanya", "Zef"], ["Haggai", "Hagai", "Hag"], ["Zechariah", "Zakharia", "Za"], ["Malachi", "Maleakhi", "Mal"],
  ["Matthew", "Matius", "Mat"], ["Mark", "Markus", "Mrk"], ["Luke", "Lukas", "Luk"], ["John", "Yohanes", "Yoh"], ["Acts", "Kisah Para Rasul", "Kisah Rasul", "Kis"], ["Romans", "Roma", "Rm"], ["1 Corinthians", "1 Korintus", "1 Kor"], ["2 Corinthians", "2 Korintus", "2 Kor"], ["Galatians", "Galatia", "Gal"], ["Ephesians", "Efesus", "Ef"], ["Philippians", "Filipi", "Flp"], ["Colossians", "Kolose", "Kol"], ["1 Thessalonians", "1 Tesalonika", "1 Tes"], ["2 Thessalonians", "2 Tesalonika", "2 Tes"], ["1 Timothy", "1 Timotius", "1 Tim"], ["2 Timothy", "2 Timotius", "2 Tim"], ["Titus", "Tit"], ["Philemon", "Filemon", "Flm"], ["Hebrews", "Ibrani", "Ibr"], ["James", "Yakobus", "Yak"], ["1 Peter", "1 Petrus", "1 Ptr"], ["2 Peter", "2 Petrus", "2 Ptr"], ["1 John", "1 Yohanes", "1 Yoh"], ["2 John", "2 Yohanes", "2 Yoh"], ["3 John", "3 Yohanes", "3 Yoh"], ["Jude", "Yudas", "Yud"], ["Revelation", "Wahyu", "Why"]
];

function linkBookBibleReferences(body, locale) {
  const names = BOOK_BIBLE_NAMES.flatMap(group => group.flatMap(name => [name, name.replace(/^([123]) /, (_, number) => ["", "I", "II", "III"][number] + " ")])).sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(?<![\\p{L}\\d])(?:${names.join("|")})\\.?\\s+\\d{1,3}(?::\\s*\\d{1,3}(?:\\s*[-–—]\\s*(?:\\d{1,3}:)?\\d{1,3})?)?(?:\\s*[,;]\\s*\\d{1,3}(?::\\s*\\d{1,3})?(?:\\s*[-–—]\\s*\\d{1,3})?)*`, "giu");
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) if (!walker.currentNode.parentElement.closest("a,code,button,.source-reference")) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const value = node.textContent; const matches = [...value.matchAll(pattern)]; if (!matches.length) continue;
    const fragment = document.createDocumentFragment(); let cursor = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(value.slice(cursor, match.index)));
      const link = text("a", match[0], "bible-reference");
      link.href = `sabatku://bible?reference=${encodeURIComponent(match[0])}&version=${locale === "en" ? "kjv" : "tb"}`;
      link.addEventListener("click", event => {
        event.preventDefault(); const dialog = document.createElement("dialog"); dialog.className = "reader-dialog";
        dialog.append(text("h3", match[0]), text("p", "Buka rujukan ini menggunakan Alkitab dalam aplikasi SabatKu."));
        const open = text("a", "Buka di SabatKu", "reader-button"); open.href = link.href;
        const close = text("button", "Tutup"); close.type = "button"; close.addEventListener("click", () => dialog.close());
        dialog.append(open, close); dialog.addEventListener("close", () => dialog.remove()); document.body.append(dialog); dialog.showModal();
      });
      fragment.append(link); cursor = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(value.slice(cursor))); node.replaceWith(fragment);
  }
}

function setupBookReaderTools(book, chapter, body, toolbar) {
  const events = new AbortController(); const options = { signal: events.signal };
  const key = `annotations:${book.workId}:${book.locale}:${chapter.id}`;
  let annotations; try { annotations = JSON.parse(storageGet(key) || "[]"); } catch { annotations = []; }
  if (!Array.isArray(annotations)) annotations = [];
  const blocks = [...body.querySelectorAll("p,blockquote,li,h1,h2,h3,td,th")].filter(block => !block.querySelector("p,li"));
  const sourceTexts = blocks.map(block => block.textContent);
  linkBookBibleReferences(body, book.locale);
  const tools = document.createElement("div"); tools.className = "selection-tools"; tools.hidden = true; tools.setAttribute("role", "toolbar"); tools.setAttribute("aria-label", "Alat teks terpilih");
  document.body.append(tools);
  let selections = [];
  function persist() { storageSet(key, JSON.stringify(annotations)); paint(); }
  function paint() {
    for (const mark of body.querySelectorAll("mark.reader-highlight")) mark.replaceWith(...mark.childNodes);
    for (const saved of annotations) {
      const block = blocks[saved.block];
      if (!block || saved.snapshot !== sourceTexts[saved.block] || !(saved.start >= 0 && saved.end > saved.start && saved.end <= saved.snapshot.length)) continue;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT); const pieces = []; let position = 0;
      while (walker.nextNode()) { const node = walker.currentNode; pieces.push({ node, start: position, end: position + node.length }); position += node.length; }
      for (const piece of pieces.reverse()) {
        const start = Math.max(saved.start, piece.start) - piece.start; const end = Math.min(saved.end, piece.end) - piece.start;
        if (end <= start) continue;
        const range = document.createRange(); range.setStart(piece.node, start); range.setEnd(piece.node, end);
        const mark = document.createElement("mark"); mark.className = "reader-highlight"; mark.style.backgroundColor = BOOK_COLORS[saved.color] || BOOK_COLORS.yellow;
        if (saved.note) { mark.title = saved.note; mark.setAttribute("aria-label", `${range.toString()}. Catatan: ${saved.note}`); }
        range.surroundContents(mark);
      }
    }
  }
  function readSelection() {
    const selected = window.getSelection(); if (!selected?.rangeCount || selected.isCollapsed) { tools.hidden = true; return; }
    const range = selected.getRangeAt(0); if (!body.contains(range.commonAncestorContainer)) { tools.hidden = true; return; }
    selections = [];
    blocks.forEach((block, index) => {
      if (!range.intersectsNode(block)) return;
      const part = document.createRange(); part.selectNodeContents(block);
      if (block.contains(range.startContainer)) part.setStart(range.startContainer, range.startOffset);
      if (block.contains(range.endContainer)) part.setEnd(range.endContainer, range.endOffset);
      const prefix = document.createRange(); prefix.selectNodeContents(block); prefix.setEnd(part.startContainer, part.startOffset);
      const start = prefix.toString().length; const end = start + part.toString().length;
      if (end > start) selections.push({ block: index, start, end, snapshot: sourceTexts[index] });
    });
    tools.hidden = selections.length === 0;
  }
  function save(color, note = "") {
    const captured = selections.map(item => ({ ...item, color, note }));
    annotations = annotations.filter(saved => !captured.some(item => item.block === saved.block && item.start < saved.end && item.end > saved.start));
    annotations.push(...captured); persist(); tools.hidden = true; window.getSelection()?.removeAllRanges();
  }
  for (const [name, color] of Object.entries(BOOK_COLORS)) {
    const button = text("button", "●"); button.type = "button"; button.style.color = color;
    button.setAttribute("aria-label", `Sorot ${({yellow:"kuning",green:"hijau",blue:"biru",pink:"merah muda",purple:"ungu"})[name]}`);
    button.addEventListener("click", () => save(name)); tools.append(button);
  }
  const noteButton = text("button", "Catatan"); noteButton.type = "button";
  noteButton.addEventListener("click", () => {
    const dialog = document.createElement("dialog"); dialog.className = "reader-dialog";
    const input = document.createElement("textarea"); input.rows = 4; input.maxLength = 4000; input.setAttribute("aria-label", "Catatan saya");
    const submit = text("button", "Simpan"); submit.type = "button"; submit.addEventListener("click", () => { save("yellow", input.value.trim()); dialog.close(); });
    const cancel = text("button", "Batal"); cancel.type = "button"; cancel.addEventListener("click", () => dialog.close());
    dialog.append(text("h3", "Catatan saya"), text("p", "Disimpan di peramban ini."), input, submit, cancel);
    dialog.addEventListener("close", () => dialog.remove()); document.body.append(dialog); tools.hidden = true; dialog.showModal(); input.focus();
  }); tools.append(noteButton);
  const remove = text("button", "Hapus"); remove.type = "button"; remove.addEventListener("click", () => {
    annotations = annotations.filter(saved => !selections.some(item => item.block === saved.block && item.start < saved.end && item.end > saved.start)); persist(); tools.hidden = true; window.getSelection()?.removeAllRanges();
  }); tools.append(remove);
  // Preserve the selected range when the toolbar receives pointer focus.
  tools.addEventListener("pointerdown", event => event.preventDefault());
  document.addEventListener("selectionchange", () => { if (!document.querySelector(".reader-dialog[open]")) readSelection(); }, options);
  body.addEventListener("pointerup", () => setTimeout(readSelection, 0), options);
  body.addEventListener("keyup", readSelection, options);
  body.addEventListener("click", event => {
    const mark = event.target.closest("mark.reader-highlight"); if (!mark || !mark.title || event.target.closest("a") || !window.getSelection()?.isCollapsed) return;
    const dialog = document.createElement("dialog"); dialog.className = "reader-dialog"; dialog.append(text("h3", "Catatan saya"), text("p", mark.title));
    const close = text("button", "Tutup"); close.type = "button"; close.addEventListener("click", () => dialog.close()); dialog.append(close);
    dialog.addEventListener("close", () => dialog.remove()); document.body.append(dialog); dialog.showModal();
  }, options);
  paint();
  const appearance = text("button", "Aa"); appearance.type = "button"; appearance.setAttribute("aria-label", "Tampilan bacaan");
  appearance.addEventListener("click", () => {
    const dialog = document.createElement("dialog"); dialog.className = "reader-dialog"; dialog.append(text("h3", "Tampilan bacaan"));
    const addSelect = (label, pref, values, fallback) => {
      const row = document.createElement("label"); row.append(text("span", label)); const select = document.createElement("select");
      for (const [value, name] of values) { const option = text("option", name); option.value = value; select.append(option); }
      select.value = storageGet(pref) || fallback; select.addEventListener("change", () => { storageSet(pref, select.value); applyBookAppearance(body); }); row.append(select); dialog.append(row);
    };
    addSelect("Kertas", "paper", BOOK_PAPERS.map((key, index) => [key, ["Sistem", "Putih", "Sepia", "Gelap", "Hitam"][index]]), "system");
    addSelect("Ukuran huruf", "size", [16,18,20,22,24,28,32].map(size => [String(size), `${size}`]), "18");
    addSelect("Font", "typeface", [["serif","Serif"],["sans-serif","Sans serif"]], "serif");
    addSelect("Jarak baris", "spacing", [["1.5","Rapat"],["1.75","Nyaman"],["2","Longgar"]], "1.75");
    addSelect("Perataan", "alignment", [["start","Rata kiri"],["justify","Rata kiri dan kanan"]], "start");
    const close = text("button", "Selesai"); close.type = "button"; close.addEventListener("click", () => dialog.close()); dialog.append(close);
    dialog.addEventListener("close", () => dialog.remove()); document.body.append(dialog); dialog.showModal();
  }); toolbar.append(appearance); applyBookAppearance(body);
  return () => { events.abort(); tools.remove(); document.querySelectorAll(".reader-dialog").forEach(dialog => dialog.remove()); };
}

function applyBookAppearance(body) {
  body.closest(".reader-panel").dataset.paper = BOOK_PAPERS.includes(storageGet("paper")) ? storageGet("paper") : "system";
  const size = Number(storageGet("size")); body.style.fontSize = `${Number.isFinite(size) && size >= 16 && size <= 32 ? size : 18}px`;
  body.style.fontFamily = storageGet("typeface") === "sans-serif" ? "system-ui, sans-serif" : "Georgia, serif";
  body.style.lineHeight = ["1.5","1.75","2"].includes(storageGet("spacing")) ? storageGet("spacing") : "1.75";
  body.style.textAlign = storageGet("alignment") === "justify" ? "justify" : "start";
}
