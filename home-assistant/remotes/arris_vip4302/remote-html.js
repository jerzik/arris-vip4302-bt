/*
 * Custom remote_template "arris_vip4302" pro generic-remote-control-card
 * (https://github.com/dimagoltsman/generic-remote-control-card)
 *
 * Modeluje fyzický ovladač ARRIS (k boxu ARRIS VIP4302) podle fotky originálu.
 * Používá se společně s jerzik/arris-vip4302-bt (ESP32-S3 USB-HID + MQTT most).
 *
 * Instalace: ulož tento soubor jako
 *   /config/www/community/generic-remote-control-card/remotes/arris_vip4302/remote-html.js
 * V dashboardu pak: remote_template: arris_vip4302
 *
 * Název šablony se odvozuje z cesty souboru (remotes/<název>/remote-html.js),
 * takže stejný soubor funguje i ve verzované složce (např. arris_vip4302_v12d).
 * HA posílá /hacsfiles s Cache-Control max-age 31 dní — nová složka = nová URL
 * = prohlížeč/appka si vždy stáhne aktuální verzi bez mazání cache.
 *
 * Layout (shora dolů):
 *   power | 1-9 (s písmeny) | TEXT 0 INFO |
 *   kolébka hlasitosti · EPG + mute · kolébka CH |
 *   home ↖  menu ↗ — kolečko s OK — zpět ↙  lupa ↘ |
 *   TV REC VOD | « ⏯ » | |« □ »|
 * Barevná tlačítka záměrně vynechána.
 */

