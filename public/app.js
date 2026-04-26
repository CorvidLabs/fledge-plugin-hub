const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function api(path) {
  try {
    const res = await fetch(`/api${path}`);
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
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
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function trustBadge(source) {
  if (!source) return "";
  const lower = source.toLowerCase();
  if (lower.startsWith("corvidlabs/"))
    return '<span class="badge badge-official">official</span>';
  return '<span class="badge badge-unverified">community</span>';
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

function showInstallPopup(fullName) {
  let popup = $("#install-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "install-popup";
    popup.className = "install-popup";
    document.body.appendChild(popup);
  }
  const cmd = `fledge plugins install ${fullName}`;
  popup.innerHTML = `
    <code>${escape(cmd)}</code>
    <button class="btn btn-sm" onclick="copyCmd('${escape(cmd)}')">Copy</button>
    <button class="btn btn-sm btn-outline" onclick="this.parentElement.classList.add('hidden')">Dismiss</button>
  `;
  popup.classList.remove("hidden");
  setTimeout(() => popup.classList.add("hidden"), 8000);
}

function copyCmd(text) {
  navigator.clipboard.writeText(text).then(() => {
    const popup = $("#install-popup");
    if (popup) {
      popup.querySelector(".btn").textContent = "Copied!";
      setTimeout(() => popup.classList.add("hidden"), 1500);
    }
  });
}

function renderStoreCard(repo) {
  const owner = escape(repo.owner?.login || "");
  const isOfficial = owner.toLowerCase() === "corvidlabs";
  const topics = (repo.topics || []).slice(0, 5);

  return `
    <div class="store-card">
      <div class="store-card-header">
        <img class="store-card-avatar" src="${escape(repo.owner?.avatar_url || "")}" alt="${owner}" loading="lazy">
        <div class="store-card-title">
          <div class="store-card-name">
            <a href="${escape(repo.html_url)}" target="_blank" rel="noopener">${escape(repo.name)}</a>
          </div>
          <div class="store-card-author">${owner} ${isOfficial ? '<span class="badge badge-official">official</span>' : ""}</div>
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
          <button class="btn btn-sm btn-outline" onclick="showReadme('${escape(repo.owner?.login)}', '${escape(repo.name)}')">README</button>
          <button class="btn btn-sm" onclick="showInstallPopup('${escape(repo.full_name)}')">Install</button>
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

const loaders = {
  async store() {
    const grid = $("#store-grid");
    html(grid, '<div class="loading">Loading packages from GitHub...</div>');
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
      api("/plugins"),
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
          <div class="item-desc">${escape(p.description || "")}</div>
          <div class="item-meta">
            ${trustBadge(p.source)}
            ${p.version ? `<span class="badge badge-version">v${escape(p.version)}</span>` : ""}
            ${(p.commands || []).map((c) => `<span class="badge badge-command">${escape(c)}</span>`).join("")}
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
    const data = await api("/doctor");
    const output = $("#doctor-output");
    output.textContent = data?.output || data?.error || "No output";
  },
};

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
  navigate("store");
})();
