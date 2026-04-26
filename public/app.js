const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

function navigate(page) {
  $$(".page").forEach((p) => p.classList.remove("active"));
  $$(".nav-link").forEach((l) => l.classList.remove("active"));
  $(`#page-${page}`)?.classList.add("active");
  $(`.nav-link[data-page="${page}"]`)?.classList.add("active");
  loaders[page]?.();
}

function html(el, content) { el.innerHTML = content; }

function renderError(msg) {
  return `<div class="error-msg">${escape(msg)}</div>`;
}

function renderEmpty(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

function escape(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

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

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// --- Toast ---
let toastTimer = null;
function showToast(message, kind = "info", durationMs = 3500) {
  let toast = $("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
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

function hideToast() {
  $("#toast")?.classList.add("hidden");
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

// --- Installed plugins state ---
// Map: lowercased "owner/repo" → installed plugin object (from `fledge plugins list`).
let installedBySource = new Map();
// Map: plugin name → installed plugin object
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
    showToast(`Install failed: ${truncate(result?.error || "unknown error", 200)}`, "error", 6000);
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
    showToast(`Remove failed: ${truncate(result?.error || "unknown error", 200)}`, "error", 6000);
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
    showToast(`Update failed: ${truncate(result?.error || "unknown error", 200)}`, "error", 6000);
    if (btn) { btn.disabled = false; btn.textContent = "Update"; }
  }
}

function truncate(s, n) {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
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

function renderStoreCard(repo) {
  const owner = escape(repo.owner?.login || "");
  const isOfficial = (repo.owner?.login || "").toLowerCase() === "corvidlabs";
  const topics = (repo.topics || []).slice(0, 5);
  const installed = isInstalled(repo.full_name);
  const fullEsc = escape(repo.full_name || "");
  const installedPlugin = installedBySource.get((repo.full_name || "").toLowerCase());

  const actions = installed
    ? `
        <button class="btn btn-sm btn-outline" data-action="readme" data-owner="${escape(repo.owner?.login)}" data-repo="${escape(repo.name)}">README</button>
        <button class="btn btn-sm btn-outline" data-action="update" data-name="${escape(installedPlugin?.name || repo.name)}">Update</button>
        <button class="btn btn-sm btn-danger" data-action="remove" data-name="${escape(installedPlugin?.name || repo.name)}">Remove</button>
      `
    : `
        <button class="btn btn-sm btn-outline" data-action="readme" data-owner="${escape(repo.owner?.login)}" data-repo="${escape(repo.name)}">README</button>
        <button class="btn btn-sm" data-action="install" data-source="${fullEsc}">Install</button>
      `;

  return `
    <div class="store-card${installed ? " store-card-installed" : ""}">
      <div class="store-card-header">
        <img class="store-card-avatar" src="${escape(repo.owner?.avatar_url || "")}" alt="${owner}" loading="lazy">
        <div class="store-card-title">
          <div class="store-card-name">
            <a href="${escape(repo.html_url)}" target="_blank" rel="noopener">${escape(repo.name)}</a>
          </div>
          <div class="store-card-author">
            ${owner}
            ${isOfficial ? '<span class="badge badge-official">official</span>' : ""}
            ${installed ? '<span class="badge badge-installed">installed</span>' : ""}
          </div>
        </div>
      </div>
      <div class="store-card-desc">${escape(repo.description || "No description")}</div>
      <div class="store-card-topics">
        ${typeBadge(repo.topics)}
        ${topics.filter(t => t !== "fledge-plugin" && t !== "fledge-template").map((t) => `<span class="topic-tag">${escape(t)}</span>`).join("")}
      </div>
      <div class="store-card-footer">
        <div class="store-card-stats">
          <span class="store-card-stat">${repo.stargazers_count || 0} stars</span>
          ${repo.language ? `<span class="store-card-stat">${escape(repo.language)}</span>` : ""}
          <span class="store-card-stat">${timeAgo(repo.updated_at)}</span>
        </div>
        <div class="store-card-actions">
          ${actions}
        </div>
      </div>
    </div>
  `;
}

async function showReadme(owner, repo) {
  const modal = $("#readme-modal");
  const title = $("#readme-title");
  const body = $("#readme-body");
  title.textContent = `${owner}/${repo}`;
  body.textContent = "Loading...";
  modal.classList.remove("hidden");
  const data = await api(`/github/readme/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  body.textContent = data?.content || data?.error || "No README found";
}

let currentCategory = "all";
let currentSearch = "";

const loaded = {};

function statusDot(status) {
  const s = String(status || "").toLowerCase();
  const cls = s === "ok" ? "status-ok" : s === "warn" ? "status-warn" : s === "fail" ? "status-fail" : "";
  return `<span class="status-dot ${cls}"></span>`;
}

function renderProject(info) {
  const header = $("#project-header");
  const content = $("#project-content");

  const headerHtml = `
    <div class="project-header">
      <div class="project-header-main">
        <h1>${escape(info.name || "Project")}</h1>
        <div class="project-header-meta">
          ${info.version ? `<span class="badge badge-version">v${escape(info.version)}</span>` : ""}
          ${info.branch ? `<span class="badge badge-team">${escape(info.branch)}</span>` : ""}
          ${(info.languages || []).map((l) => `<span class="badge badge-command">${escape(l)}</span>`).join("")}
        </div>
        <div class="project-header-cwd">${escape(info.cwd || "")}</div>
      </div>
      <div class="project-header-actions">
        ${info.remoteUrl ? `<button class="btn btn-outline" data-action="open-repo">Open repo</button>` : ""}
      </div>
    </div>
  `;
  html(header, headerHtml);

  const healthHtml = `
    <div class="card">
      <h2>Health</h2>
      <div class="health-list">
        ${(info.health || []).map((h) => `
          <div class="health-item">
            ${statusDot(h.status)}
            <span class="health-name">${escape(h.name)}</span>
            <span class="health-detail">${escape(h.detail || "")}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const tasksHtml = info.hasFledgeToml ? `
    <div class="card">
      <h2>Tasks</h2>
      ${info.tasks.length === 0 ? renderEmpty("No tasks defined in fledge.toml") : `
        <div class="run-list">
          ${info.tasks.map((t) => `
            <div class="run-item">
              <div class="run-item-body">
                <div class="run-item-name">${escape(t.name)}</div>
                ${t.description ? `<div class="run-item-desc">${escape(t.description)}</div>` : ""}
                ${t.cmd ? `<div class="run-item-cmd"><code>${escape(t.cmd)}</code></div>` : ""}
              </div>
              <button class="btn btn-sm" data-action="run-task" data-name="${escape(t.name)}">Run</button>
            </div>
          `).join("")}
        </div>
      `}
    </div>
  ` : "";

  const lanesHtml = info.hasFledgeToml ? `
    <div class="card">
      <h2>Lanes</h2>
      ${info.lanes.length === 0 ? renderEmpty("No lanes defined") : `
        <div class="run-list">
          ${info.lanes.map((l) => `
            <div class="run-item">
              <div class="run-item-body">
                <div class="run-item-name">${escape(l.name)}</div>
                ${l.description ? `<div class="run-item-desc">${escape(l.description)}</div>` : ""}
                <div class="run-item-meta">
                  ${l.steps != null ? `<span class="badge badge-version">${l.steps} steps</span>` : ""}
                  ${l.fail_fast ? `<span class="badge badge-team">fail-fast</span>` : ""}
                </div>
              </div>
              <button class="btn btn-sm" data-action="run-lane" data-name="${escape(l.name)}">Run</button>
            </div>
          `).join("")}
        </div>
      `}
    </div>
  ` : "";

  const commitsHtml = info.isGit && info.commits.length > 0 ? `
    <div class="card">
      <h2>Recent commits</h2>
      <div class="commits-list">
        ${info.commits.slice(0, 10).map((c) => `
          <div class="commit-row">
            <span class="commit-hash">${escape(c.hash)}</span>
            <span class="commit-subject">${escape(c.subject)}</span>
            <span class="commit-meta">${escape(c.author)} · ${escape(c.date)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const workingTreeHtml = info.isGit && info.workingTree.length > 0 ? `
    <div class="card">
      <h2>Working tree (${info.workingTree.length})</h2>
      <pre class="terminal-output">${escape(info.workingTree.join("\n"))}</pre>
    </div>
  ` : "";

  const tagsHtml = info.tags.length > 0 ? `
    <div class="card">
      <h2>Recent tags</h2>
      <div class="tag-list">
        ${info.tags.map((t) => `<span class="badge badge-version">${escape(t)}</span>`).join("")}
      </div>
    </div>
  ` : "";

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
    ${tagsHtml}
  `);
}

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

const loaders = {
  async project() {
    const header = $("#project-header");
    html(header, '<div class="loading">Loading project…</div>');
    const info = await api("/project");
    if (info?.error) {
      html(header, renderError(typeof info.error === "string" ? info.error : JSON.stringify(info.error)));
      return;
    }
    renderProject(info);
  },

  async store() {
    const grid = $("#store-grid");
    html(grid, '<div class="loading">Loading packages from GitHub...</div>');
    // Always refresh installed list so the badges are current.
    await refreshInstalled();
    const params = new URLSearchParams({ category: currentCategory });
    if (currentSearch) params.set("q", currentSearch);
    const data = await api(`/github/browse?${params}`);
    if (data?.error) {
      html(grid, renderError(data.error));
      return;
    }
    const items = data?.items || [];
    if (items.length === 0) {
      html(grid, renderEmpty("No packages found. Try a different search or category."));
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
      <div class="stat-card"><div class="stat-value">${subCmds}</div><div class="stat-label">Subcommands</div></div>
    `);

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
        </div>
      `).join(""));
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
        </div>
      `).join(""));
    }

    const tree = $("#command-tree");
    if (cmds.length === 0) {
      html(tree, renderEmpty("No commands found. Is fledge installed?"));
    } else {
      html(tree, cmds.map((cmd) => `
        <div class="cmd-group">
          <div class="cmd-group-name">fledge ${escape(cmd.name)}</div>
          ${cmd.about ? `<div class="cmd-item">${escape(cmd.about)}</div>` : ""}
          ${(cmd.subcommands || []).map((sub) => `<div class="cmd-item"><span>${escape(sub.name)}</span> ${sub.about ? "— " + escape(sub.about) : ""}</div>`).join("")}
        </div>
      `).join(""));
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

    const lanes = Array.isArray(data)
      ? data
      : typeof data === "object"
        ? Object.entries(data).map(([name, steps]) => ({ name, steps }))
        : [];

    if (lanes.length === 0) {
      html(list, renderEmpty('No lanes defined. Add lanes to your <code>fledge.toml</code>'));
    } else {
      html(list, lanes.map((l) => `
        <div class="lane-card">
          <div class="lane-name">${escape(l.name)}</div>
          <div class="lane-steps">
            ${(Array.isArray(l.steps) ? l.steps : [])
              .map((s, i) => `${i > 0 ? '<span class="lane-step-arrow">&rarr;</span>' : ""}<span class="lane-step">${escape(typeof s === "string" ? s : s.name || JSON.stringify(s))}</span>`)
              .join("")}
          </div>
        </div>
      `).join(""));
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

    const entries = typeof data === "object" && !Array.isArray(data) ? Object.entries(data) : [];

    if (entries.length === 0) {
      html(list, renderEmpty("No config entries found"));
    } else {
      html(list, entries.map(([k, v]) => `
        <div class="config-entry">
          <span class="config-key">${escape(k)}</span>
          <span class="config-value">${escape(typeof v === "string" ? v : JSON.stringify(v))}</span>
        </div>
      `).join(""));
    }

    loaded.config = true;
  },

  async doctor() {
    const wrap = $("#doctor-output");
    html(wrap, '<div class="loading">Running doctor…</div>');
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

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "ok" || s === "pass") return `<span class="status-pill status-ok">OK</span>`;
  if (s === "warn" || s === "warning") return `<span class="status-pill status-warn">WARN</span>`;
  if (s === "fail" || s === "error") return `<span class="status-pill status-fail">FAIL</span>`;
  if (s === "skip" || s === "skipped") return `<span class="status-pill status-skip">SKIP</span>`;
  return `<span class="status-pill">${escape(status || "?")}</span>`;
}

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
    </div>
  `;
  const sections = (report.sections || []).map((sec) => {
    const checks = (sec.checks || []).map((chk) => `
      <div class="doctor-check">
        <div class="doctor-check-status">${statusBadge(chk.status)}</div>
        <div class="doctor-check-body">
          <div class="doctor-check-name">
            ${escape(chk.name)}
            ${chk.version ? `<span class="badge badge-version">${escape(chk.version)}</span>` : ""}
          </div>
          ${chk.detail ? `<div class="doctor-check-detail">${escape(chk.detail)}</div>` : ""}
          ${chk.fix ? `<div class="doctor-check-fix"><strong>Fix:</strong> ${escape(chk.fix)}</div>` : ""}
        </div>
      </div>
    `).join("");
    return `
      <div class="doctor-section">
        <h3 class="doctor-section-name">${escape(sec.name)}</h3>
        <div class="doctor-checks">${checks}</div>
      </div>
    `;
  }).join("");
  return `${summary}${sections}`;
}

// --- Event delegation for action buttons ---
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "install") {
    installRepo(btn.dataset.source, btn);
  } else if (action === "remove") {
    removePlugin(btn.dataset.name, btn);
  } else if (action === "update") {
    updatePlugin(btn.dataset.name, btn);
  } else if (action === "readme") {
    showReadme(btn.dataset.owner, btn.dataset.repo);
  } else if (action === "run-task") {
    runTask(btn.dataset.name, btn);
  } else if (action === "run-lane") {
    runLane(btn.dataset.name, btn);
  } else if (action === "open-repo") {
    openRepo();
  } else if (action === "close-output") {
    $("#run-output-card")?.classList.add("hidden");
  }
});

// Nav links
$$(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

// Category tabs (store)
$$(".category-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".category-tabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.category;
    loaders.store();
  });
});

// Section tabs (installed)
$$(".section-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".section-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".installed-section").forEach((s) => s.classList.remove("active"));
    $(`#installed-${tab.dataset.section}`)?.classList.add("active");
  });
});

// Store search
$("#store-search-btn").addEventListener("click", () => {
  currentSearch = $("#store-search").value.trim();
  loaders.store();
});

$("#store-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    currentSearch = $("#store-search").value.trim();
    loaders.store();
  }
});

// Modal close
$(".modal-backdrop")?.addEventListener("click", () => {
  $("#readme-modal")?.classList.add("hidden");
});

$(".modal-close")?.addEventListener("click", () => {
  $("#readme-modal")?.classList.add("hidden");
});

// Init
(async () => {
  const info = await api("/info");
  if (info?.version) {
    $("#fledge-version").textContent = info.version;
  }
  navigate("project");
})();
