(function () {
  const current = new URL(window.location.href);
  const parameter = "__running_path";
  if (document.documentElement.dataset.runningNotFound === "true") {
    if (!current.pathname.startsWith("/running/") || current.pathname === "/running/") return;
    const entry = new URL("/running/", current.origin);
    entry.searchParams.set(parameter, current.pathname + current.search + current.hash);
    window.location.replace(entry.href);
    return;
  }
  if (!current.searchParams.has(parameter)) return;
  const requested = current.searchParams.get(parameter);
  current.searchParams.delete(parameter);
  let target;
  try { target = new URL(requested, current.origin); } catch (error) { target = current; }
  // A public query parameter may restore only this application's same-origin routes.
  if (target.origin === current.origin && target.pathname.startsWith("/running/")) {
    window.history.replaceState(null, "", target.pathname + target.search + target.hash);
  } else {
    window.history.replaceState(null, "", current.pathname + current.search + current.hash);
  }
})();
