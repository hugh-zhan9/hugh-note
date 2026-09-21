(function () {
  const toc = document.querySelector('.article-toc');
  if (!toc) return;

  const rail = toc.querySelector('.article-toc-rail');
  const panel = toc.querySelector('.article-toc-panel');
  const links = [...panel.querySelectorAll('a[href^="#"]')];
  const headings = links.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))));
  const lengths = links.map(link => Array.from(link.textContent.trim()).length);
  const longest = Math.max(...lengths, 1);
  const marks = links.map((link, index) => {
    const shortcut = document.createElement('a');
    shortcut.href = link.getAttribute('href');
    shortcut.setAttribute('aria-label', link.textContent.trim());
    const mark = document.createElement('span');
    mark.className = 'article-toc-mark';
    mark.setAttribute('aria-hidden', 'true');
    // Keep short titles visible while preserving the relative length of longer ones.
    mark.style.width = `${Math.max(20, lengths[index] / longest * 100)}%`;
    shortcut.append(mark);
    rail.append(shortcut);
    return mark;
  });
  const wideTables = [...document.querySelectorAll('.article-table-wide')];
  const desktop = matchMedia('(min-width: 1400px)');
  const visible = matchMedia('(min-width: 1000px)');
  let compact = false;
  let current = -1;
  let scheduled = false;

  function revealCurrent() {
    if (current < 0) return;
    for (const [container, item] of [[rail, marks[current]], [panel, links[current]]]) {
      if (container.hidden) continue;
      const bounds = item.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) {
        container.scrollTop += bounds.top - viewport.top - container.clientHeight / 2;
      }
    }
  }

  function setOpen(open) {
    panel.hidden = !open;
    if (open) revealCurrent();
  }

  function close() {
    if (!compact) return;
    if (panel.contains(document.activeElement)) marks[Math.max(current, 0)].parentElement.focus({ preventScroll: true });
    setOpen(false);
  }

  function update() {
    scheduled = false;
    if (!visible.matches) {
      toc.removeAttribute('data-ready');
      return;
    }
    // Wide tables already extend into the gutter: leave that space clear while they pass.
    const rect = toc.getBoundingClientRect();
    const overlapsTable = wideTables.some(table => {
      const bounds = table.getBoundingClientRect();
      return bounds.left < rect.left + 240 && bounds.right > rect.left &&
        bounds.top < innerHeight - 32 && bounds.bottom > rect.top;
    });
    toc.dataset.obscured = String(overlapsTable);
    const nextCompact = !desktop.matches;
    if (nextCompact !== compact || !toc.hasAttribute('data-ready')) {
      compact = nextCompact;
      toc.dataset.compact = String(compact);
      rail.hidden = !compact;
      if (compact && panel.contains(document.activeElement)) marks[Math.max(current, 0)].parentElement.focus({ preventScroll: true });
      setOpen(!compact);
    }
    toc.dataset.ready = '';

    let next = 0;
    headings.forEach((heading, index) => {
      if (heading && heading.getBoundingClientRect().top <= 80) next = index;
    });
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) next = links.length - 1;
    if (next === current) {
      revealCurrent();
      return;
    }
    if (current >= 0) {
      links[current].removeAttribute('aria-current');
      marks[current].parentElement.removeAttribute('aria-current');
      marks[current].classList.remove('is-current');
    }
    links[next].setAttribute('aria-current', 'location');
    marks[next].parentElement.setAttribute('aria-current', 'location');
    marks[next].classList.add('is-current');
    current = next;
    // Scroll only the directory, never the article, when its current item is offscreen.
    revealCurrent();
  }

  function scheduleUpdate() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  }

  rail.addEventListener('focusin', () => {
    if (compact) setOpen(true);
  });
  toc.addEventListener('pointerenter', event => {
    if (compact && event.pointerType === 'mouse') setOpen(true);
  });
  toc.addEventListener('pointerleave', event => {
    if (compact && event.pointerType === 'mouse' && !panel.contains(document.activeElement)) setOpen(false);
  });
  toc.addEventListener('focusout', event => {
    if (compact && !toc.contains(event.relatedTarget)) close();
  });
  toc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && compact) {
      event.preventDefault();
      close();
    }
  });
  panel.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  rail.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('click', event => {
    if (!toc.contains(event.target)) close();
  });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  update();
})();
