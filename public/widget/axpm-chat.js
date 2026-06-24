(function () {
  if (window.AXPM_CHAT_LOADED) return;
  window.AXPM_CHAT_LOADED = true;

  var script = document.currentScript;
  var apiBase = (script && script.getAttribute("data-api")) || "";
  apiBase = apiBase.replace(/\/$/, "");
  if (!apiBase) {
    console.warn("[AXPM Chat] Missing data-api on script tag.");
    return;
  }

  var color = (script && script.getAttribute("data-color")) || "#3b82f6";
  var label = (script && script.getAttribute("data-label")) || "Chat with us";
  var closeLabel = (script && script.getAttribute("data-close-label")) || "Close chat";
  var zIndex = (script && script.getAttribute("data-z")) || "99999";
  var pageUrl = encodeURIComponent(window.location.href);

  var root = document.createElement("div");
  root.id = "axpm-chat-root";
  root.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:" + zIndex + ";font-family:system-ui,sans-serif;";

  var panel = document.createElement("div");
  panel.style.cssText =
    "display:none;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100dvh - 96px));margin-bottom:12px;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);background:#020617;";

  var iframe = document.createElement("iframe");
  iframe.src =
    apiBase +
    "/widget/chat?embed=1&api=" +
    encodeURIComponent(apiBase) +
    "&page=" +
    pageUrl;
  iframe.title = "AXPM Customer Service";
  iframe.style.cssText = "width:100%;height:100%;border:0;background:#020617;";
  iframe.allow = "clipboard-write";
  panel.appendChild(iframe);

  var button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    "display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.25);background:" +
    color +
    ";";

  var open = false;
  button.addEventListener("click", function () {
    open = !open;
    panel.style.display = open ? "block" : "none";
    button.textContent = open ? closeLabel : label;
  });

  root.appendChild(panel);
  root.appendChild(button);
  document.body.appendChild(root);
})();