(function () {
const T = (function () {
  try {
    const m = document.currentScript && document.currentScript.src.match(/\/remotes\/([A-Za-z0-9_]+)\/remote-html\.js/);
    if (m) return m[1];
  } catch (e) {}
  return "arris_vip4302";
})();

const svg = (inner) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const I = {
  power:   svg('<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>'),
  home:    svg('<path d="M4 11l8-7 8 7v9H4z"/>'),
  menu:    svg('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  back:    svg('<path d="M9 6L5 10l4 4"/><path d="M5 10h9a5 5 0 0 1 0 10h-3"/>'),
  search:  svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  mute:    svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
  vol:     svg('<path d="M4 18L20 7v11z" fill="currentColor" stroke="none"/>'),
  up:      svg('<path d="M6 15l6-6 6 6"/>'),
  down:    svg('<path d="M6 9l6 6 6-6"/>'),
  left:    svg('<path d="M15 6l-6 6 6 6"/>'),
  right:   svg('<path d="M9 6l6 6-6 6"/>'),
  rewind:  svg('<path d="M12 6l-6 6 6 6M19 6l-6 6 6 6"/>'),
  forward: svg('<path d="M12 6l6 6-6 6M5 6l6 6-6 6"/>'),
  play:    svg('<path d="M4 6v12l8-6z" fill="currentColor"/><path d="M16 6v12M20 6v12"/>'),
  prev:    svg('<path d="M4 6v12"/><path d="M13 6l-6 6 6 6M20 6l-6 6 6 6"/>'),
  next:    svg('<path d="M20 6v12"/><path d="M11 6l6 6-6 6M4 6l6 6-6 6"/>'),
  stop:    svg('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
};

window["getRemoteHtml_" + T] = function (config) {
  const cls = "myButton-" + T;
  const btn = (id, label, extraClass = "") =>
    `<div id="${id}" class="${cls} arris-btn ${extraClass}">${label}</div>`;
  const num = (id, n, sub) =>
    btn(id, `<span class="n">${n}</span><span class="s">${sub}</span>`, "key");

  return `
  <div class="arris-remote">
    ${config.name ? `<h1>${config.name}</h1>` : ""}
    <div class="arris-body">

      <div class="row row-power">
        ${btn("power", I.power, "circle power")}
      </div>

      <div class="grid3">
        ${num("button1", "1", "&nbsp;")}
        ${num("button2", "2", "ABC")}
        ${num("button3", "3", "DEF")}
        ${num("button4", "4", "GHI")}
        ${num("button5", "5", "JKL")}
        ${num("button6", "6", "MNO")}
        ${num("button7", "7", "PQRS")}
        ${num("button8", "8", "TUV")}
        ${num("button9", "9", "WXYZ")}
        ${btn("text", "TEXT", "key key-word")}
        ${num("button0", "0", "&#9251;")}
        ${btn("info", "INFO", "key key-word")}
      </div>

      <!-- hlasitost / EPG + mute / CH -->
      <div class="grid3 cluster">
        <div class="rocker">
          ${btn("volup", "+", "rocker-half rocker-top")}
          <div class="rocker-mid">${I.vol}</div>
          ${btn("voldown", "&minus;", "rocker-half rocker-bot")}
        </div>
        <div class="cluster-mid">
          ${btn("epg", "EPG", "circle mid-circle epg")}
          ${btn("mute", I.mute, "circle mid-circle")}
        </div>
        <div class="rocker">
          ${btn("chup", "+", "rocker-half rocker-top")}
          <div class="rocker-mid ch">CH</div>
          ${btn("chdown", "&minus;", "rocker-half rocker-bot")}
        </div>
      </div>

      <!-- kolečko + 4 rohová tlačítka -->
      <div class="dpad-area">
        ${btn("home", I.home, "circle corner corner-tl")}
        ${btn("menu", I.menu, "circle corner corner-tr")}
        ${btn("back", I.back, "circle corner corner-bl")}
        ${btn("search", I.search, "circle corner corner-br")}
        <div class="dpad">
          ${btn("up", I.up, "dpad-btn dpad-up")}
          ${btn("left", I.left, "dpad-btn dpad-left")}
          ${btn("right", I.right, "dpad-btn dpad-right")}
          ${btn("down", I.down, "dpad-btn dpad-down")}
          ${btn("ok", "", "dpad-ok")}
        </div>
      </div>

      <div class="grid3">
        ${btn("tv", "TV", "key key-big")}
        ${btn("rec", "REC", "key key-big rec")}
        ${btn("vod", "VOD", "key key-big")}
        ${btn("rewind", I.rewind, "key key-icon")}
        ${btn("playpause", I.play, "key key-icon")}
        ${btn("forward", I.forward, "key key-icon")}
        ${btn("previous", I.prev, "key key-icon")}
        ${btn("stop", I.stop, "key key-icon")}
        ${btn("next", I.next, "key key-icon")}
      </div>

    </div>
  </div>
  `;
};

window["getRemoteStyle_" + T] = function (config) {
  return `
  :host { display:block; }
  h1 {
    color: var(--primary-text-color, #ddd);
    font-size: 14px;
    text-align: center;
    margin: 4px 0 8px 0;
  }
  .arris-remote {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
  }
  .arris-body {
    width: 250px;
    background: radial-gradient(120% 60% at 50% 0%, #3a3b3f 0%, #2c2d31 55%, #242528 100%);
    border-radius: 34px 34px 40px 40px;
    padding: 14px 18px 26px 18px;
    box-shadow: 0 8px 22px rgba(0,0,0,0.5), inset 0 0 0 1px #111, inset 0 1px 0 rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row { display: flex; justify-content: center; align-items: center; }
  .row-power { justify-content: flex-end; margin-bottom: -4px; }

  .arris-btn {
    cursor: pointer;
    color: #e4e4e4;
    background: linear-gradient(180deg, #34353a, #26272b);
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    box-shadow: inset 0 0 0 1px #101012, inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 3px rgba(0,0,0,0.45);
    transition: filter 0.08s ease;
    font-family: Arial, Helvetica, sans-serif;
  }
  .arris-btn:active { filter: brightness(1.4); }
  .circle { border-radius: 50%; }

  .circle.power { width: 30px; height: 30px; font-size: 16px; color: #bdbdbd;
    background: radial-gradient(circle at 40% 35%, #4a4b50, #2b2c30); }

  /* 3 sloupce — klávesnice, TV/REC/VOD, transport */
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 12px; }

  .key { height: 38px; border-radius: 10px; flex-direction: column; line-height: 1; }
  .key .n { font-size: 17px; font-weight: 600; }
  .key .s { font-size: 7px; letter-spacing: 0.5px; margin-top: 2px; color: #c9c9c9; }
  .key-word { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
  .key-big { height: 42px; font-size: 16px; font-weight: 700; }
  .key-big.rec { color: #e0342f; }
  .key-icon { height: 42px; font-size: 22px; }

  /* hlasitost / EPG / CH — blok o 30 % větší */
  .cluster { align-items: center; margin-top: 2px; }
  .rocker {
    display: flex; flex-direction: column; align-items: stretch;
    height: 124px; border-radius: 12px; overflow: hidden;
    background: linear-gradient(180deg, #34353a, #26272b);
    box-shadow: inset 0 0 0 1px #101012, inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 3px rgba(0,0,0,0.45);
  }
  .rocker-half { flex: 1; background: transparent; box-shadow: none; font-size: 22px; font-weight: 300; border-radius: 0; }
  .rocker-top { align-items: flex-start; padding-top: 6px; }
  .rocker-bot { align-items: flex-end; padding-bottom: 8px; }
  .rocker-mid { height: 22px; display: flex; align-items: center; justify-content: center; color: #e4e4e4; font-size: 18px; }
  .rocker-mid.ch { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; font-family: Arial, Helvetica, sans-serif; }
  .cluster-mid { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .mid-circle { width: 44px; height: 44px; font-size: 20px; }
  .mid-circle.epg { font-size: 11px; font-weight: 700; letter-spacing: 0.3px; }

  /* kolečko + rohová tlačítka */
  .dpad-area { position: relative; height: 222px; display: flex; align-items: center; justify-content: center; margin: 2px 0; }
  .corner { position: absolute; width: 34px; height: 34px; font-size: 17px; }
  .corner-tl { top: 0; left: 0; }
  .corner-tr { top: 0; right: 0; }
  .corner-bl { bottom: 0; left: 0; }
  .corner-br { bottom: 0; right: 0; }

  .dpad {
    position: relative;
    width: 166px; height: 166px; border-radius: 50%;
    background: radial-gradient(circle at 50% 35%, #45464b 0%, #34353a 55%, #2a2b2f 100%);
    box-shadow: inset 0 0 0 1px #0e0e10, inset 0 2px 1px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.55);
  }
  .dpad-btn { position: absolute; background: transparent; box-shadow: none; color: #e4e4e4; font-size: 18px; }
  .dpad-up    { top: 4px;    left: 50%; transform: translateX(-50%); width: 60px; height: 44px; }
  .dpad-down  { bottom: 4px; left: 50%; transform: translateX(-50%); width: 60px; height: 44px; }
  .dpad-left  { left: 4px;   top: 50%;  transform: translateY(-50%); width: 44px; height: 60px; }
  .dpad-right { right: 4px;  top: 50%;  transform: translateY(-50%); width: 44px; height: 60px; }
  .dpad-ok {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 66px; height: 66px; border-radius: 50%;
    background: conic-gradient(from 200deg, #9a9ca1, #2e2f33, #7c7e84, #2a2b2f, #a6a8ad, #34353a, #9a9ca1);
    box-shadow: inset 0 0 0 2px #1a1b1e, 0 2px 5px rgba(0,0,0,0.6);
  }
  `;
};
})();
