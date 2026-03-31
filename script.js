(function () {
  var windows = Array.prototype.slice.call(document.querySelectorAll("[data-app-window]"));
  var launchers = Array.prototype.slice.call(document.querySelectorAll("[data-app]"));
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
  var history = [];
  var historyIndex = -1;
  var log = [];
  var editor = null; // {type:'nano'|'vim', ...}

  var wallpapers = ["wallpaper-sonoma", "wallpaper-big-sur", "wallpaper-joke"];
  var wallpaperIndex = 0;
  var jokes = [
    "Computer is like air conditioning. It becomes useless when you open Windows.",
    "There is no place like 127.0.0.1.",
    "On my machine, it was a feature."
  ];
  var jokeIndex = 0;
  var appNames = ["about", "terminal", "resume", "projects", "experience", "gallery"];
  var goTargets = ["github", "linkedin", "x", "blog", "cambodia", "110"];
  var commandNames = ["help", "clear", "pwd", "ls", "cd", "mkdir", "touch", "cat", "grep", "rm", "mv", "cp", "vim", "open", "wallpaper", "meme", "go"];

  function dir() { return { type: "dir", entries: {} }; }
  function file(content) { return { type: "file", content: content || "" }; }
  var fsRoot = dir();
  var home = ["Users", "albert"];
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
    fsRoot.entries.Users.entries.albert = dir();
    fsRoot.entries.Users.entries.albert.entries.Documents = dir();
    fsRoot.entries.Users.entries.albert.entries.Projects = dir();
    fsRoot.entries.Users.entries.albert.entries.Notes = dir();
    write(["Users", "albert", "README.txt"], "AlbertOS ephemeral filesystem.\nNothing persists after refresh.");
    write(["Users", "albert", "Documents", "resume.txt"], "Put your resume highlights here.");
    write(["Users", "albert", "Projects", "ideas.md"], "Project concepts and build notes.");
    write(["Users", "albert", "Notes", "todo.txt"], "1) polish site\n2) ship");
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
    terminalPrompt.textContent = "albert@macos " + showPath(cwd) + " %";
    terminalInput.placeholder = "help";
  }
  function resetTerm() {
    log = [];
    addLine("Welcome to AlbertOS.");
    addLine("Type <help> to list commands.");
    addLine("Use Ctrl+L to clear, Tab to autocomplete.");
    drawLog();
    setPrompt();
  }

  function clockTick() {
    clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function getWindow(app) { return document.getElementById("window-" + app); }
  function syncDock() {
    dockItems.forEach(function (d) {
      var w = getWindow(d.getAttribute("data-app"));
      d.classList.remove("open", "minimized");
      if (w && w.classList.contains("active")) d.classList.add(w.classList.contains("minimized") ? "minimized" : "open");
    });
  }
  function focus(w) {
    if (!w) return;
    zCounter += 1; w.style.zIndex = String(zCounter);
    windows.forEach(function (i) { i.classList.remove("focused"); });
    w.classList.add("focused");
  }
  function openApp(app) {
    var w = getWindow(app); if (!w) return;
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
  }
  function closeApp(app) {
    var w = getWindow(app); if (!w) return;
    w.classList.remove("active", "focused", "minimized", "fullscreen");
    syncDock();
  }
  function minimize(w) { if (w && w.classList.contains("active")) { w.classList.add("minimized"); w.classList.remove("focused"); syncDock(); } }
  function fullscreen(w) {
    if (!w || window.matchMedia("(max-width: 920px)").matches) return;
    w.classList.toggle("fullscreen"); if (w.classList.contains("minimized")) w.classList.remove("minimized");
    focus(w); syncDock();
  }

  function cycleWallpaper() {
    document.body.classList.remove(wallpapers[wallpaperIndex]);
    wallpaperIndex = (wallpaperIndex + 1) % wallpapers.length;
    document.body.classList.add(wallpapers[wallpaperIndex]);
    say("Wallpaper set: " + wallpapers[wallpaperIndex].replace("wallpaper-", "") + ".");
  }
  function cycleJoke() {
    jokeIndex = (jokeIndex + 1) % jokes.length;
    noteText.textContent = jokes[jokeIndex];
    say("Meme note updated.");
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

    if (cmd === "help") return say("Commands:\nhelp, clear, pwd, ls [path], cd [path], mkdir <dir>, touch <file>, cat <file>\ngrep [-i] [-n] <pattern> <file>\nrm [-r] <path>, mv <src> <dst>, cp [-r] <src> <dst>\nvim <file>\nopen resume|projects|experience|gallery|about|terminal\nwallpaper next, meme next\ngo github|linkedin|x|blog|cambodia|110");
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
    if (!bar || window.matchMedia("(max-width: 920px)").matches) return;
    var drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
    bar.addEventListener("mousedown", function (e) {
      if (e.target.classList.contains("dot") || win.classList.contains("fullscreen")) return;
      drag = true; focus(win); sx = e.clientX; sy = e.clientY; ox = win.offsetLeft; oy = win.offsetTop; bar.style.cursor = "grabbing"; e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!drag) return;
      var nx = ox + (e.clientX - sx);
      var ny = oy + (e.clientY - sy);
      var maxX = Math.max(0, window.innerWidth - win.offsetWidth);
      var maxY = Math.max(34, window.innerHeight - 42);
      if (nx < 0) nx = 0;
      if (ny < 34) ny = 34;
      if (nx > maxX) nx = maxX;
      if (ny > maxY) ny = maxY;
      win.style.left = nx + "px";
      win.style.top = ny + "px";
    });
    window.addEventListener("mouseup", function () { drag = false; bar.style.cursor = "grab"; });
  }
  function makeNoteDraggable(note) {
    if (!note || window.matchMedia("(max-width: 920px)").matches) return;
    var drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
    note.style.position = "fixed"; note.style.left = "108px"; note.style.top = "390px"; note.style.marginTop = "0"; note.style.cursor = "grab"; note.style.zIndex = "80";
    note.addEventListener("mousedown", function (e) { drag = true; sx = e.clientX; sy = e.clientY; ox = note.offsetLeft; oy = note.offsetTop; note.style.cursor = "grabbing"; e.preventDefault(); });
    window.addEventListener("mousemove", function (e) { if (!drag) return; note.style.left = ox + (e.clientX - sx) + "px"; note.style.top = oy + (e.clientY - sy) + "px"; });
    window.addEventListener("mouseup", function () { drag = false; note.style.cursor = "grab"; });
  }

  document.addEventListener("keydown", function (e) {
    if (!editor || editor.type !== "vim") return;
    if (handleVimKey(e)) e.preventDefault();
  });

  launchers.forEach(function (b) { b.addEventListener("click", function () { openApp(b.getAttribute("data-app")); }); });
  closeButtons.forEach(function (b) { b.addEventListener("click", function () { closeApp(b.getAttribute("data-close")); }); });
  minButtons.forEach(function (b) { b.addEventListener("click", function () { minimize(b.closest(".window")); }); });
  maxButtons.forEach(function (b) { b.addEventListener("click", function () { fullscreen(b.closest(".window")); }); });
  bars.forEach(function (b) { b.addEventListener("dblclick", function () { fullscreen(b.closest(".window")); }); });
  windows.forEach(function (w) { makeDraggable(w); w.addEventListener("mousedown", function () { focus(w); }); });
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
  wallpaperToggle.addEventListener("click", cycleWallpaper);
  jokeToggle.addEventListener("click", cycleJoke);
  terminalScroll.addEventListener("mousedown", function () { if (!editor || editor.type !== "vim") terminalInput.focus(); });

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
  document.body.classList.add(wallpapers[wallpaperIndex]);
  noteText.textContent = jokes[jokeIndex];
  if (window.matchMedia("(max-width: 920px)").matches) {
    windows.forEach(function (w) { w.classList.remove("active", "focused", "minimized"); });
    openApp("terminal");
  }
  clockTick(); setInterval(clockTick, 1000);
  makeNoteDraggable(desktopNote);
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
