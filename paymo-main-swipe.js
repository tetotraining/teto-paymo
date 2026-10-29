(() => {
  const VIEW_ORDER = ['home', 'graph', 'notify', 'menu'];
  let currentIndex = 0;
  let gesture = null;
  let viewport = null;
  let track = null;
  let pages = [];
  let resizeObserver = null;

  function ensureStyle() {
    if (document.getElementById('paymo-main-swipe-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-main-swipe-style';
    style.textContent = `
      .paymo-main-viewport{
        position:relative;
        width:calc(100% + 32px);
        margin-left:-16px;
        overflow:hidden;
        touch-action:pan-y;
      }
      .paymo-main-track{
        display:flex;
        align-items:flex-start;
        width:100%;
        transform:translate3d(0,0,0);
        will-change:transform;
      }
      .paymo-main-track>.view{
        display:block!important;
        flex:0 0 100%;
        width:100%;
        min-width:100%;
        padding:0 16px;
        box-sizing:border-box;
        backface-visibility:hidden;
      }
      .paymo-main-edge-shadow{
        position:absolute;
        top:0;
        bottom:0;
        width:13px;
        z-index:8;
        pointer-events:none;
      }
      .paymo-main-edge-shadow.left{
        left:0;
        background:linear-gradient(90deg,rgba(0,0,0,.16),rgba(0,0,0,.06) 42%,rgba(0,0,0,0));
      }
      .paymo-main-edge-shadow.right{
        right:0;
        background:linear-gradient(270deg,rgba(0,0,0,.16),rgba(0,0,0,.06) 42%,rgba(0,0,0,0));
      }
    `;
    document.head.appendChild(style);
  }

  const visible = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';

  function hasBlockingLayer() {
    const selectors = [
      '#backdrop',
      '#historyEditBackdrop',
      '#bulkHistoryFlowShade',
      '#historyDeleteConfirmBackdrop',
      '#duplicateWarningBackdrop',
      '.sheet-backdrop',
      '.history-edit-backdrop',
      '.bulk-history-shade',
      '.history-delete-confirm-backdrop',
      '.duplicate-warning-backdrop'
    ];
    return selectors.some((selector) => Array.from(document.querySelectorAll(selector)).some(visible));
  }

  function width() {
    return Math.max(1, viewport?.clientWidth || document.querySelector('.app')?.clientWidth || window.innerWidth || 1);
  }

  function setViewportHeight(index = currentIndex) {
    if (!viewport || !pages[index]) return;
    const height = Math.ceil(pages[index].scrollHeight || pages[index].getBoundingClientRect().height || 0);
    if (height > 0) viewport.style.height = `${height}px`;
  }

  function setActiveClasses(index) {
    const id = VIEW_ORDER[index];
    pages.forEach((page, i) => page.classList.toggle('active', i === index));
    document.querySelectorAll('.nav-btn').forEach((button) => {
      if (!button.dataset.view) return;
      button.classList.toggle('active', button.dataset.view === id);
    });
  }

  function snapTo(index, animate = true) {
    if (!track) return;
    currentIndex = Math.max(0, Math.min(VIEW_ORDER.length - 1, index));
    track.style.transition = animate ? 'transform 260ms cubic-bezier(.22,.72,.24,1)' : 'none';
    track.style.transform = `translate3d(${-currentIndex * width()}px,0,0)`;
    setActiveClasses(currentIndex);
    setViewportHeight(currentIndex);
    if (animate) {
      setTimeout(() => {
        if (track) track.style.transition = '';
      }, 280);
    } else {
      requestAnimationFrame(() => { if (track) track.style.transition = ''; });
    }
  }

  function setupPager() {
    ensureStyle();
    const app = document.querySelector('.app');
    if (!app || document.getElementById('paymoMainViewport')) return;

    pages = VIEW_ORDER.map((id) => document.getElementById(id));
    if (pages.some((page) => !page)) return;

    const active = pages.findIndex((page) => page.classList.contains('active'));
    currentIndex = active >= 0 ? active : 0;

    viewport = document.createElement('div');
    viewport.id = 'paymoMainViewport';
    viewport.className = 'paymo-main-viewport';

    track = document.createElement('div');
    track.id = 'paymoMainTrack';
    track.className = 'paymo-main-track';

    const first = pages[0];
    app.insertBefore(viewport, first);
    viewport.appendChild(track);
    pages.forEach((page) => track.appendChild(page));

    const leftShadow = document.createElement('div');
    leftShadow.className = 'paymo-main-edge-shadow left';
    const rightShadow = document.createElement('div');
    rightShadow.className = 'paymo-main-edge-shadow right';
    viewport.append(leftShadow, rightShadow);

    snapTo(currentIndex, false);

    resizeObserver = new ResizeObserver(() => setViewportHeight(currentIndex));
    pages.forEach((page) => resizeObserver.observe(page));

    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.nav-btn[data-view]');
      if (!button) return;
      const index = VIEW_ORDER.indexOf(button.dataset.view || '');
      if (index < 0 || index === currentIndex) return;
      requestAnimationFrame(() => snapTo(index, true));
    });

    window.addEventListener('resize', () => snapTo(currentIndex, false));
  }

  document.addEventListener('touchstart', (event) => {
    if (!track || event.touches.length !== 1 || hasBlockingLayer()) {
      gesture = null;
      return;
    }

    const active = document.querySelector('.view.active');
    if (!active || !VIEW_ORDER.includes(active.id)) {
      gesture = null;
      return;
    }

    const target = event.target;
    if (target?.closest?.('.bottom-nav,input,textarea,select,[contenteditable="true"],[data-no-page-swipe]')) {
      gesture = null;
      return;
    }

    const touch = event.touches[0];
    gesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastAt: performance.now(),
      velocityX: 0,
      engaged: false,
      dx: 0
    };
  }, { passive:true });

  document.addEventListener('touchmove', (event) => {
    const g = gesture;
    if (!g || !track || event.touches.length !== 1 || hasBlockingLayer()) return;

    const touch = event.touches[0];
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const now = performance.now();
    const dt = Math.max(1, now - g.lastAt);
    g.velocityX = (touch.clientX - g.lastX) / dt;
    g.lastX = touch.clientX;
    g.lastAt = now;

    if (!g.engaged) {
      if (ax < 9 || ax < ay * 1.15) return;
      g.engaged = true;
      track.style.transition = 'none';
    }

    g.dx = dx;
    const w = width();
    const base = -currentIndex * w;
    let dragX = dx;

    if ((currentIndex === 0 && dx > 0) || (currentIndex === VIEW_ORDER.length - 1 && dx < 0)) {
      dragX *= .18;
    }

    const targetIndex = dx < 0 ? Math.min(VIEW_ORDER.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    const currentHeight = pages[currentIndex]?.scrollHeight || 0;
    const targetHeight = pages[targetIndex]?.scrollHeight || 0;
    if (viewport && targetIndex !== currentIndex) viewport.style.height = `${Math.max(currentHeight, targetHeight)}px`;

    track.style.transform = `translate3d(${base + dragX}px,0,0)`;
    if (event.cancelable) event.preventDefault();
  }, { passive:false });

  document.addEventListener('touchend', (event) => {
    const g = gesture;
    gesture = null;
    if (!g?.engaged || !track || event.changedTouches.length !== 1) return;

    const w = width();
    const distance = Math.abs(g.dx);
    const direction = g.dx < 0 ? 1 : -1;
    const candidate = currentIndex + direction;
    const valid = candidate >= 0 && candidate < VIEW_ORDER.length;
    const fastEnough = direction === 1 ? g.velocityX < -.42 : g.velocityX > .42;
    const commit = valid && (distance >= Math.min(118, w * .26) || (distance >= 42 && fastEnough));

    snapTo(commit ? candidate : currentIndex, true);
  }, { passive:true });

  document.addEventListener('touchcancel', () => {
    const g = gesture;
    gesture = null;
    if (g?.engaged) snapTo(currentIndex, true);
  }, { passive:true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPager, { once:true });
  else setupPager();
})();
