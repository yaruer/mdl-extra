// ==UserScript==
// @name         MDL Extra
// @namespace    https://github.com/yaruer/mdl-extra
// @version      1.0.2
// @description  Adds extra functions to MyDramaList: quick +/– episode buttons, theme-aware, auto-close modals, profile-only.
// @author       yaruer
// @icon         https://github.com/yaruer/mdl-extra/blob/main/icon.png?raw=true
// @match        https://mydramalist.com/profile/*
// @updateURL    https://raw.githubusercontent.com/yaruer/mdl-extra/main/mdl-extra.user.js
// @downloadURL  https://raw.githubusercontent.com/yaruer/mdl-extra/main/mdl-extra.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  // --- Config via Menu ---
  function setUsername() {
    const current = GM_getValue("mdl_username", "");
    const name = prompt("Enter your MDL username (exactly as it appears in the URL):", current);
    if (name) {
      GM_setValue("mdl_username", name.trim());
      alert("Username saved: " + name.trim());
    }
  }
  GM_registerMenuCommand("Set MDL Username", setUsername);

  const myUser = GM_getValue("mdl_username", "");
  if (!myUser) {
    console.log("[MDL Quick Update] No username set. Use the menu to set one.");
    return;
  }

  const path = window.location.pathname; // /profile/YourName
  if (!path.startsWith("/profile/")) return;

  const profileUser = path.split("/")[2];
  if (profileUser.toLowerCase() !== myUser.toLowerCase()) {
    console.log("[MDL Quick Update] Not your profile → no buttons added.");
    return;
  }

  // --- Style ---
  const style = document.createElement('style');
  style.textContent = `
    .episode-quick-buttons {
      display:inline-flex;
      gap:6px;
      margin-left:6px;
      vertical-align:middle;
    }
    .mdl-quick-btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:22px;
      height:22px;
      font-size:13px;
      font-weight:700;
      border-radius:8px;
      cursor:pointer;
      transition:background .15s ease,transform .05s ease;
      user-select:none;
      border:1px solid;
    }
    .mdl-quick-btn:active { transform:translateY(1px); }
  `;
  document.head.appendChild(style);

  // --- Detect dark mode ---
  function isDarkMode() {
    const toggle = document.querySelector('.btn-dark-mode .btn-success');
    if (toggle && toggle.textContent.trim().toUpperCase() === 'ON') return true;
    return document.body.classList.contains('dark') || document.body.dataset.theme === 'dark';
  }

  function applyThemeStyles() {
    const dark = isDarkMode();
    document.querySelectorAll('.mdl-quick-btn').forEach(btn => {
      if (dark) {
        btn.style.background = '#2b2b2b';
        btn.style.color = '#f0f0f0';
        btn.style.borderColor = '#444';
      } else {
        btn.style.background = '#f5f5f5';
        btn.style.color = '#222';
        btn.style.borderColor = '#ccc';
      }
    });
  }

  function waitFor(selector, root = document, timeout = 6000) {
    return new Promise((resolve, reject) => {
      const found = root.querySelector(selector);
      if (found) return resolve(found);
      const obs = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(root, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
    });
  }

  function createButtons() {
    const wrap = document.createElement('span');
    wrap.className = 'episode-quick-buttons';

    const btnPlus = document.createElement('button');
    btnPlus.className = 'mdl-quick-btn';
    btnPlus.type = 'button';
    btnPlus.textContent = '+';

    const btnMinus = document.createElement('button');
    btnMinus.className = 'mdl-quick-btn';
    btnMinus.type = 'button';
    btnMinus.textContent = '–';

    wrap.appendChild(btnPlus);
    wrap.appendChild(btnMinus);
    applyThemeStyles();

    return { wrap, btnPlus, btnMinus };
  }

  function addButtons(activityEl, editBtn) {
    if (!/Currently\s*watching/i.test(activityEl.textContent || '')) return;
    if (activityEl.parentNode.querySelector('.episode-quick-buttons')) return;

    activityEl.style.display = 'inline-block';
    activityEl.style.verticalAlign = 'middle';

    const { wrap, btnPlus, btnMinus } = createButtons();
    activityEl.parentNode.insertBefore(wrap, activityEl.nextSibling);

    const updateEpisodes = async (delta) => {
      editBtn.click();
      try {
        const input = await waitFor('.el-input__inner');
        const current = parseInt(input.value || '0', 10) || 0;
        const next = Math.max(0, current + delta);
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const submitBtn = await waitFor('.el-button.btn.btn-success.el-button--primary');
        submitBtn.click();
        setTimeout(() => {
          const closeBtn = document.querySelector('.el-dialog__headerbtn');
          if (closeBtn) closeBtn.click();
          else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27 }));
        }, 600);
      } catch (e) { console.error('[MDL Quick Update]', e); }
    };

    btnPlus.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); updateEpisodes(1); });
    btnMinus.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); updateEpisodes(-1); });
  }

  // --- Observe DOM for instant buttons ---
  function processNewNode(node) {
    if (node.nodeType !== 1) return;
    const editBtn = node.querySelector?.('.btn.simple.btn-manage-list');
    const activityEl = node.querySelector?.('div.activity');
    if (editBtn && activityEl) addButtons(activityEl, editBtn);
    node.querySelectorAll?.('.list-item, .box, tr, li, .card, .clearfix').forEach(row => {
      const edit = row.querySelector('.btn.simple.btn-manage-list');
      const act = row.querySelector('div.activity');
      if (edit && act) addButtons(act, edit);
    });
  }

  document.querySelectorAll('.list-item, .box, tr, li, .card, .clearfix').forEach(row => {
    const editBtn = row.querySelector('.btn.simple.btn-manage-list');
    const activityEl = row.querySelector('div.activity');
    if (editBtn && activityEl) addButtons(activityEl, editBtn);
  });

  const mo = new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(processNewNode));
    applyThemeStyles();
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Watch theme toggle
  const themeToggle = document.querySelector('.btn-dark-mode');
  if (themeToggle) {
    const themeObs = new MutationObserver(applyThemeStyles);
    themeObs.observe(themeToggle, { childList: true, subtree: true });
  }

  window.addEventListener('load', () => setTimeout(applyThemeStyles, 300));

})();
