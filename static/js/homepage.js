(function () {
  function initHomepage() {
    const homepageRoot = document.querySelector('[data-homepage="interactive"]');

    if (!homepageRoot) {
      return;
    }

    const runningRoot = document.querySelector("[data-running-root]");
    const runningMonth = document.getElementById("homepage-running-month");
    const runningValue = document.getElementById("homepage-running-value");
    const runningStatus = document.getElementById("homepage-running-status");
    const runningProgress = document.getElementById("homepage-running-progress");
    const runningPercent = document.getElementById("homepage-running-percent");
    const runningGrid = document.getElementById("homepage-running-grid");

    const crazyTalkDataNode = document.getElementById("homepage-crazy-talk-data");
    const crazyTalkText = document.getElementById("homepage-crazy-talk");
    const crazyTalkLink = document.getElementById("homepage-crazy-talk-link");
    const crazyTalkNext = document.getElementById("homepage-crazy-talk-next");

    const RUNNING_TARGET_KM = Number(runningRoot?.dataset.targetKm || 150);
    const RUNNING_BASE = runningRoot?.dataset.runningBase || "/running/";
    const CRAZY_TALK_INTERVAL_MS = 5000;
    let crazyTalkTimer = null;

    function syncHomepageTheme() {
      const savedTheme = localStorage.getItem("theme-storage") || "light";
      document.body.setAttribute("data-homepage-theme", savedTheme);
    }

    function normalizeActivityType(type) {
      const normalized = {
        Run: "running",
        running: "running",
        VirtualRun: "running",
        Walk: "walking",
        walking: "walking",
        Ride: "cycling",
        cycling: "cycling",
        Hike: "hiking",
        Hiking: "hiking",
        hiking: "hiking",
        Swim: "swimming",
        swimming: "swimming",
        Ski: "skiing",
        skiing: "skiing",
      };

      return normalized[type] || String(type || "").toLowerCase();
    }

    function formatKm(km) {
      return `${km.toFixed(1)} km`;
    }

    function formatMonthLabel(date) {
      return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
    }

    function buildEmptyMonthlyStats(referenceDate) {
      return buildMonthlyRunningStats([], referenceDate);
    }

    function createRunningDayCell(distanceKm, title) {
      const cell = document.createElement("span");
      let level = "level-0";

      if (distanceKm >= 10) {
        level = "level-3";
      } else if (distanceKm >= 5) {
        level = "level-2";
      } else if (distanceKm > 0) {
        level = "level-1";
      }

      cell.className = `homepage-running-cell ${level}`;
      cell.title = title;
      cell.setAttribute("aria-label", title);

      return cell;
    }

    function parseActivitiesPayload(source) {
      const signature = "JSON.parse(`";
      const start = source.indexOf(signature);

      if (start === -1) {
        throw new Error("activities payload signature not found");
      }

      const payloadStart = start + signature.length;
      const payloadEnd = source.indexOf("`)", payloadStart);

      if (payloadEnd === -1) {
        throw new Error("activities payload end marker not found");
      }

      const templateLiteralSource = source.slice(payloadStart - 1, payloadEnd + 1);
      const decodedPayload = new Function(`return ${templateLiteralSource};`)();

      return JSON.parse(decodedPayload);
    }

    async function resolveActivitiesAssetUrl() {
      const homepageResponse = await fetch(RUNNING_BASE, { credentials: "omit" });

      if (!homepageResponse.ok) {
        throw new Error(`running homepage request failed: ${homepageResponse.status}`);
      }

      const homepageHtml = await homepageResponse.text();
      const directMatch = homepageHtml.match(/\/running\/assets\/activities-[^"' )]+\.js/);

      if (directMatch) {
        return new URL(directMatch[0], window.location.origin).toString();
      }

      const indexScriptMatch = homepageHtml.match(/src="([^"]*index-[^"]+\.js)"/);

      if (!indexScriptMatch) {
        throw new Error("running index bundle not found");
      }

      const indexScriptUrl = new URL(indexScriptMatch[1], window.location.origin).toString();
      const indexScriptResponse = await fetch(indexScriptUrl, { credentials: "omit" });

      if (!indexScriptResponse.ok) {
        throw new Error(`running index bundle request failed: ${indexScriptResponse.status}`);
      }

      const indexScriptText = await indexScriptResponse.text();
      const activitiesPathMatch = indexScriptText.match(/assets\/activities-[^"' )]+\.js/);

      if (!activitiesPathMatch) {
        throw new Error("running activities bundle not found");
      }

      return new URL(`${RUNNING_BASE}${activitiesPathMatch[0]}`, window.location.origin).toString();
    }

    async function fetchRunningActivities() {
      const activitiesAssetUrl = await resolveActivitiesAssetUrl();
      const activitiesResponse = await fetch(activitiesAssetUrl, { credentials: "omit" });

      if (!activitiesResponse.ok) {
        throw new Error(`running activities request failed: ${activitiesResponse.status}`);
      }

      const activitiesScript = await activitiesResponse.text();
      return parseActivitiesPayload(activitiesScript);
    }

    function buildMonthlyRunningStats(activities, referenceDate) {
      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
      const perDay = new Map();

      activities
        .filter((activity) => normalizeActivityType(activity.type) === "running")
        .forEach((activity) => {
          const startDate = String(activity.start_date_local || "");

          if (!startDate.startsWith(monthPrefix)) {
            return;
          }

          const dayKey = startDate.slice(0, 10);
          const distanceKm = Number(activity.distance || 0) / 1000;
          const current = perDay.get(dayKey) || 0;
          perDay.set(dayKey, current + distanceKm);
        });

      let totalKm = 0;
      const days = [];

      for (let day = 1; day <= daysInMonth; day += 1) {
        const dayKey = `${monthPrefix}-${String(day).padStart(2, "0")}`;
        const distanceKm = Number((perDay.get(dayKey) || 0).toFixed(1));
        totalKm += distanceKm;
        days.push({ dayKey, distanceKm });
      }

      return {
        label: formatMonthLabel(referenceDate),
        totalKm: Number(totalKm.toFixed(1)),
        days,
      };
    }

    function renderRunningStats(stats) {
      const safeTotalKm = Number.isFinite(stats.totalKm) ? stats.totalKm : 0;

      runningMonth.textContent = stats.label;
      runningValue.textContent = `${safeTotalKm.toFixed(1)} / ${RUNNING_TARGET_KM} km`;
      if (runningPercent) {
        runningPercent.textContent = `${Math.round(
          Math.min((safeTotalKm / RUNNING_TARGET_KM) * 100, 100)
        )}%`;
      }
      runningStatus.textContent =
        safeTotalKm >= RUNNING_TARGET_KM
          ? "这个月的目标已经完成了，接下来继续把节奏跑稳。"
          : `离这个月的 ${RUNNING_TARGET_KM} km 目标，还差 ${Math.max(
              RUNNING_TARGET_KM - safeTotalKm,
              0
            ).toFixed(1)} km。`;
      runningProgress.style.width = `${Math.min((safeTotalKm / RUNNING_TARGET_KM) * 100, 100)}%`;
      runningGrid.innerHTML = "";

      stats.days.forEach((entry) => {
        const title =
          entry.distanceKm > 0
            ? `${entry.dayKey} · ${formatKm(entry.distanceKm)}`
            : `${entry.dayKey} · 当天暂无跑步记录`;
        runningGrid.appendChild(createRunningDayCell(entry.distanceKm, title));
      });
    }

    function renderRunningFallback(message) {
      const fallbackStats = buildEmptyMonthlyStats(new Date());
      renderRunningStats(fallbackStats);
      runningStatus.textContent = message;
    }

    async function initRunningPanel() {
      if (!runningRoot) {
        return;
      }

      try {
        const activities = await fetchRunningActivities();
        const monthlyStats = buildMonthlyRunningStats(activities, new Date());
        renderRunningStats(monthlyStats);
      } catch (error) {
        console.error(error);
        renderRunningFallback("这个月还没有留下跑步记录，或者首页暂时没能取到 Running 数据。");
      }
    }

    function initCrazyTalkTicker() {
      if (!crazyTalkDataNode || !crazyTalkText || !crazyTalkLink || !crazyTalkNext) {
        return;
      }

      const itemNodes = crazyTalkDataNode.querySelectorAll("[data-crazy-talk-item]");
      const items = Array.from(itemNodes).map((node) => ({
        text: node.getAttribute("data-text") || "",
        title: node.getAttribute("data-title") || "",
        url: node.getAttribute("data-url") || "/crazy-talk/",
      }));

      if (!Array.isArray(items) || items.length === 0) {
        return;
      }

      let currentIndex = 0;

      function renderCurrentItem() {
        const current = items[currentIndex];
        crazyTalkText.textContent = current.text;
        crazyTalkLink.textContent = current.title;
        crazyTalkLink.href = current.url;
      }

      function advanceTicker() {
        currentIndex = (currentIndex + 1) % items.length;
        renderCurrentItem();
      }

      function restartTicker() {
        if (crazyTalkTimer) {
          window.clearInterval(crazyTalkTimer);
        }

        if (items.length > 1) {
          crazyTalkTimer = window.setInterval(advanceTicker, CRAZY_TALK_INTERVAL_MS);
        }
      }

      crazyTalkNext.addEventListener("click", function () {
        advanceTicker();
        restartTicker();
      });

      if (items.length === 1) {
        crazyTalkNext.hidden = true;
      }

      renderCurrentItem();
      restartTicker();
    }

    syncHomepageTheme();
    const themeToggle = document.getElementById("dark-mode-toggle");

    if (themeToggle) {
      themeToggle.addEventListener("click", function () {
        window.setTimeout(syncHomepageTheme, 0);
      });
    }

    window.addEventListener("storage", function (event) {
      if (event.key === "theme-storage") {
        syncHomepageTheme();
      }
    });

    initRunningPanel();
    initCrazyTalkTicker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomepage);
  } else {
    initHomepage();
  }
})();
