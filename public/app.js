const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- API ---

async function api(path, opts) {
  try {
    const res = await fetch(`/api${path}`, opts);
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function postJSON(path, body) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

// --- Helpers ---

function html(el, content) { el.innerHTML = content; }

function escape(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function truncate(s, n) {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function renderError(msg) {
  return `<div class="error-msg">${escape(msg)}</div>`;
}

function renderEmpty(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

// --- Markdown renderer ---

function renderMarkdown(raw) {
  if (!raw) return "";
  let text = raw;

  // Fenced code blocks
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${escape(code.trim())}</code></pre>`
  );

  // Inline code (protect from further processing)
  const codeMap = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const id = `\x00CODE${codeMap.length}\x00`;
    codeMap.push(`<code>${escape(code)}</code>`);
    return id;
  });

  // Headings
  text = text.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold / italic
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  // Images (render as links since we're in a modal)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">[$1]</a>'
  );

  // Horizontal rules
  text = text.replace(/^---+$/gm, "<hr>");

  // Blockquotes
  text = text.replace(/^>\s*(.+)$/gm, "<blockquote>$1</blockquote>");

  // List items
  text = text.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> in <ul>
  text = text.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, "<ul>$1</ul>");

  // Paragraphs: split on double newlines, wrap non-block content
  const blocks = text.split(/\n{2,}/);
  text = blocks
    .map((b) => {
      b = b.trim();
      if (!b) return "";
      if (/^<(?:h[1-6]|pre|ul|ol|hr|blockquote|div)/.test(b)) return b;
      return `<p>${b.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  // Restore inline code
  codeMap.forEach((code, i) => {
    text = text.replace(`\x00CODE${i}\x00`, code);
  });

  return text;
}

// --- Toast ---

let toastTimer = null;

function showToast(message, kind = "info", durationMs = 3500) {
  let toast = $("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  if (durationMs > 0) {
    toastTimer = setTimeout(() => toast.classList.add("hidden"), durationMs);
  }
}

// --- Installed state ---

let installedBySource = new Map();
let installedByName = new Map();

async function refreshInstalled() {
  const list = await api("/plugins");
  const plugins = Array.isArray(list) ? list : [];
  installedBySource = new Map();
  installedByName = new Map();
  for (const p of plugins) {
    if (p?.source) installedBySource.set(p.source.toLowerCase(), p);
    if (p?.name) installedByName.set(p.name, p);
  }
  return plugins;
}

function isInstalled(repoFullName) {
  return installedBySource.has(String(repoFullName || "").toLowerCase());
}

// --- Actions ---

async function installRepo(fullName, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Installing…"; }
  showToast(`Installing ${fullName}…`, "info", 0);
  const result = await postJSON("/plugins/install", { source: fullName });
  if (result?.success) {
    showToast(`Installed ${fullName}`, "success");
    await refreshInstalled();
    invalidatePages(["installed", "store"]);
    refreshActivePage();
  } else {
    showToast(`Install failed: ${truncate(result?.error || "unknown", 200)}`, "error", 6000);
    if (btn) { btn.disabled = false; btn.textContent = "Install"; }
  }
}

async function removePlugin(name, btn) {
  if (!confirm(`Remove ${name}?`)) return;
  if (btn) { btn.disabled = true; btn.textContent = "Removing…"; }
  showToast(`Removing ${name}…`, "info", 0);
  const result = await postJSON("/plugins/remove", { name });
  if (result?.success) {
    showToast(`Removed ${name}`, "success");
    await refreshInstalled();
    invalidatePages(["installed", "store"]);
    refreshActivePage();
  } else {
    showToast(`Remove failed: ${truncate(result?.error || "unknown", 200)}`, "error", 6000);
    if (btn) { btn.disabled = false; btn.textContent = "Remove"; }
  }
}

async function updatePlugin(name, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Updating…"; }
  showToast(`Updating ${name}…`, "info", 0);
  const result = await postJSON("/plugins/update", { name });
  if (result?.success) {
    showToast(`Updated ${name}`, "success");
    await refreshInstalled();
    invalidatePages(["installed", "store"]);
    refreshActivePage();
  } else {
    showToast(`Update failed: ${truncate(result?.error || "unknown", 200)}`, "error", 6000);
    if (btn) { btn.disabled = false; btn.textContent = "Update"; }
  }
}

function invalidatePages(names) {
  for (const n of names) loaded[n] = false;
}

function refreshActivePage() {
  const active = $(".page.active");
  if (!active) return;
  const id = active.id.replace("page-", "");
  loaders[id]?.();
}

// --- Navigation ---

function navigate(page) {
  $$(".page").forEach((p) => p.classList.remove("active"));
  $$(".nav-link").forEach((l) => l.classList.remove("active"));
  $(`#page-${page}`)?.classList.add("active");
  $(`.nav-link[data-page="${page}"]`)?.classList.add("active");
  loaders[page]?.();
}

// --- Badges ---

function trustBadge(source, tier) {
  const t = (tier || "").toLowerCase();
  if (t === "official") return '<span class="badge badge-official">official</span>';
  if (t === "team") return '<span class="badge badge-team">team</span>';
  if (t === "unverified") return '<span class="badge badge-unverified">community</span>';
  if (!source) return "";
  return source.toLowerCase().startsWith("corvidlabs/")
    ? '<span class="badge badge-official">official</span>'
    : '<span class="badge badge-unverified">community</span>';
}

function typeBadge(topics) {
  if (!topics) return "";
  if (topics.includes("fledge-plugin"))
    return '<span class="badge badge-plugin">plugin</span>';
  if (topics.includes("fledge-template"))
    return '<span class="badge badge-template">template</span>';
  return "";
}

function statusDot(status) {
  const s = String(status || "").toLowerCase();
  const cls = s === "ok" ? "status-ok" : s === "warn" ? "status-warn" : s === "fail" ? "status-fail" : "";
  return `<span class="status-dot ${cls}"></span>`;
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "ok" || s === "pass") return '<span class="status-pill status-ok">OK</span>';
  if (s === "warn" || s === "warning") return '<span class="status-pill status-warn">WARN</span>';
  if (s === "fail" || s === "error") return '<span class="status-pill status-fail">FAIL</span>';
  if (s === "skip" || s === "skipped") return '<span class="status-pill status-skip">SKIP</span>';
  return `<span class="status-pill">${escape(status || "?")}</span>`;
}

// --- Store card ---

function renderStoreCard(repo) {
  const owner = escape(repo.owner?.login || "");
  const isOfficial = (repo.owner?.login || "").toLowerCase() === "corvidlabs";
  const topics = (repo.topics || []).filter((t) => t !== "fledge-plugin" && t !== "fledge-template" && t !== "fledge").slice(0, 5);
  const installed = isInstalled(repo.full_name);
  const fullEsc = escape(repo.full_name || "");
  const installedPlugin = installedBySource.get((repo.full_name || "").toLowerCase());

  const actions = installed
    ? `<button class="btn btn-sm btn-outline" data-action="readme" data-owner="${escape(repo.owner?.login)}" data-repo="${escape(repo.name)}">Readme</button>
       <button class="btn btn-sm btn-outline" data-action="update" data-name="${escape(installedPlugin?.name || repo.name)}">Update</button>
       <button class="btn btn-sm btn-danger" data-action="remove" data-name="${escape(installedPlugin?.name || repo.name)}">Remove</button>`
    : `<button class="btn btn-sm btn-outline" data-action="readme" data-owner="${escape(repo.owner?.login)}" data-repo="${escape(repo.name)}">Readme</button>
       <button class="btn btn-sm" data-action="install" data-source="${fullEsc}">Install</button>`;

  const lang = repo.language || "";
  const topicTagsHtml = topics.map((t) => {
    const active = storeFilters.topics.has(t.toLowerCase());
    return `<button type="button" class="topic-tag${active ? " active" : ""}" data-action="toggle-topic" data-value="${escape(t)}">${escape(t)}</button>`;
  }).join("");

  const langStat = lang
    ? `<button type="button" class="store-card-stat store-card-stat-link" data-action="set-language" data-value="${escape(lang)}">${escape(lang)}</button>`
    : "";
  const ownerLink = repo.owner?.login
    ? `<button type="button" class="store-card-author-link" data-action="set-owner" data-value="${escape(repo.owner.login)}">${owner}</button>`
    : owner;

  return `
    <div class="store-card${installed ? " store-card-installed" : ""}">
      <div class="store-card-header">
        <img class="store-card-avatar" src="${escape(repo.owner?.avatar_url || "")}" alt="${owner}" loading="lazy">
        <div class="store-card-title">
          <div class="store-card-name">
            <a href="${escape(repo.html_url)}" target="_blank" rel="noopener">${escape(repo.name)}</a>
          </div>
          <div class="store-card-author">
            ${ownerLink}
            ${isOfficial ? '<span class="badge badge-official">official</span>' : ""}
            ${installed ? '<span class="badge badge-installed">installed</span>' : ""}
          </div>
        </div>
      </div>
      <div class="store-card-desc">${escape(repo.description || "No description")}</div>
      <div class="store-card-topics">
        ${typeBadge(repo.topics)}
        ${topicTagsHtml}
      </div>
      <div class="store-card-footer">
        <div class="store-card-stats">
          <span class="store-card-stat">${repo.stargazers_count || 0} stars</span>
          ${langStat}
          <span class="store-card-stat">${timeAgo(repo.updated_at)}</span>
        </div>
        <div class="store-card-actions">${actions}</div>
      </div>
    </div>`;
}

// --- README modal ---

async function showReadme(owner, repo) {
  const modal = $("#readme-modal");
  const title = $("#readme-title");
  const body = $("#readme-body");
  title.textContent = `${owner}/${repo}`;
  body.innerHTML = '<div class="loading">Loading README</div>';
  modal.classList.remove("hidden");
  const data = await api(`/github/readme/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const content = data?.content || data?.error || "No README found";
  body.innerHTML = renderMarkdown(content);
}

// --- Run output ---

function showRunOutput(title, body, kind = "info") {
  const card = $("#run-output-card");
  const titleEl = $("#run-output-title");
  const bodyEl = $("#run-output-body");
  titleEl.textContent = title;
  bodyEl.textContent = body;
  card.classList.remove("hidden", "run-output-success", "run-output-error", "run-output-info");
  card.classList.add(`run-output-${kind}`);
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function runTask(name, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Running…"; }
  showToast(`Running ${name}…`, "info", 0);
  showRunOutput(`fledge run ${name}`, "Running…", "info");
  const result = await postJSON("/project/run-task", { task: name });
  const output = (result?.stdout || "") + (result?.stderr ? "\n\n" + result.stderr : "");
  if (result?.success) {
    showToast(`Task ${name} succeeded`, "success");
    showRunOutput(`fledge run ${name} (exit ${result.exitCode})`, output || "(no output)", "success");
  } else {
    showToast(`Task ${name} failed`, "error", 6000);
    showRunOutput(`fledge run ${name} (exit ${result?.exitCode ?? "?"})`, output || result?.error || "(no output)", "error");
  }
  if (btn) { btn.disabled = false; btn.textContent = "Run"; }
}

async function runLane(name, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Running…"; }
  showToast(`Running lane ${name}…`, "info", 0);
  showRunOutput(`fledge lanes run ${name}`, "Running…", "info");
  const result = await postJSON("/project/run-lane", { lane: name });
  const output = (result?.stdout || "") + (result?.stderr ? "\n\n" + result.stderr : "");
  if (result?.success) {
    showToast(`Lane ${name} succeeded`, "success");
    showRunOutput(`fledge lanes run ${name} (exit ${result.exitCode})`, output || "(no output)", "success");
  } else {
    showToast(`Lane ${name} failed`, "error", 6000);
    showRunOutput(`fledge lanes run ${name} (exit ${result?.exitCode ?? "?"})`, output || result?.error || "(no output)", "error");
  }
  if (btn) { btn.disabled = false; btn.textContent = "Run"; }
}

async function openRepo() {
  const result = await postJSON("/project/open-repo", {});
  if (result?.opened) {
    showToast(`Opened ${result.url}`, "success");
  } else {
    showToast(result?.error || "Could not open repo", "error");
  }
}

// --- Project page ---

function renderProject(info) {
  const header = $("#project-header");
  const content = $("#project-content");

  html(header, `
    <div class="project-header">
      <div>
        <div class="project-header-kicker">Project</div>
        <h1>${escape(info.name || "Untitled")}</h1>
        <div class="project-header-meta">
          ${info.version ? `<span class="badge badge-version">v${escape(info.version)}</span>` : ""}
          ${info.branch ? `<span class="badge badge-team">${escape(info.branch)}</span>` : ""}
          ${(info.languages || []).map((l) => `<span class="badge badge-command">${escape(l)}</span>`).join("")}
        </div>
        <div class="project-header-cwd">${escape(info.cwd || "")}</div>
      </div>
      <div class="project-header-actions">
        ${info.remoteUrl ? '<button class="btn btn-outline" data-action="open-repo">Open repo</button>' : ""}
      </div>
    </div>`);

  const healthHtml = `
    <div class="card">
      <h2>Health</h2>
      <div class="health-list">
        ${(info.health || []).map((h) => `
          <div class="health-item">
            ${statusDot(h.status)}
            <span class="health-name">${escape(h.name)}</span>
            <span class="health-detail">${escape(h.detail || "")}</span>
          </div>`).join("")}
      </div>
    </div>`;

  const tasksHtml = info.hasFledgeToml
    ? `<div class="card">
        <h2>Tasks</h2>
        ${info.tasks.length === 0
          ? renderEmpty("No tasks defined in fledge.toml")
          : `<div class="run-list">
              ${info.tasks.map((t) => `
                <div class="run-item">
                  <div>
                    <div class="run-item-name">${escape(t.name)}</div>
                    ${t.description ? `<div class="run-item-desc">${escape(t.description)}</div>` : ""}
                    ${t.cmd ? `<div class="run-item-cmd"><code>${escape(t.cmd)}</code></div>` : ""}
                  </div>
                  <button class="btn btn-sm" data-action="run-task" data-name="${escape(t.name)}">Run</button>
                </div>`).join("")}
            </div>`}
      </div>`
    : "";

  const lanesHtml = info.hasFledgeToml
    ? `<div class="card">
        <h2>Lanes</h2>
        ${info.lanes.length === 0
          ? renderEmpty("No lanes defined")
          : `<div class="run-list">
              ${info.lanes.map((l) => `
                <div class="run-item">
                  <div>
                    <div class="run-item-name">${escape(l.name)}</div>
                    ${l.description ? `<div class="run-item-desc">${escape(l.description)}</div>` : ""}
                    <div class="run-item-meta">
                      ${l.steps != null ? `<span class="badge badge-version">${l.steps} steps</span>` : ""}
                      ${l.fail_fast ? '<span class="badge badge-team">fail-fast</span>' : ""}
                    </div>
                  </div>
                  <button class="btn btn-sm" data-action="run-lane" data-name="${escape(l.name)}">Run</button>
                </div>`).join("")}
            </div>`}
      </div>`
    : "";

  const commitsHtml = info.isGit && info.commits.length > 0
    ? `<div class="card">
        <h2>Recent commits</h2>
        <div class="commits-list">
          ${info.commits.slice(0, 10).map((c) => `
            <div class="commit-row">
              <span class="commit-hash">${escape(c.hash)}</span>
              <span class="commit-subject">${escape(c.subject)}</span>
              <span class="commit-meta">${escape(c.author)} · ${escape(c.date)}</span>
            </div>`).join("")}
        </div>
      </div>`
    : "";

  const workingTreeHtml = info.isGit && info.workingTree.length > 0
    ? `<div class="card">
        <h2>Working tree (${info.workingTree.length})</h2>
        <pre class="terminal-output">${escape(info.workingTree.join("\n"))}</pre>
      </div>`
    : "";

  const tagsHtml = info.tags.length > 0
    ? `<div class="card">
        <h2>Recent tags</h2>
        <div class="tag-list">
          ${info.tags.map((t) => `<span class="badge badge-version">${escape(t)}</span>`).join("")}
        </div>
      </div>`
    : "";

  html(content, `
    <div id="run-output-card" class="card hidden">
      <div class="run-output-header">
        <h2 id="run-output-title">Output</h2>
        <button class="btn-icon" data-action="close-output" aria-label="Close">&times;</button>
      </div>
      <pre class="terminal-output" id="run-output-body"></pre>
    </div>
    ${healthHtml}
    ${tasksHtml}
    ${lanesHtml}
    ${commitsHtml}
    ${workingTreeHtml}
    ${tagsHtml}`);
}

// --- Doctor ---

function renderDoctor(report) {
  const passed = Number(report.passed ?? 0);
  const failed = Number(report.failed ?? 0);

  const summary = `
    <div class="doctor-summary">
      <div class="doctor-summary-item doctor-summary-ok">
        <div class="doctor-summary-value">${passed}</div>
        <div class="doctor-summary-label">passed</div>
      </div>
      <div class="doctor-summary-item ${failed > 0 ? "doctor-summary-fail" : ""}">
        <div class="doctor-summary-value">${failed}</div>
        <div class="doctor-summary-label">failed</div>
      </div>
    </div>`;

  const sections = (report.sections || [])
    .map((sec) => {
      const checks = (sec.checks || [])
        .map((chk) => `
          <div class="doctor-check">
            <div class="doctor-check-status">${statusBadge(chk.status)}</div>
            <div>
              <div class="doctor-check-name">
                ${escape(chk.name)}
                ${chk.version ? `<span class="badge badge-version">${escape(chk.version)}</span>` : ""}
              </div>
              ${chk.detail ? `<div class="doctor-check-detail">${escape(chk.detail)}</div>` : ""}
              ${chk.fix ? `<div class="doctor-check-fix"><strong>Fix:</strong> ${escape(chk.fix)}</div>` : ""}
            </div>
          </div>`)
        .join("");
      return `
        <div class="doctor-section">
          <h3 class="doctor-section-name">${escape(sec.name)}</h3>
          <div class="doctor-checks">${checks}</div>
        </div>`;
    })
    .join("");

  return `${summary}${sections}`;
}

// --- Store filter state ---

const storeFilters = {
  category: "all",
  q: "",
  language: "",
  owner: "",
  license: "",
  topics: new Set(),
};

let storeFacets = { topics: [], languages: [], owners: [], licenses: [] };

const FACET_INITIAL_LIMIT = 8;
const facetExpanded = { topics: false, languages: false, owners: false, licenses: false };

function buildStoreUrl() {
  const params = new URLSearchParams({ category: storeFilters.category });
  if (storeFilters.q) params.set("q", storeFilters.q);
  if (storeFilters.language) params.set("language", storeFilters.language);
  if (storeFilters.owner) params.set("owner", storeFilters.owner);
  if (storeFilters.license) params.set("license", storeFilters.license);
  for (const t of storeFilters.topics) params.append("topic", t);
  return `/github/browse?${params}`;
}

function activeFilterCount() {
  let n = 0;
  if (storeFilters.q) n += 1;
  if (storeFilters.language) n += 1;
  if (storeFilters.owner) n += 1;
  if (storeFilters.license) n += 1;
  n += storeFilters.topics.size;
  return n;
}

function clearStoreFilters() {
  storeFilters.q = "";
  storeFilters.language = "";
  storeFilters.owner = "";
  storeFilters.license = "";
  storeFilters.topics.clear();
  const search = $("#store-search");
  if (search) search.value = "";
  loaders.store();
}

function toggleTopic(topic) {
  const key = String(topic || "").toLowerCase();
  if (!key) return;
  if (storeFilters.topics.has(key)) storeFilters.topics.delete(key);
  else storeFilters.topics.add(key);
  loaders.store();
}

function setSingleFilter(key, value) {
  if (key !== "language" && key !== "owner" && key !== "license") return;
  const next = String(value || "");
  storeFilters[key] = storeFilters[key] === next ? "" : next;
  loaders.store();
}

function renderActiveFilters() {
  const wrap = $("#store-active-filters");
  if (!wrap) return;
  const chips = [];
  if (storeFilters.q) {
    chips.push({ kind: "q", label: storeFilters.q, onRemove: "clear-q" });
  }
  for (const t of storeFilters.topics) {
    chips.push({ kind: "topic", label: t, onRemove: "toggle-topic", value: t });
  }
  if (storeFilters.language) {
    chips.push({ kind: "lang", label: storeFilters.language, onRemove: "set-language", value: storeFilters.language });
  }
  if (storeFilters.owner) {
    chips.push({ kind: "owner", label: storeFilters.owner, onRemove: "set-owner", value: storeFilters.owner });
  }
  if (storeFilters.license) {
    chips.push({ kind: "license", label: storeFilters.license, onRemove: "set-license", value: storeFilters.license });
  }
  if (chips.length === 0) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = chips.map((c) => `
    <button type="button" class="active-filter-chip" data-action="${c.onRemove}"${c.value != null ? ` data-value="${escape(c.value)}"` : ""} title="Remove filter">
      <span class="active-filter-chip-key">${c.kind}</span>
      <span>${escape(c.label)}</span>
      <span class="active-filter-chip-x">&times;</span>
    </button>`).join("");
}

function renderFilterGroup(label, key, options, activeSet, action) {
  if (!options || options.length === 0) {
    return `
      <div class="filter-group">
        <div class="filter-group-name">${label}</div>
        <div class="filter-group-empty">— none —</div>
      </div>`;
  }
  const expanded = facetExpanded[key];
  const visible = expanded ? options : options.slice(0, FACET_INITIAL_LIMIT);
  const remainder = options.length - visible.length;
  const items = visible.map((opt) => {
    const lower = opt.value.toLowerCase();
    const active = activeSet ? activeSet(lower, opt.value) : false;
    return `
      <button type="button" class="filter-option${active ? " active" : ""}" data-action="${action}" data-value="${escape(opt.value)}">
        <span class="filter-option-label">${escape(opt.value)}</span>
        <span class="filter-option-count">${opt.count}</span>
      </button>`;
  }).join("");

  const toggle = options.length > FACET_INITIAL_LIMIT
    ? `<button type="button" class="filter-group-toggle" data-action="toggle-facet" data-facet="${key}">${expanded ? "Show less" : `Show ${remainder} more`}</button>`
    : "";

  return `
    <div class="filter-group">
      <div class="filter-group-name">${label}</div>
      ${items}
      ${toggle}
    </div>`;
}

function renderFilterRail() {
  const wrap = $("#filter-groups");
  if (!wrap) return;
  const html = [
    renderFilterGroup(
      "Topic",
      "topics",
      storeFacets.topics || [],
      (lower) => storeFilters.topics.has(lower),
      "toggle-topic",
    ),
    renderFilterGroup(
      "Language",
      "languages",
      storeFacets.languages || [],
      (_, raw) => storeFilters.language === raw,
      "set-language",
    ),
    renderFilterGroup(
      "Author",
      "owners",
      storeFacets.owners || [],
      (_, raw) => storeFilters.owner.toLowerCase() === raw.toLowerCase(),
      "set-owner",
    ),
    renderFilterGroup(
      "License",
      "licenses",
      storeFacets.licenses || [],
      (_, raw) => storeFilters.license === raw,
      "set-license",
    ),
  ].join("");
  wrap.innerHTML = html;

  const clear = $("#clear-filters");
  if (clear) clear.hidden = activeFilterCount() === 0;
}

function renderResultCount(total) {
  const el = $("#store-result-count");
  if (!el) return;
  if (total == null) { el.textContent = ""; return; }
  el.textContent = `${total} result${total === 1 ? "" : "s"}`;
}

// --- Page loaders ---

const loaded = {};

const loaders = {
  async project() {
    const header = $("#project-header");
    html(header, '<div class="loading">Loading project</div>');
    const info = await api("/project");
    if (info?.error) {
      html(header, renderError(typeof info.error === "string" ? info.error : JSON.stringify(info.error)));
      return;
    }
    renderProject(info);
  },

  async store() {
    const grid = $("#store-grid");
    html(grid, '<div class="loading">Loading packages from GitHub</div>');
    renderActiveFilters();
    renderResultCount(null);
    await refreshInstalled();
    const data = await api(buildStoreUrl());
    if (data?.error) {
      storeFacets = { topics: [], languages: [], owners: [], licenses: [] };
      renderFilterRail();
      html(grid, renderError(data.error));
      return;
    }
    const items = data?.items || [];
    storeFacets = data?.facets || { topics: [], languages: [], owners: [], licenses: [] };
    renderFilterRail();
    renderActiveFilters();
    renderResultCount(typeof data?.total === "number" ? data.total : items.length);
    if (items.length === 0) {
      html(grid, renderEmpty("No packages match these filters. Try removing one or clearing all."));
    } else {
      html(grid, items.map(renderStoreCard).join(""));
    }
  },

  async installed() {
    if (loaded.installed) return;
    const [info, plugins, templates] = await Promise.all([
      api("/introspect"),
      refreshInstalled(),
      api("/templates"),
    ]);

    const grid = $("#stats-grid");
    const cmds = Array.isArray(info?.commands) ? info.commands : [];
    const pluginList = Array.isArray(plugins) ? plugins : [];
    const templateList = Array.isArray(templates) ? templates : [];
    const topLevel = cmds.length;
    const subCmds = cmds.reduce((n, c) => n + (c.subcommands?.length || 0), 0);

    html(grid, `
      <div class="stat-card"><div class="stat-value">${pluginList.length}</div><div class="stat-label">Plugins</div></div>
      <div class="stat-card"><div class="stat-value">${templateList.length}</div><div class="stat-label">Templates</div></div>
      <div class="stat-card"><div class="stat-value">${topLevel}</div><div class="stat-label">Commands</div></div>
      <div class="stat-card"><div class="stat-value">${subCmds}</div><div class="stat-label">Subcommands</div></div>`);

    const pluginsList = $("#installed-plugins-list");
    if (pluginList.length === 0) {
      html(pluginsList, renderEmpty('No plugins installed. Run <code>fledge plugins install --defaults</code>'));
    } else {
      html(pluginsList, pluginList.map((p) => `
        <div class="item-card">
          <div class="item-name">${escape(p.name)}</div>
          <div class="item-desc">${escape(p.source || "")}</div>
          <div class="item-meta">
            ${trustBadge(p.source, p.trust_tier)}
            ${p.version ? `<span class="badge badge-version">v${escape(p.version)}</span>` : ""}
            ${(p.commands || []).map((c) => `<span class="badge badge-command">${escape(c)}</span>`).join("")}
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-outline" data-action="update" data-name="${escape(p.name)}">Update</button>
            <button class="btn btn-sm btn-danger" data-action="remove" data-name="${escape(p.name)}">Remove</button>
          </div>
        </div>`).join(""));
    }

    const templatesList = $("#installed-templates-list");
    if (templateList.length === 0) {
      html(templatesList, renderEmpty("No templates found"));
    } else {
      html(templatesList, templateList.map((t) => `
        <div class="item-card">
          <div class="item-name">${escape(t.name || t.full_name || "unknown")}</div>
          <div class="item-desc">${escape(t.description || "")}</div>
          <div class="item-meta">
            ${t.language ? `<span class="badge badge-command">${escape(t.language)}</span>` : ""}
            ${t.stars != null ? `<span class="badge badge-version">${t.stars} stars</span>` : ""}
          </div>
        </div>`).join(""));
    }

    const tree = $("#command-tree");
    if (cmds.length === 0) {
      html(tree, renderEmpty("No commands found. Is fledge installed?"));
    } else {
      html(tree, cmds.map((cmd) => `
        <div class="cmd-group">
          <div class="cmd-group-name">fledge ${escape(cmd.name)}</div>
          ${cmd.about ? `<div class="cmd-item">${escape(cmd.about)}</div>` : ""}
          ${(cmd.subcommands || []).map((sub) =>
            `<div class="cmd-item"><span>${escape(sub.name)}</span> ${sub.about ? "— " + escape(sub.about) : ""}</div>`
          ).join("")}
        </div>`).join(""));
    }

    loaded.installed = true;
  },

  async lanes() {
    if (loaded.lanes) return;
    const data = await api("/lanes");
    const list = $("#lanes-list");

    if (data?.error) {
      html(list, renderError(typeof data.error === "string" ? data.error : JSON.stringify(data.error)));
      return;
    }

    const lanes = Array.isArray(data) ? data : [];
    if (lanes.length === 0) {
      html(list, renderEmpty('No lanes defined. Add lanes to your <code>fledge.toml</code>'));
    } else {
      html(list, lanes.map((l) => {
        const stepCount = typeof l.step_count === "number" ? l.step_count : (typeof l.steps === "number" ? l.steps : null);
        return `
          <div class="lane-card">
            <div class="lane-name">${escape(l.name)}</div>
            ${l.description ? `<div class="lane-desc">${escape(l.description)}</div>` : ""}
            <div class="lane-meta">
              ${stepCount != null ? `<span class="badge badge-version">${stepCount} step${stepCount === 1 ? "" : "s"}</span>` : ""}
              ${l.fail_fast ? '<span class="badge badge-team">fail-fast</span>' : ""}
              ${l.trust_tier ? `<span class="badge badge-command">${escape(l.trust_tier)}</span>` : ""}
            </div>
          </div>`;
      }).join(""));
    }
    loaded.lanes = true;
  },

  async config() {
    if (loaded.config) return;
    const data = await api("/config");
    const list = $("#config-list");

    if (data?.error) {
      html(list, renderError(typeof data.error === "string" ? data.error : JSON.stringify(data.error)));
      return;
    }

    const sections = Array.isArray(data?.sections) ? data.sections : [];
    const total = sections.reduce((n, s) => n + (s.entries?.length || 0), 0);

    if (total === 0) {
      html(list, renderEmpty("No config entries found"));
    } else {
      const path = data?.path ? `<div class="config-path">${escape(data.path)}</div>` : "";
      html(list, `${path}${sections.map((s) => `
        <div class="config-section">
          <h3 class="config-section-name">${escape(s.name)}</h3>
          <div class="config-entries">
            ${(s.entries || []).map((e) => `
              <div class="config-entry${e.unset ? " config-entry-unset" : ""}">
                <span class="config-key">${escape(e.key)}</span>
                <span class="config-value">${escape(e.value)}</span>
                ${e.help ? `<span class="config-help">${escape(e.help)}</span>` : ""}
              </div>`).join("")}
          </div>
        </div>`).join("")}`);
    }
    loaded.config = true;
  },

  async doctor() {
    const wrap = $("#doctor-output");
    html(wrap, '<div class="loading">Running doctor</div>');
    const data = await api("/doctor");
    if (data?.error) {
      html(wrap, renderError(typeof data.error === "string" ? data.error : JSON.stringify(data.error)));
      return;
    }
    const report = data?.report;
    if (!report || !Array.isArray(report.sections)) {
      const raw = data?.raw || JSON.stringify(data, null, 2);
      html(wrap, `<pre class="terminal-output">${escape(raw)}</pre>`);
      return;
    }
    html(wrap, renderDoctor(report));
  },
};

// --- Command palette ---

const cmdPages = [
  { label: "Overview", page: "project", hint: "Project" },
  { label: "Store", page: "store", hint: "Browse packages" },
  { label: "Installed", page: "installed", hint: "Plugins & templates" },
  { label: "Lanes", page: "lanes", hint: "Workflow pipelines" },
  { label: "Config", page: "config", hint: "Global config" },
  { label: "Doctor", page: "doctor", hint: "Diagnostics" },
];

let cmdActiveIndex = 0;

function openCmdPalette() {
  const palette = $("#cmd-palette");
  palette.classList.remove("hidden");
  const input = $("#cmd-input");
  input.value = "";
  input.focus();
  renderCmdResults("");
}

function closeCmdPalette() {
  $("#cmd-palette").classList.add("hidden");
}

function renderCmdResults(query) {
  const results = $("#cmd-results");
  const q = query.toLowerCase().trim();

  let items = cmdPages;
  if (q) {
    items = cmdPages.filter(
      (p) => p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q)
    );
  }

  // Add installed plugins to results
  for (const [name] of installedByName) {
    if (!q || name.toLowerCase().includes(q)) {
      items.push({ label: name, page: "installed", hint: "Installed plugin" });
    }
  }

  if (items.length === 0) {
    results.innerHTML = '<div class="cmd-result" style="color:var(--text-faint)">No results</div>';
    cmdActiveIndex = -1;
    return;
  }

  cmdActiveIndex = 0;
  results.innerHTML = items
    .slice(0, 8)
    .map((item, i) => `
      <div class="cmd-result${i === 0 ? " active" : ""}" data-page="${item.page}" data-index="${i}">
        <span class="cmd-result-label">${escape(item.label)}</span>
        <span class="cmd-result-hint">${escape(item.hint)}</span>
      </div>`)
    .join("");
}

function cmdSelectActive() {
  const active = $(".cmd-result.active");
  if (!active) return;
  const page = active.dataset.page;
  closeCmdPalette();
  if (page) navigate(page);
}

function cmdMove(delta) {
  const items = $$(".cmd-result");
  if (items.length === 0) return;
  items[cmdActiveIndex]?.classList.remove("active");
  cmdActiveIndex = (cmdActiveIndex + delta + items.length) % items.length;
  items[cmdActiveIndex]?.classList.add("active");
  items[cmdActiveIndex]?.scrollIntoView({ block: "nearest" });
}

// --- Event delegation ---

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "install") installRepo(btn.dataset.source, btn);
  else if (action === "remove") removePlugin(btn.dataset.name, btn);
  else if (action === "update") updatePlugin(btn.dataset.name, btn);
  else if (action === "readme") showReadme(btn.dataset.owner, btn.dataset.repo);
  else if (action === "run-task") runTask(btn.dataset.name, btn);
  else if (action === "run-lane") runLane(btn.dataset.name, btn);
  else if (action === "open-repo") openRepo();
  else if (action === "close-output") $("#run-output-card")?.classList.add("hidden");
  else if (action === "toggle-topic") toggleTopic(btn.dataset.value);
  else if (action === "set-language") setSingleFilter("language", btn.dataset.value);
  else if (action === "set-owner") setSingleFilter("owner", btn.dataset.value);
  else if (action === "set-license") setSingleFilter("license", btn.dataset.value);
  else if (action === "clear-q") {
    storeFilters.q = "";
    const search = $("#store-search");
    if (search) search.value = "";
    loaders.store();
  }
  else if (action === "toggle-facet") {
    const key = btn.dataset.facet;
    if (key && key in facetExpanded) {
      facetExpanded[key] = !facetExpanded[key];
      renderFilterRail();
    }
  }
});

// Nav links
$$(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

// Category tabs
$$(".category-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".category-tabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    storeFilters.category = tab.dataset.category;
    loaders.store();
  });
});

// Section tabs
$$(".section-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".section-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".installed-section").forEach((s) => s.classList.remove("active"));
    $(`#installed-${tab.dataset.section}`)?.classList.add("active");
  });
});

// Store search — debounced live filter; Enter forces an immediate run.
let searchDebounce = null;

function commitStoreSearch() {
  const next = $("#store-search").value.trim();
  if (next === storeFilters.q) return;
  storeFilters.q = next;
  loaders.store();
}

$("#store-search").addEventListener("input", () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(commitStoreSearch, 300);
});

$("#store-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (searchDebounce) clearTimeout(searchDebounce);
    commitStoreSearch();
  } else if (e.key === "Escape" && $("#store-search").value) {
    $("#store-search").value = "";
    if (searchDebounce) clearTimeout(searchDebounce);
    commitStoreSearch();
  }
});

