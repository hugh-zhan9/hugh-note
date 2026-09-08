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
    const runningMeter = document.getElementById("homepage-running-meter");
    const runningPrevious = document.getElementById("homepage-running-previous");
    const runningNext = document.getElementById("homepage-running-next");
    const runningRoutes = document.getElementById("homepage-running-routes");
    const runningRouteMap = document.getElementById("homepage-running-route-map");
    const runningRoutesStatus = document.getElementById("homepage-running-routes-status");
    const routeOverview = document.getElementById("homepage-route-overview");
    const routeIndividual = document.getElementById("homepage-route-individual");
    const routeOverviewTab = document.getElementById("homepage-route-overview-tab");
    const routeRegion = document.getElementById("homepage-route-region");
    const routeIndividualTab = document.getElementById("homepage-route-individual-tab");

    const crazyTalkDataNode = document.getElementById("homepage-crazy-talk-data");
    const crazyTalkText = document.getElementById("homepage-crazy-talk");
    const crazyTalkLink = document.getElementById("homepage-crazy-talk-link");
    const crazyTalkNext = document.getElementById("homepage-crazy-talk-next");

    const RUNNING_TARGET_KM = Number(runningRoot?.dataset.targetKm || 150);
    const RUNNING_BASE = runningRoot?.dataset.runningBase || "/running/";
    const CRAZY_TALK_INTERVAL_MS = 10000;
    const CRAZY_TALK_FILE_LIMIT = 30;

    function syncHomepageTheme() {
      let savedTheme = "light";
      try {
        savedTheme = localStorage.getItem("theme-storage") || "light";
      } catch (error) {}
      document.body.setAttribute("data-homepage-theme", savedTheme);
      document.getElementById("dark-mode-toggle")?.setAttribute(
        "aria-label", savedTheme === "dark" ? "切换浅色模式" : "切换深色模式"
      );
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

      const monthlyActivities = activities.filter((activity) =>
        normalizeActivityType(activity.type) === "running" &&
        String(activity.start_date_local || "").startsWith(monthPrefix)
      );
      monthlyActivities.forEach((activity) => {
        const dayKey = String(activity.start_date_local || "").slice(0, 10);
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

      const today = new Date();
      return {
        label: formatMonthLabel(referenceDate),
        monthKey: monthPrefix,
        isCurrentMonth: year === today.getFullYear() && month === today.getMonth(),
        totalKm: Number(totalKm.toFixed(1)),
        days,
        activities: monthlyActivities,
      };
    }

    function decodeRoute(encoded) {
      if (typeof encoded !== "string") return [];
      const points = [];
      let index = 0;
      let latitude = 0;
      let longitude = 0;
      function readDelta() {
        let result = 0;
        let shift = 0;
        let byte;
        do {
          if (index >= encoded.length || shift > 30) throw new Error("invalid route");
          byte = encoded.charCodeAt(index++) - 63;
          if (byte < 0 || byte > 63) throw new Error("invalid route");
          result |= (byte & 31) << shift;
          shift += 5;
        } while (byte >= 32);
        return result & 1 ? ~(result >> 1) : result >> 1;
      }
      try {
        while (index < encoded.length) {
          latitude += readDelta();
          longitude += readDelta();
          if (Math.abs(latitude) > 9000000 || Math.abs(longitude) > 18000000) return [];
          points.push([latitude / 1e5, longitude / 1e5]);
        }
      } catch (error) { return []; }
      // Some activities contain two identical placeholder coordinates, not a route.
      if (points.length < 2 || !points.some(([lat, lon]) => lat !== points[0][0] || lon !== points[0][1])) return [];
      return points;
    }

    function groupRoutesByArea(routes) {
      const groups = [];
      function distanceKm([lat1, lon1], [lat2, lon2]) {
        const radians = Math.PI / 180;
        const a = Math.sin((lat2 - lat1) * radians / 2) ** 2 +
          Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lon2 - lon1) * radians / 2) ** 2;
        return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
      }
      routes.forEach((route) => {
        const origin = route.points[0];
        const nearby = groups.find((group) => distanceKm(group.origin, origin) <= 30);
        if (nearby) nearby.routes.push(route);
        else {
          const location = route.activity.location_country;
          const city = typeof location === "object" && location !== null ? location.city :
            String(location || "").match(/['"]city['"]\s*:\s*['"]([^'"]+)['"]/)?.[1];
          groups.push({ origin, city, routes: [route] });
        }
      });
      return groups.sort((left, right) => right.routes.length - left.routes.length);
    }

    function drawRoutes(svg, routes) {
      // Project all routes together so their relative locations are retained.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const projected = routes.map((route) => ({
        activity: route.activity,
        points: route.points.map(([lat, lon]) => {
          const x = lon * Math.PI / 180;
          const y = -Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360));
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          return [x, y];
        }),
      }));
      const scale = Math.min(284 / Math.max(maxX - minX, 1e-9), 164 / Math.max(maxY - minY, 1e-9));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      projected.forEach((route) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", route.points.map(([x, y], index) => `${index ? "L" : "M"}${(160 + (x - centerX) * scale).toFixed(2)},${(100 + (y - centerY) * scale).toFixed(2)}`).join(" "));
        path.setAttribute("vector-effect", "non-scaling-stroke");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${String(route.activity.start_date_local).slice(0, 10)} · ${formatKm(Number(route.activity.distance || 0) / 1000)}`;
        path.appendChild(title);
        svg.appendChild(path);
      });
    }

    function renderRunningRoutes(stats) {
      if (!runningRoutes || !runningRouteMap || !runningRoutesStatus) return;
      runningRoutes.hidden = stats.activities.length === 0;
      runningRouteMap.replaceChildren();
      routeIndividual?.replaceChildren();
      const allRoutes = stats.activities.map((activity) => ({
        activity,
        points: decodeRoute(activity.summary_polyline || activity.map?.summary_polyline),
      })).sort((left, right) => String(right.activity.start_date_local).localeCompare(String(left.activity.start_date_local)));
      const routes = allRoutes.filter((route) => route.points.length > 1);
      if (routes.length === 0) runningRouteMap.setAttribute("hidden", "");
      else runningRouteMap.removeAttribute("hidden");
      runningRoutesStatus.textContent = routes.length
        ? `${routes.length} 条路线${routes.length < stats.activities.length ? ` · ${stats.activities.length - routes.length} 次无轨迹` : ""}`
        : "该月跑步没有可用的 GPS 轨迹";
      const groups = groupRoutesByArea(routes);
      function showRegion(index) {
        runningRouteMap.replaceChildren();
        const group = groups[index];
        if (!group) return;
        runningRouteMap.setAttribute("aria-label", `${stats.label}，${group.city || `区域 ${index + 1}`}，${group.routes.length} 条跑步路线概览`);
        drawRoutes(runningRouteMap, group.routes);
      }
      if (routeRegion) {
        routeRegion.replaceChildren();
        groups.forEach((group, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          const sameCityCount = groups.filter((item) => item.city === group.city).length;
          const label = group.city ? `${group.city}${sameCityCount > 1 ? ` · 区域 ${index + 1}` : ""}` : `区域 ${index + 1}`;
          option.textContent = `${label} · ${group.routes.length} 条路线`;
          routeRegion.appendChild(option);
        });
        routeRegion.value = "0";
        routeRegion.hidden = groups.length < 2;
        routeRegion.onchange = () => showRegion(Number(routeRegion.value));
      }
      showRegion(0);

      if (!routeIndividual) return;
      allRoutes.forEach((route) => {
        const card = document.createElement("article");
        card.className = "homepage-route-card";
        const heading = document.createElement("div");
        heading.className = "homepage-route-card-heading";
        const date = document.createElement("time");
        const startDate = String(route.activity.start_date_local);
        date.setAttribute("datetime", startDate.replace(" ", "T"));
        date.title = startDate;
        date.textContent = startDate.slice(5, 10).replace("-", ".");
        const distance = document.createElement("span");
        distance.textContent = formatKm(Number(route.activity.distance || 0) / 1000);
        heading.appendChild(date);
        heading.appendChild(distance);
        card.appendChild(heading);
        if (route.points.length > 1) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "0 0 320 200");
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", `${startDate}，${distance.textContent} 跑步路线`);
          drawRoutes(svg, [route]);
          card.appendChild(svg);
        } else {
          const empty = document.createElement("p");
          empty.className = "homepage-route-missing";
          empty.textContent = "暂无 GPS 轨迹";
          card.appendChild(empty);
        }
        routeIndividual.appendChild(card);
      });
    }

    function initRouteTabs() {
      if (!routeOverview || !routeIndividual || !routeOverviewTab || !routeIndividualTab) return;
      const tabs = [routeOverviewTab, routeIndividualTab];
      function selectTab(index) {
        routeOverview.hidden = index !== 0;
        routeIndividual.hidden = index !== 1;
        tabs.forEach((tab, i) => {
          tab.setAttribute("aria-selected", String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
        });
      }
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => selectTab(index));
        tab.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
          selectTab(next);
          tabs[next].focus();
        });
      });
      selectTab(0);
    }

    function renderRunningStats(stats) {
      const safeTotalKm = Number.isFinite(stats.totalKm) ? stats.totalKm : 0;

      runningMonth.textContent = stats.label;
      runningMonth.setAttribute("datetime", stats.monthKey);
      runningValue.textContent = `${safeTotalKm.toFixed(1)} `;
      const targetLabel = document.createElement("span");
      targetLabel.textContent = `/ ${RUNNING_TARGET_KM} km`;
      runningValue.appendChild(targetLabel);
      if (runningPercent) {
        runningPercent.textContent = `${Math.round(
          Math.min((safeTotalKm / RUNNING_TARGET_KM) * 100, 100)
        )}%`;
      }
      runningStatus.textContent =
        safeTotalKm >= RUNNING_TARGET_KM
          ? `${stats.isCurrentMonth ? "本月" : "该月"}目标已完成`
          : safeTotalKm === 0 ? `${stats.isCurrentMonth ? "本月" : "该月"}暂无跑步记录` : `距目标还差 ${Math.max(
              RUNNING_TARGET_KM - safeTotalKm,
              0
            ).toFixed(1)} km`;
      runningProgress.style.width = `${Math.min((safeTotalKm / RUNNING_TARGET_KM) * 100, 100)}%`;
      runningMeter?.setAttribute("aria-valuenow", String(Math.min(safeTotalKm, RUNNING_TARGET_KM)));
      runningMeter?.setAttribute("aria-valuetext", `${safeTotalKm.toFixed(1)} / ${RUNNING_TARGET_KM} km`);
      runningMeter?.setAttribute("aria-label", `${stats.label}跑量目标`);
      runningGrid.setAttribute("aria-label", `${stats.label}每日跑量`);
      runningGrid.innerHTML = "";

      stats.days.forEach((entry) => {
        const title =
          entry.distanceKm > 0
            ? `${entry.dayKey} · ${formatKm(entry.distanceKm)}`
            : `${entry.dayKey} · 当天暂无跑步记录`;
        runningGrid.appendChild(createRunningDayCell(entry.distanceKm, title));
      });
      renderRunningRoutes(stats);
    }

    function renderRunningFallback(message) {
      const fallbackStats = buildEmptyMonthlyStats(new Date());
      renderRunningStats(fallbackStats);
      runningValue.textContent = "—";
      runningPercent.textContent = "—";
      runningGrid.innerHTML = "";
      runningMeter?.removeAttribute("aria-valuenow");
      runningMeter?.setAttribute("aria-valuetext", "跑量暂不可用");
      runningStatus.textContent = message;
    }

    async function initRunningPanel() {
      if (!runningRoot) {
        return;
      }

      try {
        const activities = await fetchRunningActivities();
        const now = new Date();
        const latestMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        let selectedMonth = latestMonth;
        const monthKeys = activities
          .filter((activity) => normalizeActivityType(activity.type) === "running")
          .map((activity) => String(activity.start_date_local || "").slice(0, 7))
          .filter((key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key))
          .sort();
        const firstKey = monthKeys[0];
        const earliestMonth = firstKey
          ? new Date(Number(firstKey.slice(0, 4)), Number(firstKey.slice(5)) - 1, 1)
          : latestMonth;

        function renderSelectedMonth() {
          renderRunningStats(buildMonthlyRunningStats(activities, selectedMonth));
          if (runningPrevious) runningPrevious.disabled = selectedMonth <= earliestMonth;
          if (runningNext) runningNext.disabled = selectedMonth >= latestMonth;
        }
        function changeMonth(offset) {
          const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + offset, 1);
          if (nextMonth < earliestMonth || nextMonth > latestMonth) return;
          selectedMonth = nextMonth;
          renderSelectedMonth();
        }
        runningPrevious?.addEventListener("click", () => changeMonth(-1));
        runningNext?.addEventListener("click", () => changeMonth(1));
        if (runningPrevious) runningPrevious.hidden = false;
        if (runningNext) runningNext.hidden = false;
        renderSelectedMonth();
      } catch (error) {
        console.error(error);
        renderRunningFallback("跑量暂不可用，可前往跑步记录查看。");
      }
    }

    function initCrazyTalkTicker() {
      if (!crazyTalkDataNode || !crazyTalkText || !crazyTalkLink || !crazyTalkNext) {
        return;
      }

      const itemNodes = crazyTalkDataNode.querySelectorAll("[data-crazy-talk-item]");
      const allItems = Array.from(itemNodes).map((node) => ({
        text: node.getAttribute("data-text") || "",
        title: node.getAttribute("data-title") || "",
        url: node.getAttribute("data-url") || "/crazy-talk/",
        sourceRank: Number(node.getAttribute("data-source-rank") || 0),
      }));

      if (allItems.length === 0) {
        return;
      }

      const filesByUrl = new Map();

      allItems.forEach((item) => {
        if (!filesByUrl.has(item.url)) {
          filesByUrl.set(item.url, {
            sourceRank: item.sourceRank,
            items: [],
          });
        }

        filesByUrl.get(item.url).items.push(item);
      });

      const selectedFiles = Array.from(filesByUrl.values())
        .map((file) => {
          const recencyWeight = 1 / Math.sqrt(file.sourceRank + 1);
          const randomValue = Math.max(Math.random(), Number.EPSILON);

          return {
            ...file,
            selectionKey: -Math.log(randomValue) / recencyWeight,
          };
        })
        .sort((left, right) => left.selectionKey - right.selectionKey)
        .slice(0, CRAZY_TALK_FILE_LIMIT);

      const items = selectedFiles.flatMap((file) => file.items);

      for (let index = items.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
      }

      // Start with the latest note, then rotate through the sampled archive.
      let currentIndex = -1;

      function renderCurrentItem() {
        const current = items[currentIndex];
        crazyTalkText.textContent = current.text;
        crazyTalkText.scrollTop = 0;
        crazyTalkLink.textContent = current.title;
        crazyTalkLink.href = current.url;
      }

      function advanceTicker() {
        currentIndex = (currentIndex + 1) % items.length;
        if (items.length > 1 && items[currentIndex].text === crazyTalkText.textContent) {
          currentIndex = (currentIndex + 1) % items.length;
        }
        renderCurrentItem();
      }

      let timer = null;
      function restartTicker() {
        window.clearInterval(timer);
        if (items.length > 1 && !document.hidden) {
          timer = window.setInterval(advanceTicker, CRAZY_TALK_INTERVAL_MS);
        }
      }
      crazyTalkNext.addEventListener("click", function () {
        advanceTicker();
        restartTicker();
      });
      crazyTalkNext.hidden = items.length < 2;
      document.addEventListener("visibilitychange", restartTicker);
      restartTicker();
    }

    function initMemories() {
      const data = document.getElementById("homepage-memories-data");
      const list = document.getElementById("homepage-memories-list");
      const dateLabel = document.getElementById("homepage-memories-date");
      if (!data || !list || !dateLabel) return;

      const records = Array.from(data.querySelectorAll("[data-memory-item]"), (node) => ({
        date: node.getAttribute("data-date"),
        kind: node.getAttribute("data-kind"),
        text: node.getAttribute("data-text"),
        url: node.getAttribute("data-url"),
      }));

      function renderMemories() {
        const today = new Date();
        const year = String(today.getFullYear());
        const anniversary = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        dateLabel.textContent = anniversary.replace("-", ".");
        dateLabel.setAttribute("datetime", `${year}-${anniversary}`);
        const matches = records
          .filter((item) => item.date.slice(5) === anniversary && item.date.slice(0, 4) < year)
          .sort((left, right) => right.date.localeCompare(left.date));

        list.replaceChildren();
        matches.forEach((item) => {
          const article = document.createElement("article");
          article.className = "homepage-memory";
          const date = document.createElement("time");
          date.setAttribute("datetime", item.date);
          date.textContent = `${item.date.slice(0, 4)} · ${item.kind === "blog" ? "文章" : "疯言疯语"}`;
          article.appendChild(date);
          if (item.kind === "blog") {
            const title = document.createElement("h3");
            const link = document.createElement("a");
            link.href = item.url;
            link.textContent = item.text;
            const arrow = document.createElement("span");
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = " ↗";
            link.appendChild(arrow);
            title.appendChild(link);
            article.appendChild(title);
          } else {
            const text = document.createElement("p");
            text.textContent = item.text;
            article.appendChild(text);
          }
          list.appendChild(article);
        });
        if (matches.length === 0) {
          const empty = document.createElement("p");
          empty.className = "homepage-empty";
          empty.textContent = "这一天，还没有往年的记录。";
          list.appendChild(empty);
        }
      }

      renderMemories();
      window.addEventListener("pageshow", renderMemories);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) renderMemories();
      });
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

    initRouteTabs();
    initRunningPanel();
    initCrazyTalkTicker();
    initMemories();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomepage);
  } else {
    initHomepage();
  }
})();
