(function () {
  "use strict";

  const SCRIPT = document.currentScript;
  const TOKEN = SCRIPT && SCRIPT.getAttribute("data-id");
  const BASE = SCRIPT && SCRIPT.getAttribute("data-src")
    ? SCRIPT.getAttribute("data-src").replace(/\/widget\.js$/, "")
    : (SCRIPT ? new URL(SCRIPT.src).origin : "");

  if (!TOKEN) return console.warn("[changelog-widget] missing data-id");

  // ©¤©¤ Styles ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
  const CSS = `
    #clw-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9998;
      background: #0d0e11;
      border: 1px solid #252830;
      color: #d4d8e1;
      font-family: 'IBM Plex Mono', monospace, sans-serif;
      font-size: 12px;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      transition: border-color 0.2s;
    }
    #clw-btn:hover { border-color: #00e5a0; }
    #clw-dot {
      width: 7px; height: 7px;
      background: #00e5a0;
      border-radius: 50%;
      box-shadow: 0 0 8px #00e5a0;
      animation: clw-pulse 2.4s ease-in-out infinite;
    }
    @keyframes clw-pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50% { opacity:0.4; transform:scale(0.7); }
    }
    #clw-badge {
      background: #00e5a0;
      color: #0d0e11;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      display: none;
    }
    #clw-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 9999;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 24px;
    }
    #clw-overlay.open { display: flex; }
    #clw-panel {
      background: #13151a;
      border: 1px solid #252830;
      border-radius: 10px;
      width: 420px;
      max-width: calc(100vw - 48px);
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      font-family: 'IBM Plex Sans', sans-serif;
      overflow: hidden;
    }
    #clw-header {
      padding: 16px 20px;
      border-bottom: 1px solid #252830;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #clw-title {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
      font-weight: 600;
      color: #d4d8e1;
    }
    #clw-close {
      background: transparent;
      border: none;
      color: #6b7280;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 0 4px;
    }
    #clw-close:hover { color: #d4d8e1; }
    #clw-body {
      overflow-y: auto;
      padding: 16px 20px;
      flex: 1;
    }
    .clw-entry {
      padding: 16px 0;
      border-bottom: 1px solid #252830;
    }
    .clw-entry:last-child { border-bottom: none; }
    .clw-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .clw-type {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .clw-type-feature    { background: #00e5a022; color: #00e5a0; border: 1px solid #00e5a044; }
    .clw-type-improvement{ background: #4d9fff22; color: #4d9fff; border: 1px solid #4d9fff44; }
    .clw-type-fix        { background: #f5c54222; color: #f5c542; border: 1px solid #f5c54244; }
    .clw-type-security   { background: #ff4d6a22; color: #ff4d6a; border: 1px solid #ff4d6a44; }
    .clw-version {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      color: #6b7280;
    }
    .clw-date {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      color: #6b7280;
      margin-left: auto;
    }
    .clw-entry-title {
      font-size: 14px;
      font-weight: 600;
      color: #d4d8e1;
      margin-bottom: 6px;
    }
    .clw-entry-content {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    #clw-footer {
      padding: 12px 20px;
      border-top: 1px solid #252830;
      text-align: center;
    }
    #clw-footer a {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      color: #6b7280;
      text-decoration: none;
      letter-spacing: 0.06em;
    }
    #clw-footer a:hover { color: #00e5a0; }
    #clw-empty {
      text-align: center;
      padding: 40px 0;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      color: #6b7280;
    }
  `;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  // ©¤©¤ HTML ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
  document.body.insertAdjacentHTML("beforeend", `
    <button id="clw-btn">
      <span id="clw-dot"></span>
      What's new
      <span id="clw-badge"></span>
    </button>
    <div id="clw-overlay">
      <div id="clw-panel">
        <div id="clw-header">
          <span id="clw-title">Changelog</span>
          <button id="clw-close">¡Á</button>
        </div>
        <div id="clw-body">
          <div id="clw-empty">Loading...</div>
        </div>
        <div id="clw-footer">
          <a href="https://changeloghq.com?ref=widget" target="_blank">Powered by ChangelogHQ ¨J</a>
        </div>
      </div>
    </div>
  `);

  // ©¤©¤ Logic ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric"
    });
  }

  function open() {
    document.getElementById("clw-overlay").classList.add("open");
    document.getElementById("clw-badge").style.display = "none";
    localStorage.setItem("clw-last-seen", Date.now());
  }

  function close() {
    document.getElementById("clw-overlay").classList.remove("open");
  }

  document.getElementById("clw-btn").addEventListener("click", open);
  document.getElementById("clw-close").addEventListener("click", close);
  document.getElementById("clw-overlay").addEventListener("click", function (e) {
    if (e.target === this) close();
  });

  // ©¤©¤ Fetch entries ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
  fetch(`${BASE}/api/widget/${TOKEN}`)
    .then(r => r.json())
    .then(data => {
      const body = document.getElementById("clw-body");
      const title = document.getElementById("clw-title");
      const badge = document.getElementById("clw-badge");

      if (data.name) title.textContent = data.name + " ¡ª Changelog";

      if (!data.entries || !data.entries.length) {
        body.innerHTML = `<div id="clw-empty">No updates yet.</div>`;
        return;
      }

      // Show badge if there are new entries since last seen
      const lastSeen = parseInt(localStorage.getItem("clw-last-seen") || "0");
      const newCount = data.entries.filter(e => e.published_at > lastSeen).length;
      if (newCount > 0) {
        badge.textContent = newCount;
        badge.style.display = "inline";
      }

      body.innerHTML = data.entries.map(e => `
        <div class="clw-entry">
          <div class="clw-meta">
            <span class="clw-type clw-type-${esc(e.type)}">${esc(e.type)}</span>
            ${e.version ? `<span class="clw-version">v${esc(e.version)}</span>` : ""}
            <span class="clw-date">${fmtDate(e.published_at)}</span>
          </div>
          <div class="clw-entry-title">${esc(e.title)}</div>
          <div class="clw-entry-content">${esc(e.content)}</div>
        </div>
      `).join("");
    })
    .catch(() => {
      document.getElementById("clw-body").innerHTML =
        `<div id="clw-empty">Failed to load changelog.</div>`;
    });
})();