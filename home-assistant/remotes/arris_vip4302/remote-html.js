/*
 * Custom remote_template "arris_vip4302" pro generic-remote-control-card
 * (https://github.com/dimagoltsman/generic-remote-control-card)
 *
 * Modeluje fyzický ovladač ARRIS AURA RCL (k boxu ARRIS VIP4302).
 * Používá se společně s jerzik/arris-vip4302-bt (ESP32-S3 USB-HID + MQTT most).
 *
 * V dashboardu: remote_template: arris_vip4302
 */

window.getRemoteHtml_arris_vip4302 = function (config) {
  const cls = "myButton-arris_vip4302";

  const btn = (id, label, extraClass = "") =>
    `<div id="${id}" class="${cls} arris-btn ${extraClass}">${label}</div>`;

  return `
  <div class="arris-remote">
    ${config.name ? `<h1>${config.name}</h1>` : ""}
    <div class="arris-body">

      <!-- POWER -->
      <div class="row row-power">
        ${btn("power", "&#9211;", "circle power")}
      </div>

      <!-- NUMERIC KEYPAD -->
      <div class="row keypad-row">
        ${btn("button1", "1")}
        ${btn("button2", "2")}
        ${btn("button3", "3")}
      </div>
      <div class="row keypad-row">
        ${btn("button4", "4")}
        ${btn("button5", "5")}
        ${btn("button6", "6")}
      </div>
      <div class="row keypad-row">
        ${btn("button7", "7")}
        ${btn("button8", "8")}
        ${btn("button9", "9")}
      </div>
      <div class="row keypad-row">
        ${btn("text", "TEXT", "wide")}
        ${btn("button0", "0")}
        ${btn("info", "INFO", "wide")}
      </div>

      <!-- VOLUME / EPG / CHANNEL cluster -->
      <div class="row cluster-row">
        <div class="cluster-col">
          ${btn("volup", "+", "small")}
          <div class="icon-only">&#128266;</div>
          ${btn("voldown", "&minus;", "small")}
        </div>
        <div class="cluster-col cluster-col-mid">
          ${btn("epg", "EPG", "pill small-pill")}
          ${btn("mute", "&#128263;", "circle small-circle")}
        </div>
        <div class="cluster-col">
          ${btn("chup", "+", "small")}
          <div class="icon-only label-ch">CH</div>
          ${btn("chdown", "&minus;", "small")}
        </div>
      </div>

      <!-- HOME / MENU -->
      <div class="row home-menu-row">
        ${btn("home", "&#8962;", "circle small-circle")}
        ${btn("menu", "&#9776;", "circle small-circle")}
      </div>

      <!-- D-PAD -->
      <div class="row dpad-row">
        <div class="dpad">
          ${btn("up", "&#9650;", "dpad-btn dpad-up")}
          ${btn("left", "&#9664;", "dpad-btn dpad-left")}
          ${btn("ok", "OK", "dpad-btn dpad-ok")}
          ${btn("right", "&#9654;", "dpad-btn dpad-right")}
          ${btn("down", "&#9660;", "dpad-btn dpad-down")}
        </div>
      </div>

      <!-- BACK / SEARCH -->
      <div class="row back-search-row">
        ${btn("back", "&#8630;", "circle small-circle")}
        ${btn("search", "&#128269;", "circle small-circle")}
      </div>

      <!-- COLOR BUTTONS -->
      <div class="row color-row">
        ${btn("colorred", "", "dot dot-red")}
        ${btn("colorgreen", "", "dot dot-green")}
        ${btn("coloryellow", "", "dot dot-yellow")}
        ${btn("colorblue", "", "dot dot-blue")}
      </div>

      <!-- TV / REC / VOD -->
      <div class="row tvrecvod-row">
        ${btn("tv", "TV", "pill")}
        ${btn("rec", "REC", "pill pill-rec")}
        ${btn("vod", "VOD", "pill")}
      </div>

      <!-- TRANSPORT 1 -->
      <div class="row transport-row">
        ${btn("rewind", "&#9198;", "circle small-circle")}
        ${btn("playpause", "&#9199;", "circle small-circle")}
        ${btn("forward", "&#9197;", "circle small-circle")}
      </div>

      <!-- TRANSPORT 2 -->
      <div class="row transport-row">
        ${btn("previous", "&#9194;", "circle small-circle")}
        ${btn("stop", "&#9209;", "circle small-circle")}
        ${btn("next", "&#9193;", "circle small-circle")}
      </div>

    </div>
  </div>
  `;
};

