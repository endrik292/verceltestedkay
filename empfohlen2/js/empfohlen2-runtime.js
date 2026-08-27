(() => {
  const basePath = "/empfohlen2";
  const affiliateUrl = "https://globalvisitlog.com/cf/click";
  const storageKey = "_empfohlen2_landing_params";

  const readSavedParams = () => {
    try {
      return new URLSearchParams(window.localStorage.getItem(storageKey) || "");
    } catch {
      return new URLSearchParams();
    }
  };

  const saveParams = (params) => {
    try {
      window.localStorage.setItem(storageKey, params.toString());
    } catch {}
  };

  const landingParams = () => {
    const saved = readSavedParams();
    const current = new URLSearchParams(window.location.search);
    current.forEach((value, key) => saved.set(key, value));
    saveParams(saved);
    return saved;
  };

  const withParams = (url) => {
    const target = new URL(url, window.location.origin);
    landingParams().forEach((value, key) => target.searchParams.set(key, value));
    return target.origin === window.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : target.toString();
  };

  const goTo = (path) => {
    window.location.href = withParams(`${basePath}${path}`);
  };

  const setActive = (button, active) => {
    button.classList.toggle("border-neon", active);
    button.classList.toggle("bg-neon/15", active);
    button.classList.toggle("text-neon", active);
    button.classList.toggle("glow-brand", active);
    button.classList.toggle("text-foreground/80", !active);
  };

  const initHome = () => {
    const next = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Weiter"
    );
    next?.addEventListener("click", () => goTo("/step-1"));
  };

  const initStepOne = () => {
    const deviceValues = { iphone: [122, 210], android: [115, 200] };
    const timeValues = { under1: [0.36, 0.42], "1to3": [0.72, 0.75], over3: [1.1, 1.15] };
    let selectedDevice = null;
    let selectedTime = null;

    const buttons = [...document.querySelectorAll("button[type='button']")];
    const estimatePanel = [...document.querySelectorAll(".rounded-2xl")].find((node) =>
      /Wähle dein Gerät|Geschätzte Einnahmen|Deine geschätzten/.test(node.textContent)
    );
    const next = [...document.querySelectorAll("a")].find((link) =>
      link.textContent.includes("Weiter zu Schritt 2")
    );

    const updateEstimate = () => {
      if (!estimatePanel) return;
      if (!selectedDevice) {
        estimatePanel.innerHTML =
          '<div class="mb-2 text-sm font-medium text-muted-foreground">Wähle dein Gerät aus, um zu starten</div><div class="text-3xl font-black tracking-tight text-muted-foreground">-</div>';
        return;
      }

      const [baseLow, baseHigh] = deviceValues[selectedDevice];
      const [multLow, multHigh] = selectedTime ? timeValues[selectedTime] : [1, 1];
      const low = Math.round(baseLow * multLow);
      const high = Math.round(baseHigh * multHigh);
      const label = selectedTime ? "Deine geschätzten Einnahmen" : "Geschätzte Einnahmen für dein Gerät";
      estimatePanel.innerHTML = `<div class="mb-2 text-sm font-medium text-muted-foreground">${label}</div><div class="flex items-baseline justify-center gap-1 sm:gap-2"><span class="text-3xl font-black tracking-tight text-neon text-glow sm:text-4xl md:text-5xl">${low.toLocaleString()}-${high.toLocaleString()} €</span><span class="text-sm font-medium text-muted-foreground sm:text-base md:text-lg">/Tag</span></div>`;
    };

    const updateNext = () => {
      if (!next) return;
      const ready = Boolean(selectedDevice && selectedTime);
      next.setAttribute("aria-disabled", String(!ready));
      next.href = withParams(`${basePath}/step-2`);
      next.classList.toggle("pointer-events-none", !ready);
      next.classList.toggle("bg-muted", !ready);
      next.classList.toggle("text-muted-foreground", !ready);
      next.classList.toggle("bg-neon", ready);
      next.classList.toggle("text-primary-foreground", ready);
      next.classList.toggle("hover:bg-neon-glow", ready);
      next.classList.toggle("glow-brand-strong", ready);
    };

    const bindOption = (label, group, value) => {
      const button = buttons.find((item) => item.textContent.trim() === label);
      button?.addEventListener("click", () => {
        if (group === "device") selectedDevice = value;
        if (group === "time") selectedTime = value;
        buttons.forEach((item) => {
          const text = item.textContent.trim();
          const isDevice = ["iPhone", "Android"].includes(text);
          const isTime = ["Unter 1 Std.", "1-3 Std.", "1–3 Std.", "Über 3 Std."].includes(text);
          setActive(item, (isDevice && text === label && group === "device") || (isTime && text === label && group === "time"));
        });
        updateEstimate();
        updateNext();
      });
    };

    bindOption("iPhone", "device", "iphone");
    bindOption("Android", "device", "android");
    bindOption("Unter 1 Std.", "time", "under1");
    bindOption("1–3 Std.", "time", "1to3");
    bindOption("Über 3 Std.", "time", "over3");
    updateEstimate();
    updateNext();
  };

  const initStepTwo = () => {
    document.querySelectorAll(`a[href^="${basePath}/"]`).forEach((link) => {
      link.href = withParams(link.href);
    });

    const download = [...document.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Jetzt herunterladen")
    );
    if (!download) return;
    download.disabled = false;
    download.removeAttribute("disabled");
    download.className =
      "group mt-8 flex w-full select-none items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold transition-all duration-200 bg-neon text-primary-foreground hover:bg-neon-glow glow-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    download.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = withParams(affiliateUrl);
    });
  };

  const init = () => {
    landingParams();
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path === basePath) initHome();
    if (path === `${basePath}/step-1`) initStepOne();
    if (path === `${basePath}/step-2`) initStepTwo();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
