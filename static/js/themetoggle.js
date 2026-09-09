(function () {
  const root = document.documentElement;
  const storageKey = "theme-storage";
  const presets = { light: "#faf9f6", paper: "#f5efe3", sage: "#eaf1eb", dark: "#191d1a" };
  const isColor = (value) => /^#[0-9a-f]{6}$/i.test(value);
  const listeners = new Set();
  let current = "light";
  let background = presets.light;
  let storageAvailable = true;

  function readPreference() {
    try {
      return localStorage.getItem(storageKey) || "light";
    } catch (error) {
      storageAvailable = false;
      return "light";
    }
  }

  // Preserve a running visitor's old light/dark choice only if no site preference exists.
  try {
    if (localStorage.getItem(storageKey) === null) {
      const legacy = localStorage.getItem("theme");
      if (legacy === "light" || legacy === "dark") localStorage.setItem(storageKey, legacy);
    }
  } catch (error) { storageAvailable = false; }

  function apply(value) {
    current = Object.hasOwn(presets, value) || isColor(value) ? value.toLowerCase() : "light";
    const custom = isColor(current);
    background = custom ? current : presets[current];
    const channels = background.slice(1).match(/../g).map((channel) => {
      const srgb = parseInt(channel, 16) / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const dark = custom ? luminance < 0.179 : current === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.skin = custom ? "custom" : current;
    root.classList.toggle("dark", dark);
    root.style.removeProperty("--site-bg");
    if (custom) root.style.setProperty("--site-bg", background);
    root.style.setProperty("--site-custom-ink", dark ? "#ffffff" : "#000000");
    root.style.setProperty("--site-surface-ink", dark ? "#e3e8df" : "#292e29");
    const darkStyle = document.getElementById("darkModeStyle");
    if (darkStyle) darkStyle.disabled = !dark;
    listeners.forEach(listener => listener());
  }

  function choose(value) {
    if (!Object.hasOwn(presets, value) && !isColor(value)) return;
    apply(value);
    try {
      localStorage.setItem(storageKey, current);
      storageAvailable = true;
    } catch (error) { storageAvailable = false; }
    listeners.forEach(listener => listener());
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // Shared by Hugo's initial HTML and React's later mount. All listeners are disposable.
  function mount(settings) {
    const preset = settings.querySelector("#skin-preset");
    const color = settings.querySelector("#skin-color");
    const hex = settings.querySelector("#skin-hex");
    const status = settings.querySelector("#skin-status");
    const removals = [];
    function on(target, event, listener) {
      target.addEventListener(event, listener);
      removals.push(() => target.removeEventListener(event, listener));
    }
    function render() {
      preset.value = isColor(current) ? "custom" : current;
      color.value = background;
      hex.value = background;
      hex.removeAttribute("aria-invalid");
      status.textContent = storageAvailable
        ? "选择自动保存在此浏览器，应用于全站。"
        : "当前浏览器无法保存外观，刷新后会恢复默认。";
    }
    settings.hidden = false;
    render();
    removals.push(subscribe(render));
    on(preset, "change", () => choose(preset.value === "custom" ? color.value : preset.value));
    on(color, "input", () => choose(color.value));
    on(hex, "input", () => {
      if (isColor(hex.value)) choose(hex.value);
      else {
        hex.setAttribute("aria-invalid", "true");
        status.textContent = "请输入完整色值，例如 #faf9f6。";
      }
    });
    on(settings.querySelector("#skin-reset"), "click", () => choose("light"));
    on(document, "click", (event) => {
      if (!settings.contains(event.target)) settings.open = false;
    });
    on(settings, "keydown", (event) => {
      if (event.key === "Escape") {
        settings.open = false;
        settings.querySelector("summary").focus();
      }
    });
    return () => removals.forEach(remove => remove());
  }

  window.siteAppearance = { choose, subscribe, mount, getPreference: () => current };
  // Runs before either application's first paint.
  apply(readPreference());
  document.addEventListener("DOMContentLoaded", () => {
    if (root.dataset.app === "running") return;
    const settings = document.getElementById("skin-settings");
    if (settings) mount(settings);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) apply(readPreference());
  });
})();