$("#clear-filters")?.addEventListener("click", () => clearStoreFilters());

// Modal close
$(".modal-backdrop")?.addEventListener("click", () => {
  $("#readme-modal")?.classList.add("hidden");
});

$(".modal-close")?.addEventListener("click", () => {
  $("#readme-modal")?.classList.add("hidden");
});

// Command palette
$(".cmd-palette-backdrop")?.addEventListener("click", closeCmdPalette);

$("#cmd-input")?.addEventListener("input", (e) => {
  renderCmdResults(e.target.value);
});

$("#cmd-input")?.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); cmdMove(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); cmdMove(-1); }
  else if (e.key === "Enter") { e.preventDefault(); cmdSelectActive(); }
  else if (e.key === "Escape") { closeCmdPalette(); }
});

$("#cmd-results")?.addEventListener("click", (e) => {
  const item = e.target.closest(".cmd-result");
  if (item?.dataset.page) {
    closeCmdPalette();
    navigate(item.dataset.page);
  }
});

// Keyboard shortcut: Cmd+K / Ctrl+K
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    const palette = $("#cmd-palette");
    if (palette.classList.contains("hidden")) {
      openCmdPalette();
    } else {
      closeCmdPalette();
    }
  }

  if (e.key === "Escape") {
    if (!$("#readme-modal").classList.contains("hidden")) {
      $("#readme-modal").classList.add("hidden");
    }
  }
});

// --- Init ---

(async () => {
  const info = await api("/info");
  if (info?.version) {
    $("#fledge-version").textContent = info.version;
  }
  if (info?.hubVersion) {
    $("#hub-version").textContent = `v${info.hubVersion}`;
  }
  navigate("project");
})();
