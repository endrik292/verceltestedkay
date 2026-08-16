(function () {
  var ua = navigator.userAgent || "";
  var platform = navigator.platform || "";
  var uaData = navigator.userAgentData || null;
  var uaDataPlatform = uaData && uaData.platform ? uaData.platform : "";
  var hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isIPadOS = platform === "MacIntel" && hasTouch;
  var isAndroid = /Android/i.test(ua);
  var isMobileUA = /Mobile|Tablet|Silk|Kindle|Opera Mini|IEMobile/i.test(ua);
  var isDesktopOS = /Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(ua);
  var desktopClientHint = /Windows|macOS|Linux|Chrome OS/i.test(uaDataPlatform);
  var mobileClientHint = /Android|iOS/i.test(uaDataPlatform) || (uaData && uaData.mobile === true);
  var looksLikeDesktopEmulation = desktopClientHint && (isIOS || isAndroid || isMobileUA);
  var impossibleMobilePlatform = (
    (isIOS && /MacIntel|Win32|Win64|Linux x86_64/i.test(platform) && !/Macintosh/i.test(ua)) ||
    (isAndroid && /MacIntel|Win32|Win64/i.test(platform))
  );
  var allowedDevice = !looksLikeDesktopEmulation && !impossibleMobilePlatform && (
    isIOS ||
    isIPadOS ||
    isAndroid ||
    (isMobileUA && !isDesktopOS) ||
    mobileClientHint
  );

  if (allowedDevice) {
    document.documentElement.classList.add("device-allowed");
    return;
  }

  document.documentElement.classList.add("device-blocked");
  document.documentElement.style.background = "#fff";

  var style = document.createElement("style");
  style.textContent = [
    "html.device-blocked,",
    "html.device-blocked body {",
    "  background: #fff !important;",
    "  min-height: 100vh !important;",
    "}",
    "html.device-blocked body > * {",
    "  display: none !important;",
    "}"
  ].join("\n");
  document.head.appendChild(style);

  window.addEventListener("DOMContentLoaded", function () {
    document.body.innerHTML = "";
  });
})();
