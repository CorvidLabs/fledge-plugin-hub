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

function html(el, content) {
  el.innerHTML = content;
}

function renderError(msg) {
  return `<div class="error-msg">${escape(msg)}</div>`;
}

function renderEmpty(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

function escape(s) {
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

const loaded = {};

const loaders = {
  async overview() {
    if (loaded.overview) return;
    const [info, plugins] = await Promise.all([
      api("/introspect"),
      api("/plugins"),
    ]);

    const grid = $("#stats-grid");
    const cmds = Array.isArray(info?.commands) ? info.commands : [];
    const pluginList = Array.isArray(plugins) ? plugins : [];

    const topLevel = cmds.length;
    const subCmds = cmds.reduce(
      (n, c) => n + (c.subcommands?.length || 0),
      0
    );

    html(
      grid,
      `
      <div class="stat-card"><div class="stat-value">${topLevel}</div><div class="stat-label">Commands</div></div>
      <div class="stat-card"><div class="stat-value">${subCmds}</div><div class="stat-label">Subcommands</div></div>
      <div class="stat-card"><div class="stat-value">${pluginList.length}</div><div class="stat-label">Plugins</div></div>
    `
    );

    const tree = $("#command-tree");
    if (cmds.length === 0) {
      html(tree, renderEmpty("No commands found. Is fledge installed?"));
    } else {
      html(
        tree,
        cmds
          .map(
            (cmd) => `
        <div class="cmd-group">
          <div class="cmd-group-name">fledge ${escape(cmd.name)}</div>
          ${
            cmd.about
              ? `<div class="cmd-item">${escape(cmd.about)}</div>`
              : ""
          }
          ${(cmd.subcommands || []).map((sub) => `<div class="cmd-item"><span>${escape(sub.name)}</span> ${sub.about ? "— " + escape(sub.about) : ""}</div>`).join("")}
        </div>
      `
          )
          .join("")
      );
    }

    loaded.overview = true;
  },

  async plugins() {
    if (loaded.plugins) return;
    const data = await api("/plugins");
    const list = $("#plugins-list");

    if (data?.error) {
      html(list, renderError(data.error));
      return;
    }

    const plugins = Array.isArray(data) ? data : [];
    if (plugins.length === 0) {
      html(
        list,
        renderEmpty(
          "No plugins installed. Run <code>fledge plugins install --defaults</code>"
        )
      );
    } else {
      html(
        list,
        plugins
          .map(
            (p) => `
        <div class="item-card">
          <div class="item-name">${escape(p.name)}</div>
          <div class="item-desc">${escape(p.description || "")}</div>
          <div class="item-meta">
            ${trustBadge(p.source)}
            ${p.version ? `<span class="badge badge-version">v${escape(p.version)}</span>` : ""}
            ${(p.commands || []).map((c) => `<span class="badge badge-command">${escape(c)}</span>`).join("")}
          </div>
        </div>
      `
          )
          .join("")
      );
    }

    loaded.plugins = true;
  },

  async templates() {
    if (loaded.templates) return;
    const data = await api("/templates");
    const list = $("#templates-list");

    if (data?.error) {
      html(list, renderError(data.error));
      return;
    }

    const templates = Array.isArray(data) ? data : [];
    if (templates.length === 0) {
      html(list, renderEmpty("No templates found"));
    } else {
      html(
        list,
        templates
          .map(
            (t) => `
        <div class="item-card">
          <div class="item-name">${escape(t.name || t.full_name || "unknown")}</div>
          <div class="item-desc">${escape(t.description || "")}</div>
          <div class="item-meta">
            ${t.language ? `<span class="badge badge-command">${escape(t.language)}</span>` : ""}
            ${t.stars != null ? `<span class="badge badge-version">${t.stars} stars</span>` : ""}
          </div>
        </div>
      `
          )
          .join("")
      );
    }

    loaded.templates = true;
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
      html(
        list,
        renderEmpty(
          "No lanes defined. Add lanes to your <code>fledge.toml</code>"
        )
      );
    } else {
      html(
        list,
        lanes
          .map(
            (l) => `
        <div class="lane-card">
          <div class="lane-name">${escape(l.name)}</div>
          <div class="lane-steps">
            ${(Array.isArray(l.steps) ? l.steps : [])
              .map(
                (s, i) =>
                  `${i > 0 ? '<span class="lane-step-arrow">&rarr;</span>' : ""}<span class="lane-step">${escape(typeof s === "string" ? s : s.name || JSON.stringify(s))}</span>`
              )
              .join("")}
          </div>
        </div>
      `
          )
          .join("")
      );
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

    const entries =
      typeof data === "object" && !Array.isArray(data)
        ? Object.entries(data)
        : [];

    if (entries.length === 0) {
      html(list, renderEmpty("No config entries found"));
    } else {
      html(
        list,
        entries
          .map(
            ([k, v]) => `
        <div class="config-entry">
          <span class="config-key">${escape(k)}</span>
          <span class="config-value">${escape(typeof v === "string" ? v : JSON.stringify(v))}</span>
        </div>
      `
          )
          .join("")
      );
    }

    loaded.config = true;
  },

  async doctor() {
    const data = await api("/doctor");
    const output = $("#doctor-output");
    output.textContent = data?.output || data?.error || "No output";
  },
};

$$(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

$("#plugin-search-btn").addEventListener("click", async () => {
  const q = $("#plugin-search").value.trim();
  if (!q) return;
  const card = $("#plugin-search-results-card");
  const results = $("#plugin-search-results");
  card.style.display = "block";
  html(results, '<div class="loading">Searching...</div>');
  const data = await api(`/plugins/search?q=${encodeURIComponent(q)}`);
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) {
    html(results, renderEmpty("No plugins found"));
  } else {
    html(
      results,
      items
        .map(
          (p) => `
      <div class="item-card">
        <div class="item-name">${escape(p.full_name || p.name || "unknown")}</div>
        <div class="item-desc">${escape(p.description || "")}</div>
        <div class="item-meta">
          ${trustBadge(p.full_name || p.source)}
          ${p.stars != null ? `<span class="badge badge-version">${p.stars} stars</span>` : ""}
        </div>
      </div>
    `
        )
        .join("")
    );
  }
});

$("#plugin-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#plugin-search-btn").click();
});

(async () => {
  const info = await api("/info");
  if (info?.version) {
    $("#fledge-version").textContent = info.version;
  }
  navigate("overview");
})();
