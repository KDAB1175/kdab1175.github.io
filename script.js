(function () {
  var windows = Array.prototype.slice.call(document.querySelectorAll("[data-app-window]"));
  var launchers = Array.prototype.slice.call(document.querySelectorAll("[data-app]"));
  var desktopIcons = Array.prototype.slice.call(document.querySelectorAll(".desktop-icon"));
  var closeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-close]"));
  var minButtons = Array.prototype.slice.call(document.querySelectorAll(".dot.min"));
  var maxButtons = Array.prototype.slice.call(document.querySelectorAll(".dot.max"));
  var bars = Array.prototype.slice.call(document.querySelectorAll(".window-bar"));
  var dockItems = Array.prototype.slice.call(document.querySelectorAll(".dock-item"));
  var terminalOutput = document.getElementById("terminal-output");
  var terminalInput = document.getElementById("terminal-input");
  var terminalPrompt = document.getElementById("terminal-prompt");
  var terminalScroll = document.getElementById("terminal-scroll");
  var terminalInputLine = document.getElementById("terminal-input-line");
  var terminalWindow = document.getElementById("window-terminal");
  var browserForm = document.getElementById("browser-form");
  var browserAddress = document.getElementById("browser-address");
  var browserFrame = document.getElementById("browser-frame");
  var browserBack = document.getElementById("browser-back");
  var browserForward = document.getElementById("browser-forward");
  var browserReload = document.getElementById("browser-reload");
  var browserHome = document.getElementById("browser-home");
  var browserExternal = document.getElementById("browser-external");
  var browserNotice = document.getElementById("browser-notice");
  var desktop = document.querySelector(".desktop");
  var dock = document.getElementById("dock");
  var galleryShare = document.getElementById("gallery-share");
  var galleryFavorite = document.getElementById("gallery-favorite");
  var galleryInfo = document.getElementById("gallery-info");
  var galleryInfoText = document.getElementById("gallery-info-text");
  var clock = document.getElementById("clock");
  var wallpaperToggle = document.getElementById("wallpaper-toggle");
  var jokeToggle = document.getElementById("joke-toggle");
  var noteText = document.getElementById("desktop-note-text");
  var desktopNote = document.getElementById("desktop-note");
  var bootScreen = document.getElementById("boot-screen");
  var bootProgress = document.getElementById("boot-progress");

  var zCounter = 70;
  var runningApps = {};
  var dockContextMenu = null;
  var appSummaries = {};
  var fullAppContent = {};
  var browserHistory = [];
  var browserHistoryIndex = -1;
  var browserBlockedMode = false;
  var browserHomepage = "https://merkurcorporation.com/magellan/";
  var history = [];
  var historyIndex = -1;
  var log = [];
  var editor = null; // {type:'nano'|'vim', ...}

  var wallpapers = [
    { className: "wallpaper-sonoma", label: "Sonoma" },
    { className: "wallpaper-big-sur", label: "Big Sur" },
    { className: "wallpaper-tahoe", label: "Tahoe" },
    { className: "wallpaper-joke", label: "Meme" }
  ];
  var wallpaperIndex = 0;
  var jokes = [
    "Computer is like air conditioning. It becomes useless when you open Windows.",
    "There is no place like 127.0.0.1.",
    "On my machine, it was a feature.",
	"When launching, please ensure the pointy end is up and the flamy end is down.",
	"Bogo sort, the potential is endless!",
	"Godspeed Artemis II!",
	"Are any of you actually reading these?",
	"If you are using Linux, it is important to ALWAYS remove the french language pack via: sudo rm -fr ./*",
	"It works on my machine. Please don’t touch it.",
	"Let's hope we won't see a rapid unscheduled disassembly around here.",
	"Orbital mechanics: falling, but missing the ground.",
	"Space is hard. Especially the ‘going there’ and ‘coming back’ parts.",
	"If it moves and it shouldn’t: duct tape. If it doesn’t move and it should: WD-40.",
	"Nothing is more permanent than a temporary fix.",
	"That’s not a bug, that’s an anomaly.",
	"Kerbal Space Program pro-tip: Adding more boosters usually helps.",
	"sudo make me a sandwich",
	"Keyboard not found. Press any key to continue.",
	"I paid for the whole mountain, I’m using the whole mountain.",
	"Speed has never killed anyone. Suddenly becoming stationary, that’s what gets you.",
	"BMW owners: It’s not leaking oil, it’s marking its territory.",
	"Skiing is just controlled falling with style.",
	"If you no longer go for a gap that exists, ...",
	"This isn't even a browser, yet it provides a better experience than IE, doesn't it?",
	"If you don’t fall, you’re not trying hard enough.",
	"I can quit anytime. I just need one more part.",
	"Horsepower is how fast you hit the wall. Torque is how far you take the wall with you.",
	"I write comments because future me is an idiot, if I don't current me is.",
	"There are two hard problems in computer science: cache invalidation, naming things, and off-by-one errors."
  ];
  var jokeIndex = 0;
  var appNames = ["about", "terminal", "browser", "resume", "projects", "experience", "gallery"];
  var goTargets = ["github", "linkedin", "x", "blog", "cambodia", "110"];
  var commandNames = ["help", "clear", "pwd", "ls", "cd", "mkdir", "touch", "cat", "grep", "rm", "mv", "cp", "vim", "open", "wallpaper", "meme", "go"];

  function dir() { return { type: "dir", entries: {} }; }
  function file(content) { return { type: "file", content: content || "" }; }
  var fsRoot = dir();
  var home = ["Users", "you"];
  var cwd = home.slice();

  function pstr(seg) { return "/" + seg.join("/"); }
  function showPath(seg) {
    var h = pstr(home), full = pstr(seg);
    if (full === h) return "~";
    if (full.indexOf(h + "/") === 0) return "~/" + seg.slice(home.length).join("/");
    return full;
  }
  function tokenize(s) {
    var parts = s.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    return parts.map(function (p) {
      if ((p[0] === "\"" && p[p.length - 1] === "\"") || (p[0] === "'" && p[p.length - 1] === "'")) return p.slice(1, -1);
      return p;
    });
  }
  function norm(path) {
    var raw = (path || "").trim();
    var base = [], rest = raw;
    if (!raw || raw === ".") { base = cwd.slice(); rest = ""; }
    else if (raw === "~") { return home.slice(); }
    else if (raw.indexOf("~/") === 0) { base = home.slice(); rest = raw.slice(2); }
    else if (raw[0] === "/") { base = []; rest = raw.slice(1); }
    else { base = cwd.slice(); }
    rest.split("/").forEach(function (part) {
      if (!part || part === ".") return;
      if (part === "..") { if (base.length) base.pop(); return; }
      base.push(part);
    });
    return base;
  }
  function node(seg) {
    var n = fsRoot;
    for (var i = 0; i < seg.length; i += 1) {
      if (!n || n.type !== "dir") return null;
      n = n.entries[seg[i]];
    }
    return n || null;
  }
  function parent(seg) {
    if (!seg.length) return null;
    var p = node(seg.slice(0, -1));
    if (!p || p.type !== "dir") return null;
    return { parent: p, name: seg[seg.length - 1] };
  }
  function clone(n) {
    if (n.type === "file") return file(n.content);
    var out = dir();
    Object.keys(n.entries).forEach(function (k) { out.entries[k] = clone(n.entries[k]); });
    return out;
  }
  function write(seg, content) {
    var p = parent(seg); if (!p) return false;
    p.parent.entries[p.name] = file(content); return true;
  }
  function initFs() {
    fsRoot.entries.Users = dir();
    fsRoot.entries.Users.entries.you = dir();
    fsRoot.entries.Users.entries.you.entries.Documents = dir();
    fsRoot.entries.Users.entries.you.entries.Projects = dir();
    fsRoot.entries.Users.entries.you.entries.Notes = dir();
    write(["Users", "you", "README.txt"], "notamacOS ephemeral filesystem.\nNothing persists after refresh.");
    write(["Users", "you", "Documents", "resume.txt"], "Put your resume highlights here.");
    write(["Users", "you", "Projects", "ideas.md"], "Project concepts and build notes.");
    write(["Users", "you", "Notes", "todo.txt"], "1) polish site\n2) ship");
  }

  function addLine(text, className) {
    log.push({ text: text, className: className || "" });
    if (editor && editor.type === "vim") return;
    var el = document.createElement("div");
    el.className = "terminal-line" + (className ? " " + className : "");
    el.textContent = text;
    terminalOutput.appendChild(el);
  }
  function drawLog() {
    terminalOutput.innerHTML = "";
    log.forEach(function (r) { addVisualLine(r.text, r.className); });
    terminalScroll.scrollTop = terminalScroll.scrollHeight;
  }
  function addVisualLine(text, className) {
    var el = document.createElement("div");
    el.className = "terminal-line" + (className ? " " + className : "");
    el.textContent = text;
    terminalOutput.appendChild(el);
  }
  function say(text) {
    text.split("\n").forEach(function (line) { addLine(line); });
    terminalScroll.scrollTop = terminalScroll.scrollHeight;
  }
  function setPrompt() {
    terminalPrompt.textContent = "you@notamacOS " + showPath(cwd) + " %";
    terminalInput.placeholder = "help";
  }
  function resetTerm() {
    log = [];
    addLine("Welcome to notamacOS.");
    addLine("Type <help> to list commands.");
    addLine("Use Ctrl+L to clear, Tab to autocomplete.");
    drawLog();
    setPrompt();
  }

  function clockTick() {
    clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function getWindow(app) { return document.getElementById("window-" + app); }
  ["resume", "projects", "experience"].forEach(function (app) {
    var content = getWindow(app).querySelector(".window-content");
    appSummaries[app] = content.innerHTML;
  });
  function getAppName(app) {
    var item = dock.querySelector('[data-app="' + app + '"]');
    return item ? item.getAttribute("aria-label") || app : app;
  }
  function syncDock() {
    dockItems.forEach(function (d) {
      var app = d.getAttribute("data-app"), w = getWindow(app);
      d.classList.remove("running", "open", "minimized");
      if (runningApps[app]) d.classList.add("running");
      if (w && w.classList.contains("active")) d.classList.add(w.classList.contains("minimized") ? "minimized" : "open");
      d.setAttribute("data-running", runningApps[app] ? "true" : "false");
    });
  }
  function blurWindows() {
    windows.forEach(function (w) { w.classList.remove("focused"); });
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".window")) document.activeElement.blur();
  }
  function focus(w) {
    if (!w || !w.classList.contains("active") || w.classList.contains("minimized")) return;
    zCounter += 1; w.style.zIndex = String(zCounter);
    blurWindows();
    w.classList.add("focused");
  }
  function focusNext(except) {
    var candidates = windows.filter(function (w) {
      return w !== except && w.classList.contains("active") && !w.classList.contains("minimized");
    }).sort(function (a, b) {
      return (parseInt(b.style.zIndex, 10) || 0) - (parseInt(a.style.zIndex, 10) || 0);
    });
    if (candidates.length) focus(candidates[0]); else blurWindows();
  }
  function openApp(app) {
    var w = getWindow(app); if (!w) return;
    runningApps[app] = true;
    w.classList.add("active"); w.classList.remove("minimized");
    focus(w); syncDock();
    var dockItem = dock.querySelector('[data-app="' + app + '"]');
    if (dockItem) {
      dockItem.classList.remove("launch");
      window.requestAnimationFrame(function () {
        dockItem.classList.add("launch");
        window.setTimeout(function () { dockItem.classList.remove("launch"); }, 400);
      });
    }
    if (app === "terminal") terminalInput.focus();
    if (app === "browser") {
      if (browserHistoryIndex < 0) loadBrowserUrl(browserHomepage, true);
      browserAddress.focus();
    }
  }
  function closeWindow(app) {
    var w = getWindow(app); if (!w) return;
    w.classList.remove("active", "focused", "minimized", "fullscreen");
    syncDock(); focusNext(w);
  }
  function quitApp(app) {
    var w = getWindow(app); if (!w) return;
    delete runningApps[app];
    w.classList.remove("active", "focused", "minimized", "fullscreen");
    syncDock(); focusNext(w); closeDockContextMenu();
  }
  function minimize(w) {
    if (!w || !w.classList.contains("active")) return;
    w.classList.add("minimized"); w.classList.remove("focused");
    syncDock(); focusNext(w);
  }
  function fullscreen(w) {
    if (!w) return;
    w.classList.toggle("fullscreen"); if (w.classList.contains("minimized")) w.classList.remove("minimized");
    focus(w); syncDock();
  }
  function closeDockContextMenu() {
    if (!dockContextMenu) return;
    dockContextMenu.remove(); dockContextMenu = null;
  }
  function openDockContextMenu(item) {
    closeDockContextMenu();
    var app = item.getAttribute("data-app"), running = !!runningApps[app];
    var menu = document.createElement("div");
    menu.className = "dock-context-menu"; menu.setAttribute("role", "menu");
    var title = document.createElement("div");
    title.className = "dock-context-title"; title.textContent = getAppName(app);
    menu.appendChild(title);
    var show = document.createElement("button");
    show.type = "button"; show.setAttribute("role", "menuitem");
    show.textContent = running ? "Show" : "Open";
    show.addEventListener("click", function () { openApp(app); closeDockContextMenu(); });
    menu.appendChild(show);
    if (running) {
      var divider = document.createElement("div"); divider.className = "dock-context-divider"; menu.appendChild(divider);
      var quit = document.createElement("button");
      quit.type = "button"; quit.setAttribute("role", "menuitem"); quit.textContent = "Quit";
      quit.addEventListener("click", function () { quitApp(app); });
      menu.appendChild(quit);
    }
    document.body.appendChild(menu); dockContextMenu = menu;
    var anchor = item.getBoundingClientRect(), box = menu.getBoundingClientRect();
    var left = anchor.left + anchor.width / 2 - box.width / 2;
    left = Math.max(8, Math.min(window.innerWidth - box.width - 8, left));
    menu.style.left = left + "px";
    menu.style.top = Math.max(42, anchor.top - box.height - 12) + "px";
    var first = menu.querySelector("button"); if (first) first.focus();
  }
  function renderFullApp(app, markup) {
    var w = getWindow(app), content = w && w.querySelector(".window-content");
    if (!content) return;
    content.innerHTML = markup;
    content.classList.add("detail-view");
    content.removeAttribute("aria-busy");
    var back = document.createElement("button");
    back.type = "button"; back.className = "detail-back";
    back.setAttribute("data-summary", app); back.textContent = "Back to summary";
    content.insertBefore(back, content.firstChild); content.scrollTop = 0;
  }
  function restoreAppSummary(app) {
    var w = getWindow(app), content = w && w.querySelector(".window-content");
    if (!content || !appSummaries[app]) return;
    content.innerHTML = appSummaries[app];
    content.classList.remove("detail-view"); content.removeAttribute("aria-busy");
    content.scrollTop = 0; openApp(app);
  }
  function loadFullApp(app) {
    var w = getWindow(app), content = w && w.querySelector(".window-content");
    if (!content) return;
    openApp(app); content.setAttribute("aria-busy", "true");
    if (fullAppContent[app]) return renderFullApp(app, fullAppContent[app]);
    fetch(app + ".html").then(function (response) {
      if (!response.ok) throw new Error("Unable to load " + app);
      return response.text();
    }).then(function (html) {
      var parsed = new DOMParser().parseFromString(html, "text/html");
      var main = parsed.querySelector("main");
      if (!main) throw new Error("Missing page content");
      fullAppContent[app] = main.innerHTML;
      renderFullApp(app, fullAppContent[app]);
    }).catch(function () {
      content.removeAttribute("aria-busy");
      var status = document.createElement("p");
      status.className = "detail-error";
      status.textContent = "Content unavailable. Please try again.";
      content.insertBefore(status, content.firstChild);
    });
  }
  function browserTarget(value) {
    var input = (value || "").trim();
    if (!input) return "https://www.google.com/webhp?igu=1";
    if (/^https?:\/\//i.test(input)) {
      try {
        var parsed = new URL(input);
        if (/^(www\.)?google\.[a-z.]+$/i.test(parsed.hostname)) {
          if (parsed.pathname === "/search") {
            parsed.searchParams.set("igu", "1");
            return parsed.toString();
          }
          return "https://www.google.com/webhp?igu=1";
        }
      } catch (e) { return input; }
      return input.replace(/^(https?:\/\/)spacex\.com(?=\/|$)/i, "$1www.spacex.com");
    }
    if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(input)) return "http://" + input;
    if (/^(www\.)?google\.[a-z.]+(\/|$)/i.test(input)) return "https://www.google.com/webhp?igu=1";
    if (/^spacex\.com(\/|$)/i.test(input)) input = "www." + input;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\:\d+)?(\/.*)?$/i.test(input)) return "https://" + input;
    return "https://www.google.com/search?igu=1&q=" + encodeURIComponent(input);
  }
  function syncBrowserControls() {
    browserBack.disabled = browserHistoryIndex <= 0;
    browserForward.disabled = browserHistoryIndex < 0 || browserHistoryIndex >= browserHistory.length - 1;
  }
  function browserBlocksEmbedding(url) {
    try {
      var host = new URL(url).hostname.toLowerCase();
      return host === "spacex.com" || host === "www.spacex.com";
    } catch (e) {
      return false;
    }
  }
  function showBrowserBlockedPage() {
    browserFrame.removeAttribute("src");
    browserFrame.srcdoc = "<!doctype html><html><body style='margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui;background:#f5f8fc;color:#173452'><main style='max-width:560px;text-align:center;padding:24px'><h1 style='margin:0 0 10px;font-size:1.55rem'>Website embedding blocked</h1><p style='margin:0 0 8px;line-height:1.55'>This website only allows trusted sites to display it.</p><p style='margin:0;line-height:1.55'>Use <strong>Open externally</strong> for the full website.</p></main></body></html>";
  }
  function loadBrowserUrl(url, remember) {
    if (remember !== false) {
      browserHistory = browserHistory.slice(0, browserHistoryIndex + 1);
      browserHistory.push(url); browserHistoryIndex = browserHistory.length - 1;
    }
    browserAddress.value = url;
    browserBlockedMode = browserBlocksEmbedding(url);
    if (browserBlockedMode) {
      browserNotice.textContent = "This website prevents in-window embedding.";
      showBrowserBlockedPage();
      syncBrowserControls(); return;
    }
    browserNotice.textContent = "Loading " + url + ".";
    browserFrame.removeAttribute("srcdoc"); browserFrame.src = url;
    syncBrowserControls();
  }

  function cycleWallpaper() {
    document.body.classList.remove(wallpapers[wallpaperIndex].className);
    wallpaperIndex = (wallpaperIndex + 1) % wallpapers.length;
    document.body.classList.add(wallpapers[wallpaperIndex].className);
    say("Wallpaper set: " + wallpapers[wallpaperIndex].label + ".");
  }
  function cycleJoke() {
    jokeIndex = (jokeIndex + 1) % jokes.length;
    noteText.textContent = jokes[jokeIndex];
    say("Sticky note updated.");
  }
  function external(url) { window.open(url, "_blank", "noopener"); }
  function openGalleryCambodia() {
    openApp("gallery");
    if (galleryInfoText) galleryInfoText.hidden = true;
    if (galleryFavorite) galleryFavorite.classList.remove("active");
    say("Opening Cambodia wiring photo.");
  }
  function lsOut(n) {
    if (!n || n.type !== "dir") return "";
    return Object.keys(n.entries).sort().map(function (k) { return n.entries[k].type === "dir" ? k + "/" : k; }).join("  ");
  }
  function prefix(a, b) {
    if (a.length > b.length) return false;
    for (var i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  function rmCmd(seg, rec) {
    if (!seg.length) return "rm: refusing to remove root";
    var n = node(seg); if (!n) return "rm: " + pstr(seg) + ": no such file";
    if (n.type === "dir" && !rec) return "rm: " + pstr(seg) + ": is a directory (use rm -r)";
    var p = parent(seg); if (!p) return "rm: cannot remove";
    delete p.parent.entries[p.name]; return "";
  }
  function mvCmd(src, dst) {
    var srcNode = node(src); if (!srcNode) return "mv: source not found";
    var srcInfo = parent(src); if (!srcInfo) return "mv: invalid source";
    var dstNode = node(dst), fin = dst.slice();
    if (dstNode && dstNode.type === "dir") fin = dst.concat(src[src.length - 1]);
    if (prefix(src, fin)) return "mv: cannot move a directory into itself";
    var finInfo = parent(fin); if (!finInfo) return "mv: invalid destination";
    finInfo.parent.entries[finInfo.name] = srcNode;
    delete srcInfo.parent.entries[srcInfo.name];
    return "";
  }
  function cpCmd(src, dst, rec) {
    var srcNode = node(src); if (!srcNode) return "cp: source not found";
    if (srcNode.type === "dir" && !rec) return "cp: " + pstr(src) + " is a directory (use cp -r)";
    var dstNode = node(dst), fin = dst.slice();
    if (dstNode && dstNode.type === "dir") fin = dst.concat(src[src.length - 1]);
    if (prefix(src, fin)) return "cp: cannot copy directory into itself";
    var finInfo = parent(fin); if (!finInfo) return "cp: invalid destination";
    finInfo.parent.entries[finInfo.name] = clone(srcNode);
    return "";
  }

  function startNano(pathArg) {
    if (!pathArg) return say("nano: missing file path");
    var seg = norm(pathArg), n = node(seg);
    if (n && n.type === "dir") return say("nano: " + pathArg + ": is a directory");
    editor = { type: "nano", seg: seg, path: pstr(seg), lines: n && n.type === "file" ? n.content.split("\n") : [], dirty: false };
    say("[ nano " + editor.path + " ]");
    say("Type text. Commands: .save, .wq, .exit, .help");
    setPrompt();
  }
  function handleNano(raw) {
    addLine(terminalPrompt.textContent + " " + raw, "command");
    if (raw === ".help") return say(".save = save, .wq = save+exit, .exit = exit");
    if (raw === ".save") { write(editor.seg, editor.lines.join("\n")); editor.dirty = false; return say("saved " + editor.path); }
    if (raw === ".wq") { write(editor.seg, editor.lines.join("\n")); say("saved " + editor.path); editor = null; setPrompt(); return; }
    if (raw === ".exit") { if (editor.dirty) say("nano: unsaved changes discarded"); editor = null; setPrompt(); return; }
    editor.lines.push(raw); editor.dirty = true;
  }

  function vimRender() {
    if (!editor || editor.type !== "vim") return;
    var v = editor;
    var rows = Math.max(10, Math.floor((terminalScroll.clientHeight - 50) / 20));
    var start = v.row >= rows ? v.row - rows + 1 : 0;
    var end = Math.min(v.lines.length, start + rows);
    terminalOutput.innerHTML = ""; terminalOutput.classList.add("vim-screen");
    for (var i = start; i < end; i += 1) {
      var el = document.createElement("div"); el.className = "vim-line";
      var ln = v.lines[i], pre = String(i + 1).padStart(4, " ") + " ";
      if (i === v.row) {
        var left = ln.slice(0, v.col), cur = ln.charAt(v.col) || " ", right = ln.slice(v.col + (v.col < ln.length ? 1 : 0));
        el.appendChild(document.createTextNode(pre + left));
        var curEl = document.createElement("span"); curEl.className = "vim-cursor"; curEl.textContent = cur;
        el.appendChild(curEl); el.appendChild(document.createTextNode(right));
      } else { el.textContent = pre + ln; }
      terminalOutput.appendChild(el);
    }
    var status = document.createElement("div");
    status.className = "vim-status";
    status.textContent = "\"" + v.path + "\"  " + v.lines.length + "L  -- " + v.mode.toUpperCase() + " --" + (v.notice ? "  " + v.notice : "");
    terminalOutput.appendChild(status);
    if (v.mode === "cmd") { var c = document.createElement("div"); c.className = "vim-command"; c.textContent = ":" + v.cmd; terminalOutput.appendChild(c); }
    terminalScroll.scrollTop = terminalScroll.scrollHeight;
  }
  function vimClamp(v) {
    if (v.row < 0) v.row = 0; if (v.row >= v.lines.length) v.row = v.lines.length - 1;
    if (v.col < 0) v.col = 0; if (v.col > v.lines[v.row].length) v.col = v.lines[v.row].length;
  }
  function vimClose(save) {
    if (!editor || editor.type !== "vim") return;
    if (save) { write(editor.seg, editor.lines.join("\n")); addLine(editor.lines.length + " line(s) written to " + editor.path); }
    editor = null; terminalWindow.classList.remove("terminal-vim"); terminalOutput.classList.remove("vim-screen");
    drawLog(); setPrompt(); terminalInput.focus();
  }
  function vimCmd(cmd) {
    var c = (cmd || "").trim().toLowerCase();
    if (!editor || editor.type !== "vim") return;
    editor.notice = "";

    if (c === "w" || c === "w!") {
      write(editor.seg, editor.lines.join("\n"));
      editor.dirty = false;
      editor.notice = editor.lines.length + " line(s) written";
      return;
    }
    if (c === "wq" || c === "wq!") {
      return vimClose(true);
    }
    if (c === "q!") {
      return vimClose(false);
    }
    if (c === "q") {
      if (!editor.dirty) {
        return vimClose(false);
      }
      editor.notice = "E37: No write since last change (add ! to override)";
      return;
    }
    if (c) {
      editor.notice = "Not an editor command: " + cmd;
    }
  }
  function startVim(pathArg) {
    if (!pathArg) return say("vim: missing file path");
    var seg = norm(pathArg), n = node(seg);
    if (n && n.type === "dir") return say("vim: " + pathArg + ": is a directory");
    editor = { type: "vim", seg: seg, path: pstr(seg), lines: n && n.type === "file" ? n.content.split("\n") : [""], row: 0, col: 0, mode: "normal", cmd: "", pending: "", dirty: false, notice: "" };
    terminalWindow.classList.add("terminal-vim"); terminalInput.blur(); vimRender();
  }
  function handleVimKey(e) {
    if (!editor || editor.type !== "vim") return false;
    var v = editor;
    if (v.mode === "cmd") {
      if (e.key === "Escape") { v.mode = "normal"; v.cmd = ""; vimRender(); return true; }
      if (e.key === "Backspace") { v.cmd = v.cmd.slice(0, -1); vimRender(); return true; }
      if (e.key === "Enter") { var c = v.cmd; v.mode = "normal"; v.cmd = ""; vimCmd(c); if (editor && editor.type === "vim") vimRender(); return true; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { v.cmd += e.key; vimRender(); return true; }
      return true;
    }
    if (v.mode === "insert") {
      if (e.key === "Escape") { v.mode = "normal"; vimRender(); return true; }
      if (e.key === "Enter") { var line = v.lines[v.row], a = line.slice(0, v.col), b = line.slice(v.col); v.lines[v.row] = a; v.lines.splice(v.row + 1, 0, b); v.row += 1; v.col = 0; v.dirty = true; vimRender(); return true; }
      if (e.key === "Backspace") {
        if (v.col > 0) { var cur = v.lines[v.row]; v.lines[v.row] = cur.slice(0, v.col - 1) + cur.slice(v.col); v.col -= 1; v.dirty = true; }
        else if (v.row > 0) { var pl = v.lines[v.row - 1].length; v.lines[v.row - 1] += v.lines[v.row]; v.lines.splice(v.row, 1); v.row -= 1; v.col = pl; v.dirty = true; }
        vimRender(); return true;
      }
      if (e.key === "ArrowLeft") v.col -= 1;
      if (e.key === "ArrowRight") v.col += 1;
      if (e.key === "ArrowUp") v.row -= 1;
      if (e.key === "ArrowDown") v.row += 1;
      if (e.key.indexOf("Arrow") === 0) { vimClamp(v); vimRender(); return true; }
      if (e.key === "Tab") { var rt = v.lines[v.row]; v.lines[v.row] = rt.slice(0, v.col) + "  " + rt.slice(v.col); v.col += 2; v.dirty = true; vimRender(); return true; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { var t = v.lines[v.row]; v.lines[v.row] = t.slice(0, v.col) + e.key + t.slice(v.col); v.col += 1; v.dirty = true; vimRender(); return true; }
      return true;
    }
    if (e.key === "i") { v.mode = "insert"; vimRender(); return true; }
    if (e.key === "a") { if (v.col < v.lines[v.row].length) v.col += 1; v.mode = "insert"; vimRender(); return true; }
    if (e.key === "o") { v.lines.splice(v.row + 1, 0, ""); v.row += 1; v.col = 0; v.mode = "insert"; v.dirty = true; vimRender(); return true; }
    if (e.key === "x") { var ln = v.lines[v.row]; if (ln.length) { v.lines[v.row] = ln.slice(0, v.col) + ln.slice(v.col + 1); v.dirty = true; if (v.col > v.lines[v.row].length) v.col = v.lines[v.row].length; } vimRender(); return true; }
    if (e.key === "h" || e.key === "ArrowLeft") v.col -= 1;
    if (e.key === "l" || e.key === "ArrowRight") v.col += 1;
    if (e.key === "j" || e.key === "ArrowDown") v.row += 1;
    if (e.key === "k" || e.key === "ArrowUp") v.row -= 1;
    if (e.key === "0") v.col = 0;
    if (e.key === "$") v.col = v.lines[v.row].length;
    if (e.key === ":") { v.mode = "cmd"; v.cmd = ""; vimRender(); return true; }
    if (e.key === "d") { if (v.pending === "d") { v.lines.splice(v.row, 1); if (!v.lines.length) v.lines = [""]; if (v.row >= v.lines.length) v.row = v.lines.length - 1; v.col = Math.min(v.col, v.lines[v.row].length); v.pending = ""; v.dirty = true; vimRender(); return true; } v.pending = "d"; return true; }
    v.pending = ""; vimClamp(v); vimRender(); return true;
  }

  function run(raw) {
    if (editor && editor.type === "nano") { handleNano(raw); terminalScroll.scrollTop = terminalScroll.scrollHeight; return; }
    var entered = raw.trim(), tokens = tokenize(raw), cmd = tokens.length ? tokens[0].toLowerCase() : "", args = tokens.slice(1);
    addLine(terminalPrompt.textContent + " " + entered, "command");
    terminalScroll.scrollTop = terminalScroll.scrollHeight;
    if (!cmd) return;

    if (cmd === "help") return say("Commands:\nhelp, clear, pwd, ls [path], cd [path], mkdir <dir>, touch <file>, cat <file>\ngrep [-i] [-n] <pattern> <file>\nrm [-r] <path>, mv <src> <dst>, cp [-r] <src> <dst>\nvim <file>\nopen resume|projects|experience|gallery|about|terminal|browser\nwallpaper next, meme next\ngo github|linkedin|x|blog|cambodia|110");
    if (cmd === "clear") return resetTerm();
    if (cmd === "pwd") return say(pstr(cwd));
    if (cmd === "ls") {
      var lseg = norm(args[0] || "."), ln = node(lseg);
      if (!ln) return say("ls: " + (args[0] || ".") + ": no such file or directory");
      return say(ln.type === "dir" ? (lsOut(ln) || "(empty)") : lseg[lseg.length - 1]);
    }
    if (cmd === "cd") {
      var cseg = norm(args[0] || "~"), cn = node(cseg);
      if (!cn || cn.type !== "dir") return say("cd: " + (args[0] || "~") + ": no such directory");
      cwd = cseg; return setPrompt();
    }
    if (cmd === "mkdir") {
      if (!args[0]) return say("mkdir: missing directory name");
      var mseg = norm(args[0]), mi = parent(mseg);
      if (!mi) return say("mkdir: cannot create directory '" + args[0] + "'");
      if (mi.parent.entries[mi.name]) return say("mkdir: " + args[0] + ": already exists");
      mi.parent.entries[mi.name] = dir(); return;
    }
    if (cmd === "touch") {
      if (!args[0]) return say("touch: missing file name");
      var tseg = norm(args[0]), ti = parent(tseg);
      if (!ti) return say("touch: cannot touch '" + args[0] + "'");
      var tn = ti.parent.entries[ti.name];
      if (tn && tn.type === "dir") return say("touch: " + args[0] + ": is a directory");
      if (!tn) ti.parent.entries[ti.name] = file(""); return;
    }
    if (cmd === "cat") {
      if (!args[0]) return say("cat: missing file path");
      var cnf = node(norm(args[0]));
      if (!cnf) return say("cat: " + args[0] + ": no such file");
      if (cnf.type === "dir") return say("cat: " + args[0] + ": is a directory");
      return say(cnf.content || "");
    }
    if (cmd === "grep") {
      if (!args.length) return say("grep: usage grep [-i] [-n] <pattern> <file>");
      var gi = false, gn = false, rest = [];
      args.forEach(function (a) {
        if (a === "-i") gi = true;
        else if (a === "-n") gn = true;
        else rest.push(a);
      });
      if (rest.length < 2) return say("grep: usage grep [-i] [-n] <pattern> <file>");
      var pattern = rest[0];
      var gfile = rest[1];
      var gnode = node(norm(gfile));
      if (!gnode) return say("grep: " + gfile + ": no such file");
      if (gnode.type === "dir") return say("grep: " + gfile + ": is a directory");
      var hay = gnode.content || "";
      var p = gi ? pattern.toLowerCase() : pattern;
      var lines = hay.split("\n");
      var hits = [];
      for (var li = 0; li < lines.length; li += 1) {
        var line = lines[li];
        var cmp = gi ? line.toLowerCase() : line;
        if (cmp.indexOf(p) >= 0) hits.push((gn ? (li + 1) + ":" : "") + line);
      }
      if (!hits.length) return;
      return say(hits.join("\n"));
    }
    if (cmd === "rm") {
      if (!args.length) return say("rm: missing operand");
      var rec = false, target = "";
      args.forEach(function (a) { if (a === "-r" || a === "-rf" || a === "-fr") rec = true; else target = a; });
      if (!target) return say("rm: missing operand");
      var re = rmCmd(norm(target), rec); if (re) say(re); return;
    }
    if (cmd === "mv") { if (args.length < 2) return say("mv: usage mv <source> <destination>"); var me = mvCmd(norm(args[0]), norm(args[1])); if (me) say(me); return; }
    if (cmd === "cp") {
      if (!args.length) return say("cp: usage cp [-r] <source> <destination>");
      var cr = false, cargs = [];
      args.forEach(function (a) { if (a === "-r" || a === "-R") cr = true; else cargs.push(a); });
      if (cargs.length < 2) return say("cp: usage cp [-r] <source> <destination>");
      var ce = cpCmd(norm(cargs[0]), norm(cargs[1]), cr); if (ce) say(ce); return;
    }
    if (cmd === "vim") return startVim(args[0] || "");
    if (cmd === "nano") return say("nano is disabled for now. Use vim <file>.");
    if (cmd === "open") { var app = (args[0] || "").toLowerCase(); if (appNames.indexOf(app) >= 0) { openApp(app); return say("Opened " + app + "."); } }
    if (cmd === "wallpaper" && (args[0] || "").toLowerCase() === "next") return cycleWallpaper();
    if (cmd === "meme" && (args[0] || "").toLowerCase() === "next") return cycleJoke();
    if (cmd === "go" && (args[0] || "").toLowerCase() === "110") { dock.classList.add("spin"); window.setTimeout(function () { dock.classList.remove("spin"); }, 700); return say("Binary 110 = decimal 6. Dock rotated."); }
    if (cmd === "go" && (args[0] || "").toLowerCase() === "cambodia") { return openGalleryCambodia(); }
    if (cmd === "go") {
      var g = (args[0] || "").toLowerCase();
      if (g === "github" || g === "github.com" || g === "github.com/kdab1175") { external("https://github.com/KDAB1175"); return say("Opening GitHub..."); }
      if (g === "linkedin" || g === "linkedin.com") { external("https://www.linkedin.com/in/albert-hajek-85a873188/"); return say("Opening LinkedIn..."); }
      if (g === "x" || g === "x.com" || g === "twitter") { external("https://x.com/albert_hajek"); return say("Opening X..."); }
      if (g === "blog" || g === "mission-log") { window.location.href = "../blog/"; return; }
    }
    say("Unknown command. Type 'help'.");
  }

  function pathComp(partial, dirsOnly) {
    var raw = partial || "", cut = raw.lastIndexOf("/");
    var dirTok = cut >= 0 ? raw.slice(0, cut + 1) : "", frag = cut >= 0 ? raw.slice(cut + 1) : raw;
    var dn = node(norm(dirTok || "."));
    if (!dn || dn.type !== "dir") return [];
    return Object.keys(dn.entries).sort().filter(function (k) { return k.indexOf(frag) === 0 && (!dirsOnly || dn.entries[k].type === "dir"); })
      .map(function (k) { return dirTok + k + (dn.entries[k].type === "dir" ? "/" : ""); });
  }
  function autocomplete() {
    if (editor) return;
    var text = terminalInput.value, trim = text.trim();
    if (!trim) return;
    var tok = tokenize(trim), cmd = tok[0].toLowerCase(), arg = tok.slice(1).join(" ");
    if (tok.length === 1 && text.indexOf(" ") < 0) {
      var cm = commandNames.filter(function (n) { return n.indexOf(cmd) === 0; });
      if (cm.length === 1) terminalInput.value = cm[0]; else if (cm.length > 1) say(cm.join("  "));
      return;
    }
    if (cmd === "open") { var am = appNames.filter(function (n) { return n.indexOf(arg.toLowerCase()) === 0; }); if (am.length === 1) terminalInput.value = "open " + am[0]; else if (am.length > 1) say(am.join("  ")); return; }
    if (cmd === "go") { var gm = goTargets.filter(function (n) { return n.indexOf(arg.toLowerCase()) === 0; }); if (gm.length === 1) terminalInput.value = "go " + gm[0]; else if (gm.length > 1) say(gm.join("  ")); return; }
    if (["cd", "ls", "cat", "grep", "vim", "mkdir", "touch", "rm", "mv", "cp"].indexOf(cmd) >= 0) {
      var last = tok[tok.length - 1] || "", pm = pathComp(last, cmd === "cd");
      if (pm.length === 1) { var prefixTxt = tok.slice(0, -1).join(" "); terminalInput.value = (prefixTxt ? prefixTxt + " " : "") + pm[0]; }
      if (pm.length > 1) say(pm.join("  "));
    }
  }

  function makeDraggable(win) {
    var bar = win.querySelector(".window-bar");
    if (!bar) return;
    var pointerId = null, moved = false, snapReady = false;
    var sx = 0, sy = 0, ox = 0, oy = 0;
    var startedFullscreen = false, grabRatioX = 0.5, grabOffsetY = 18;
    bar.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest(".dot")) return;
      pointerId = e.pointerId; moved = false; snapReady = false;
      focus(win); sx = e.clientX; sy = e.clientY;
      var startRect = win.getBoundingClientRect();
      startedFullscreen = win.classList.contains("fullscreen");
      grabRatioX = Math.max(0.08, Math.min(0.92, (e.clientX - startRect.left) / startRect.width));
      grabOffsetY = e.clientY - startRect.top;
      ox = win.offsetLeft; oy = win.offsetTop;
      bar.setPointerCapture(pointerId); e.preventDefault();
    });
    bar.addEventListener("pointermove", function (e) {
      if (pointerId !== e.pointerId) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return finishDragging(e, false);
      if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 5) return;
      moved = true; bar.style.cursor = "grabbing";
      if (startedFullscreen) {
        win.classList.remove("fullscreen");
        var restored = win.getBoundingClientRect();
        ox = Math.max(0, Math.min(window.innerWidth - restored.width, e.clientX - restored.width * grabRatioX));
        oy = Math.max(34, e.clientY - grabOffsetY);
        sx = e.clientX; sy = e.clientY; startedFullscreen = false;
        syncDock(); focus(win);
      }
      var nx = ox + (e.clientX - sx);
      var rawY = oy + (e.clientY - sy), ny = rawY;
      var maxX = Math.max(0, window.innerWidth - win.offsetWidth);
      var maxY = Math.max(34, window.innerHeight - 42);
      if (nx < 0) nx = 0;
      if (ny < 34) ny = 34;
      if (nx > maxX) nx = maxX;
      if (ny > maxY) ny = maxY;
      win.style.left = nx + "px";
      win.style.top = ny + "px";
      snapReady = rawY <= 38 || e.clientY <= 58;
      win.classList.toggle("snap-ready", snapReady);
      e.preventDefault();
    });
    function finishDragging(e, allowSnap) {
      if (pointerId !== e.pointerId) return;
      var finishedPointer = pointerId, shouldSnap = allowSnap && moved && snapReady;
      pointerId = null; moved = false; snapReady = false;
      startedFullscreen = false;
      bar.style.cursor = "grab"; win.classList.remove("snap-ready");
      if (bar.hasPointerCapture(finishedPointer)) bar.releasePointerCapture(finishedPointer);
      if (shouldSnap) fullscreen(win);
    }
    bar.addEventListener("pointerup", function (e) { finishDragging(e, true); });
    bar.addEventListener("pointercancel", function (e) { finishDragging(e, false); });
    bar.addEventListener("lostpointercapture", function (e) {
      if (pointerId !== e.pointerId) return;
      pointerId = null; moved = false; snapReady = false; startedFullscreen = false;
      bar.style.cursor = "grab"; win.classList.remove("snap-ready");
    });
  }
  function makeResizable(win) {
    ["n", "ne", "e", "se", "s", "sw", "w", "nw"].forEach(function (direction) {
      var handle = document.createElement("div");
      handle.className = "resize-handle resize-" + direction;
      handle.setAttribute("aria-hidden", "true");
      win.appendChild(handle);
      var pointerId = null, startX = 0, startY = 0, startRect = null;
      handle.addEventListener("pointerdown", function (e) {
        if (e.button !== 0 || win.classList.contains("fullscreen")) return;
        pointerId = e.pointerId; startX = e.clientX; startY = e.clientY;
        startRect = win.getBoundingClientRect(); handle.setPointerCapture(pointerId);
        focus(win); e.preventDefault(); e.stopPropagation();
      });
      handle.addEventListener("pointermove", function (e) {
        if (pointerId !== e.pointerId || !startRect) return;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        var left = startRect.left, top = startRect.top;
        var width = startRect.width, height = startRect.height;
        var minWidth = Math.min(340, window.innerWidth - 16);
        var minHeight = Math.min(220, window.innerHeight - 76);
        if (direction.indexOf("e") >= 0) width += dx;
        if (direction.indexOf("s") >= 0) height += dy;
        if (direction.indexOf("w") >= 0) { width -= dx; left += dx; }
        if (direction.indexOf("n") >= 0) { height -= dy; top += dy; }
        if (width < minWidth) { if (direction.indexOf("w") >= 0) left -= minWidth - width; width = minWidth; }
        if (height < minHeight) { if (direction.indexOf("n") >= 0) top -= minHeight - height; height = minHeight; }
        left = Math.max(0, Math.min(window.innerWidth - width, left));
        top = Math.max(34, Math.min(window.innerHeight - 42, top));
        width = Math.min(width, window.innerWidth - left);
        height = Math.min(height, window.innerHeight - top);
        win.style.left = left + "px"; win.style.top = top + "px";
        win.style.width = width + "px"; win.style.height = height + "px";
      });
      function stopResizing(e) {
        if (pointerId !== e.pointerId) return;
        var finishedPointer = pointerId; pointerId = null; startRect = null;
        if (handle.hasPointerCapture(finishedPointer)) handle.releasePointerCapture(finishedPointer);
      }
      handle.addEventListener("pointerup", stopResizing);
      handle.addEventListener("pointercancel", stopResizing);
      handle.addEventListener("lostpointercapture", function (e) {
        if (pointerId !== e.pointerId) return;
        pointerId = null; startRect = null;
      });
    });
  }
  function makeNoteDraggable(note) {
    if (!note || window.matchMedia("(max-width: 920px)").matches) return;
    var drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
    note.style.position = "fixed"; note.style.left = "108px"; note.style.top = "390px"; note.style.marginTop = "0"; note.style.cursor = "grab"; note.style.zIndex = "80";
    note.addEventListener("mousedown", function (e) { drag = true; sx = e.clientX; sy = e.clientY; ox = note.offsetLeft; oy = note.offsetTop; note.style.cursor = "grabbing"; e.preventDefault(); });
    window.addEventListener("mousemove", function (e) { if (!drag) return; note.style.left = ox + (e.clientX - sx) + "px"; note.style.top = oy + (e.clientY - sy) + "px"; });
    window.addEventListener("mouseup", function () { drag = false; note.style.cursor = "grab"; });
  }
  function makeDesktopIconDraggable(icon) {
    var pointerId = null, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    icon.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      pointerId = e.pointerId; moved = false; sx = e.clientX; sy = e.clientY;
      ox = icon.offsetLeft; oy = icon.offsetTop;
      icon.setPointerCapture(pointerId);
    });
    icon.addEventListener("pointermove", function (e) {
      if (pointerId !== e.pointerId) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return stopDragging(e);
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true; icon.classList.add("dragging");
      var maxX = Math.max(0, desktop.clientWidth - icon.offsetWidth);
      var maxY = Math.max(0, desktop.clientHeight - icon.offsetHeight - 82);
      icon.style.left = Math.max(0, Math.min(maxX, ox + dx)) + "px";
      icon.style.top = Math.max(0, Math.min(maxY, oy + dy)) + "px";
    });
    function stopDragging(e) {
      if (pointerId !== e.pointerId) return;
      var finishedPointer = pointerId; pointerId = null; icon.classList.remove("dragging");
      if (icon.hasPointerCapture(finishedPointer)) icon.releasePointerCapture(finishedPointer);
      if (moved) {
        icon._suppressLaunch = true;
        window.requestAnimationFrame(function () { icon._suppressLaunch = false; });
      }
      moved = false;
    }
    icon.addEventListener("pointerup", stopDragging);
    icon.addEventListener("pointercancel", stopDragging);
    icon.addEventListener("lostpointercapture", function (e) {
      if (pointerId !== e.pointerId) return;
      pointerId = null; moved = false; icon.classList.remove("dragging");
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dockContextMenu) { closeDockContextMenu(); return; }
    if (!editor || editor.type !== "vim") return;
    if (handleVimKey(e)) e.preventDefault();
  });

  launchers.forEach(function (b) {
    b.addEventListener("click", function () {
      if (b._suppressLaunch) return;
      openApp(b.getAttribute("data-app"));
    });
  });
  document.addEventListener("click", function (e) {
    var summary = e.target.closest("[data-summary]");
    if (summary) { restoreAppSummary(summary.getAttribute("data-summary")); return; }
    var link = e.target.closest('a[href="resume.html"], a[href="projects.html"], a[href="experience.html"], a[href="index.html"]');
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    var href = link.getAttribute("href");
    if (href === "index.html") {
      var owner = link.closest("[data-app-window]");
      if (owner) closeWindow(owner.getAttribute("data-app-window"));
      return;
    }
    var app = href.replace(".html", "");
    if (link.classList.contains("inline-link") || link.closest(".detail-view")) loadFullApp(app);
    else openApp(app);
  });
  closeButtons.forEach(function (b) { b.addEventListener("click", function () { closeWindow(b.getAttribute("data-close")); }); });
  minButtons.forEach(function (b) { b.addEventListener("click", function () { minimize(b.closest(".window")); }); });
  maxButtons.forEach(function (b) { b.addEventListener("click", function () { fullscreen(b.closest(".window")); }); });
  bars.forEach(function (b) { b.addEventListener("dblclick", function () { fullscreen(b.closest(".window")); }); });
  windows.forEach(function (w) {
    makeDraggable(w); makeResizable(w);
    w.addEventListener("mousedown", function () {
      if (!w.classList.contains("focused")) focus(w);
    });
  });
  desktopIcons.forEach(makeDesktopIconDraggable);
  dockItems.forEach(function (item) {
    item.addEventListener("contextmenu", function (e) { e.preventDefault(); openDockContextMenu(item); });
    item.addEventListener("keydown", function (e) {
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); openDockContextMenu(item); }
    });
  });
  document.addEventListener("mousedown", function (e) {
    var target = e.target;
    if (dockContextMenu && !target.closest(".dock-context-menu") && !target.closest(".dock-item")) closeDockContextMenu();
    if (target.closest(".window, .dock, .menu-bar, .desktop-icon, .desktop-note, .dock-context-menu")) return;
    blurWindows();
  });
  if (galleryShare) {
    galleryShare.addEventListener("click", function () {
      window.open("https://x.com/intent/tweet?text=" + encodeURIComponent("some guy made this crazy portfolio website abc.xyz"), "_blank", "noopener");
    });
  }
  if (galleryFavorite) {
    galleryFavorite.addEventListener("click", function () {
      galleryFavorite.classList.toggle("active");
      galleryFavorite.textContent = galleryFavorite.classList.contains("active") ? "Favorited" : "Favorite";
    });
  }
  if (galleryInfo && galleryInfoText) {
    galleryInfo.addEventListener("click", function () {
      galleryInfoText.hidden = !galleryInfoText.hidden;
    });
  }
  browserForm.addEventListener("submit", function (e) {
    e.preventDefault(); loadBrowserUrl(browserTarget(browserAddress.value), true);
  });
  browserBack.addEventListener("click", function () {
    if (browserHistoryIndex <= 0) return;
    browserHistoryIndex -= 1; loadBrowserUrl(browserHistory[browserHistoryIndex], false);
  });
  browserForward.addEventListener("click", function () {
    if (browserHistoryIndex >= browserHistory.length - 1) return;
    browserHistoryIndex += 1; loadBrowserUrl(browserHistory[browserHistoryIndex], false);
  });
  browserReload.addEventListener("click", function () {
    if (browserHistoryIndex >= 0) loadBrowserUrl(browserHistory[browserHistoryIndex], false);
  });
  browserHome.addEventListener("click", function () {
    loadBrowserUrl(browserTarget(""), true);
  });
  browserExternal.addEventListener("click", function () {
    var url = browserHistoryIndex >= 0 ? browserHistory[browserHistoryIndex] : browserTarget(browserAddress.value);
    window.open(url, "_blank", "noopener");
  });
  browserFrame.addEventListener("load", function () {
    if (browserHistoryIndex < 0 || browserBlockedMode) return;
    browserNotice.textContent = "Loaded " + browserHistory[browserHistoryIndex] + ". Some websites may refuse embedding.";
  });
  wallpaperToggle.addEventListener("click", cycleWallpaper);
  jokeToggle.addEventListener("click", cycleJoke);
  var terminalPointerStart = null;
  terminalWindow.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || e.target.closest("button, a") || (editor && editor.type === "vim")) {
      terminalPointerStart = null;
      return;
    }
    terminalPointerStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  });
  terminalWindow.addEventListener("pointerup", function (e) {
    if (!terminalPointerStart || terminalPointerStart.pointerId !== e.pointerId) return;
    var moved = Math.hypot(e.clientX - terminalPointerStart.x, e.clientY - terminalPointerStart.y);
    terminalPointerStart = null;
    var selection = window.getSelection();
    if (moved > 4 || (selection && !selection.isCollapsed && selection.toString())) return;
    terminalInput.focus();
  });
  terminalWindow.addEventListener("pointercancel", function () { terminalPointerStart = null; });

  terminalInput.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); if (!editor || editor.type !== "vim") resetTerm(); return; }
    if (e.key === "Tab") { e.preventDefault(); autocomplete(); return; }
    if (editor && editor.type === "vim") { e.preventDefault(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); if (!history.length) return; if (historyIndex < 0) historyIndex = history.length - 1; else if (historyIndex > 0) historyIndex -= 1; terminalInput.value = history[historyIndex]; return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (!history.length) return; if (historyIndex >= 0 && historyIndex < history.length - 1) { historyIndex += 1; terminalInput.value = history[historyIndex]; } else { historyIndex = -1; terminalInput.value = ""; } return; }
    if (e.key === "Enter") { var v = terminalInput.value.trim(); if (v) history.push(v); historyIndex = -1; run(terminalInput.value); terminalInput.value = ""; terminalScroll.scrollTop = terminalScroll.scrollHeight; }
  });

  initFs();
  document.body.classList.add("booting");
  document.body.classList.add(wallpapers[wallpaperIndex].className);
  noteText.textContent = jokes[jokeIndex];
  if (window.matchMedia("(max-width: 920px)").matches) {
    windows.forEach(function (w) { w.classList.remove("active", "focused", "minimized"); });
  }
  var initialWindows = windows.filter(function (w) { return w.classList.contains("active"); });
  initialWindows.forEach(function (w) { runningApps[w.getAttribute("data-app-window")] = true; });
  if (window.matchMedia("(max-width: 920px)").matches) openApp("terminal");
  else if (initialWindows.length) focus(initialWindows[initialWindows.length - 1]);
  clockTick(); setInterval(clockTick, 1000);
  makeNoteDraggable(desktopNote);
  syncBrowserControls();
  syncDock();
  resetTerm();
  setPrompt();

  if (bootScreen && bootProgress) {
    window.setTimeout(function () { bootProgress.style.width = "35%"; }, 80);
    window.setTimeout(function () { bootProgress.style.width = "78%"; }, 360);
    window.setTimeout(function () { bootProgress.style.width = "100%"; }, 780);
    window.setTimeout(function () {
      bootScreen.classList.add("hidden");
      document.body.classList.remove("booting");
    }, 1120);
  } else {
    document.body.classList.remove("booting");
  }
})();


