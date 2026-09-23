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
  let preview = -1;
  let scheduled = false;

  function revealItem(container, item) {
    if (container.hidden || !item) return;
    const bounds = item.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) {
      container.scrollTop += bounds.top - viewport.top - container.clientHeight / 2;
    }
  }

  function revealCurrent() {
    if (preview < 0) revealItem(rail, marks[current]);
    revealItem(panel, links[preview >= 0 ? preview : current]);
  }

  function setPreview(index) {
    if (preview >= 0) links[preview].classList.remove('is-preview');
    preview = index;
    if (preview >= 0) links[preview].classList.add('is-preview');
    panel.classList.toggle('has-preview', preview >= 0);
  }

  function setOpen(open) {
    panel.hidden = !open;
    if (open) revealItem(panel, links[preview >= 0 ? preview : current]);
    else setPreview(-1);
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
      setPreview(-1);
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

  function previewShortcut(event) {
    if (!compact) return;
    const shortcut = event.target.closest('a');
    if (!shortcut) return;
    setPreview(marks.indexOf(shortcut.firstElementChild));
    setOpen(true);
  }

  rail.addEventListener('focusin', previewShortcut);
  rail.addEventListener('pointerover', event => {
    if (event.pointerType === 'mouse') previewShortcut(event);
  });
  panel.addEventListener('pointerover', event => {
    if (event.pointerType === 'mouse' && event.target.closest('a')) setPreview(-1);
  });
  panel.addEventListener('focusin', () => setPreview(-1));
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