window.getRemoteStyle_arris_vip4302 = function (config) {
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
    justify-content: center;
    padding: 8px 0;
  }
  .arris-body {
    width: 260px;
    background: linear-gradient(180deg, #2b2b2e, #1a1a1c);
    border-radius: 28px;
    padding: 16px 14px 20px 14px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.45), inset 0 0 0 1px #000;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row { display: flex; justify-content: center; align-items: center; gap: 8px; }
  .row-power { justify-content: flex-end; padding-right: 4px; }

  .arris-btn {
    cursor: pointer;
    color: #cfcfcf;
    background: #38383c;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    box-shadow: inset 0 0 0 1px #000, 0 1px 0 rgba(255,255,255,0.05);
    transition: background 0.1s ease;
  }
  .arris-btn:active { background: #4a4a50; }

  /* keypad */
  .keypad-row { gap: 6px; }
  .keypad-row .arris-btn {
    width: 68px; height: 30px;
    border-radius: 15px;
    font-size: 13px;
  }
  .keypad-row .arris-btn.wide { width: 68px; font-size: 10px; letter-spacing: 0.5px; }

  /* generic circle */
  .circle { border-radius: 50%; }
  .circle.power { width: 34px; height: 34px; font-size: 16px; background:#000; color:#e0e0e0; }
  .circle.small-circle { width: 40px; height: 40px; font-size: 16px; }

  /* cluster (vol / epg / ch) */
  .cluster-row { align-items: center; gap: 10px; margin-top: 4px; }
  .cluster-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .cluster-col-mid { gap: 8px; }
  .arris-btn.small { width: 39px; height: 31px; border-radius: 16px; font-size: 18px; }
  .icon-only { color: #9a9a9a; font-size: 18px; display:flex; align-items:center; justify-content:center; height: 26px; }
  .label-ch { font-size: 14px; letter-spacing: 1px; color:#9a9a9a; }
  .pill.small-pill { width: 54px; height: 22px; border-radius: 11px; font-size: 10px; letter-spacing: 0.5px; }

  /* home / menu */
  .home-menu-row { gap: 60px; margin-top: 2px; }

  /* dpad */
  .dpad-row { margin-top: 4px; }
  .dpad {
    position: relative;
    width: 170px; height: 170px;
    border-radius: 50%;
    background: #303034;
    box-shadow: inset 0 0 0 1px #000, 0 2px 6px rgba(0,0,0,0.4);
  }
  .dpad-btn { position: absolute; background: transparent; box-shadow: none; color: #b8b8b8; }
  .dpad-up    { top: 6px;  left: 50%; transform: translateX(-50%); width: 40px; height: 34px; font-size: 16px; }
  .dpad-down  { bottom: 6px; left: 50%; transform: translateX(-50%); width: 40px; height: 34px; font-size: 16px; }
  .dpad-left  { left: 6px; top: 50%; transform: translateY(-50%); width: 34px; height: 40px; font-size: 16px; }
  .dpad-right { right: 6px; top: 50%; transform: translateY(-50%); width: 34px; height: 40px; font-size: 16px; }
  .dpad-ok {
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 62px; height: 62px; border-radius: 50%;
    background: #101012; color: #e6e6e6; font-size: 13px; font-weight: 600;
    box-shadow: inset 0 0 0 1px #000, 0 2px 4px rgba(0,0,0,0.5);
  }

  /* back / search */
  .back-search-row { gap: 70px; margin-top: 2px; }

  /* color dots */
  .color-row { gap: 18px; margin-top: 4px; }
  .dot { width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.4); }
  .dot-red    { background: #d24141; }
  .dot-green  { background: #3fae4f; }
  .dot-yellow { background: #d9c23a; }
  .dot-blue   { background: #3a7fd9; }

  /* tv / rec / vod */
  .tvrecvod-row { gap: 8px; margin-top: 4px; }
  .pill { width: 66px; height: 30px; border-radius: 15px; font-size: 12px; font-weight: 600; }
  .pill-rec { color: #e05353; }

  /* transport rows */
  .transport-row { gap: 22px; margin-top: 2px; }
  `;
};
