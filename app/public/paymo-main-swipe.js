(() => {
  const VIEW_ORDER = ['home', 'graph', 'notify', 'menu'];
  const SHADE_START = 0.24;
  let gesture = null;

  function ensureStyle() {
    if (document.getElementById('paymo-main-swipe-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-main-swipe-style';
    style.textContent = `
      .paymo-main-swipe-front{
        position:relative!important;
        z-index:3!important;
        background:var(--page-bg,#000)!important;
        min-height:calc(100dvh - env(safe-area-inset-top) - 142px);
        backface-visibility:hidden;
        will-change:transform;
      }
      .paymo-main-swipe-preview{
        position:absolute;
        left:16px;
        right:16px;
        top:calc(env(safe-area-inset-top) + 18px);
        bottom:calc(106px + env(safe-area-inset-bottom));
        z-index:2;
        pointer-events:none;
        overflow:hidden;
        background:var(--page-bg,#000);
        opacity:${SHADE_START};
        transform:scale(.985);
        transform-origin:center top;
        backface-visibility:hidden;
        will-change:opacity,transform;
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

  function activeMainView() {
    const active = document.querySelector('.view.active');
    return active && VIEW_ORDER.includes(active.id) ? active : null;
  }

  function targetFor(page, direction) {
    const index = VIEW_ORDER.indexOf(page?.id || '');
    if (index < 0) return null;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= VIEW_ORDER.length) return null;
    return document.getElementById(VIEW_ORDER[nextIndex]);
  }

  function makePreview(target) {
    const app = document.querySelector('.app');
    if (!app || !target) return null;
    const preview = target.cloneNode(true);
    preview.removeAttribute('id');
    preview.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    preview.classList.remove('view', 'active');
    preview.classList.add('paymo-main-swipe-preview');
    app.appendChild(preview);
    return preview;
  }

  function beginSwipe(g, dx) {
    const direction = dx < 0 ? 1 : -1;
    const target = targetFor(g.page, direction);
    if (!target) return false;
    const preview = makePreview(target);
    if (!preview) return false;

    g.direction = direction;
    g.targetId = target.id;
    g.preview = preview;
    g.engaged = true;
    g.distance = 0;

    g.page.classList.add('paymo-main-swipe-front');
    g.page.style.transition = 'none';
    g.page.style.transform = 'translate3d(0,0,0)';
    return true;
  }

  function updateSwipe(g, dx) {
    if (!g?.engaged) return;
    const signedDistance = g.direction === 1 ? -dx : dx;
    const distance = Math.max(0, signedDistance);
    g.distance = distance;

    const width = Math.max(g.page?.offsetWidth || window.innerWidth || 1, 1);
    const progress = Math.min(1, distance / (width * .78));
    const translate = g.direction === 1 ? -distance : distance;

    g.page.style.transition = 'none';
    g.page.style.transform = `translate3d(${translate}px,0,0)`;
    if (g.preview) {
      g.preview.style.transition = 'none';
      g.preview.style.opacity = String(SHADE_START + (1 - SHADE_START) * progress);
      g.preview.style.transform = `scale(${.985 + .015 * progress})`;
    }
  }

  function switchTo(targetId) {
    const button = document.querySelector(`.nav-btn[data-view="${targetId}"]`);
    if (button) {
      button.click();
      return;
    }
    document.querySelectorAll('.nav-btn').forEach((item) => item.classList.toggle('active', item.dataset.view === targetId));
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === targetId));
  }

  function cleanup(g) {
    if (!g) return;
    if (g.page) {
      g.page.classList.remove('paymo-main-swipe-front');
      g.page.style.transition = '';
      g.page.style.transform = '';
      g.page.style.willChange = '';
    }
    g.preview?.remove();
  }

  function finishSwipe(g, commit) {
    if (!g?.engaged || !g.page) return cleanup(g);
    const side = g.direction === 1 ? -1 : 1;

    g.page.style.transition = 'transform 220ms cubic-bezier(.22,.8,.3,1)';
    g.page.style.transform = commit ? `translate3d(${side * 100}vw,0,0)` : 'translate3d(0,0,0)';
    if (g.preview) {
      g.preview.style.transition = 'opacity 220ms ease, transform 220ms ease';
      g.preview.style.opacity = commit ? '1' : String(SHADE_START);
      g.preview.style.transform = commit ? 'scale(1)' : 'scale(.985)';
    }

    setTimeout(() => {
      if (commit) switchTo(g.targetId);
      cleanup(g);
    }, 220);
  }

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1 || hasBlockingLayer()) {
      gesture = null;
      return;
    }
    const page = activeMainView();
    if (!page) {
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
      page,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastAt: performance.now(),
      velocityX: 0,
      engaged: false,
      direction: 0,
      targetId: '',
      preview: null,
      distance: 0
    };
  }, { passive:true });

  document.addEventListener('touchmove', (event) => {
    const g = gesture;
    if (!g || event.touches.length !== 1 || hasBlockingLayer()) return;

    const touch = event.touches[0];
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    const now = performance.now();
    const dt = Math.max(1, now - g.lastAt);
    g.velocityX = (touch.clientX - g.lastX) / dt;
    g.lastX = touch.clientX;
    g.lastAt = now;

    if (!g.engaged) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < 10 || ax < ay * 1.18) return;
      if (!beginSwipe(g, dx)) return;
    }

    updateSwipe(g, dx);
    if (event.cancelable) event.preventDefault();
  }, { passive:false });

  document.addEventListener('touchend', (event) => {
    const g = gesture;
    gesture = null;
    if (!g?.engaged || event.changedTouches.length !== 1) return;

    const width = Math.max(g.page?.offsetWidth || window.innerWidth || 1, 1);
    const threshold = Math.min(118, width * .26);
    const velocityTowardTarget = g.direction === 1 ? g.velocityX < -.42 : g.velocityX > .42;
    const commit = g.distance >= threshold || (g.distance >= 44 && velocityTowardTarget);
    finishSwipe(g, commit);
  }, { passive:true });

  document.addEventListener('touchcancel', () => {
    const g = gesture;
    gesture = null;
    if (g?.engaged) finishSwipe(g, false);
  }, { passive:true });

  ensureStyle();
})();
