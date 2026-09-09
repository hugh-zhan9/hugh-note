(function () {
  const root = document.documentElement;
  const storageKey = "theme-storage";
  const presets = { light: "#faf9f6", paper: "#f5efe3", sage: "#eaf1eb", dark: "#191d1a" };
  const isColor = (value) => /^#[0-9a-f]{6}$/i.test(value);
  let current = "light";
  let settings;
  let preset;
  let color;
  let hex;
  let status;
  let storageAvailable = true;

  function readPreference() {
    try {
      return localStorage.getItem(storageKey) || "light";
    } catch (error) {
      storageAvailable = false;
      return "light";
    }
  }

  function apply(value) {
    current = Object.hasOwn(presets, value) || isColor(value) ? value.toLowerCase() : "light";
    const custom = isColor(current);
    const background = custom ? current : presets[current];
    // Pick black or white using relative luminance, including mid-tone backgrounds.
    const channels = background.slice(1).match(/../g).map((channel) => {
      const srgb = parseInt(channel, 16) / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const dark = custom ? luminance < 0.179 : current === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.skin = custom ? "custom" : current;
    root.style.removeProperty("--site-bg");
    if (custom) root.style.setProperty("--site-bg", background);
    root.style.setProperty("--site-custom-ink", dark ? "#ffffff" : "#000000");
    root.style.setProperty("--site-surface-ink", dark ? "#e3e8df" : "#292e29");
    const darkStyle = document.getElementById("darkModeStyle");
    if (darkStyle) darkStyle.disabled = !dark;
    if (settings) {
      preset.value = custom ? "custom" : current;
      color.value = background;
      hex.value = background;
      hex.removeAttribute("aria-invalid");
      status.textContent = storageAvailable
        ? "选择自动保存在此浏览器，应用于全站。"
        : "当前浏览器无法保存外观，刷新后会恢复默认。";
    }
  }

  function choose(value) {
    apply(value);
    try {
      localStorage.setItem(storageKey, current);
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
    }
    apply(current);
  }

  // Runs in the head so every page uses the saved palette before its first paint.
  apply(readPreference());

  document.addEventListener("DOMContentLoaded", function () {
    settings = document.getElementById("skin-settings");
    if (!settings) return;
    preset = document.getElementById("skin-preset");
    color = document.getElementById("skin-color");
    hex = document.getElementById("skin-hex");
    status = document.getElementById("skin-status");
    settings.hidden = false;
    apply(current);
    preset.addEventListener("change", () => choose(preset.value === "custom" ? color.value : preset.value));
    color.addEventListener("input", () => choose(color.value));
    hex.addEventListener("input", function () {
      if (isColor(hex.value)) {
        choose(hex.value);
      } else {
        hex.setAttribute("aria-invalid", "true");
        status.textContent = "请输入完整色值，例如 #faf9f6。";
      }
    });
    document.getElementById("skin-reset").addEventListener("click", () => choose("light"));
    document.addEventListener("click", function (event) {
      if (!settings.contains(event.target)) settings.open = false;
    });
    settings.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        settings.open = false;
        settings.querySelector("summary").focus();
      }
    });
  });

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === null) apply(readPreference());
  });
})();
