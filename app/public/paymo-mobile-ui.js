(() => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
    );
  }

  if (!document.getElementById('paymo-mobile-ui-style')) {
    const style = document.createElement('style');
    style.id = 'paymo-mobile-ui-style';
    style.textContent = `
      html,body,.sheet,.history-edit-sheet{
        scrollbar-width:none!important;
        -ms-overflow-style:none!important;
      }
      html::-webkit-scrollbar,
      body::-webkit-scrollbar,
      .sheet::-webkit-scrollbar,
      .history-edit-sheet::-webkit-scrollbar{
        display:none!important;
        width:0!important;
        height:0!important;
      }
      html,body{
        touch-action:pan-x pan-y;
        overscroll-behavior-x:none;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });

  // Interactive sheet gestures: follow the finger, then dismiss or spring back.
  let gesture = null;
  const visible = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
  const reset = (g, animate = true) => {
    if (!g?.sheet) return;
    const el = g.sheet;
    el.style.transition = animate ? 'transform 240ms cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = 'translateX(-50%)';
    el.style.willChange = '';
    if (animate) setTimeout(() => { if (el.style.transform === 'translateX(-50%)') el.style.transition = ''; }, 260);
    else el.style.transition = '';
  };
  const dismiss = g => {
    const el = g.sheet;
    el.style.transition = 'transform 220ms cubic-bezier(.25,.8,.4,1)';
    el.style.transform = g.axis === 'x' ? 'translateX(calc(-50% + 110vw))' : 'translate(-50%, 110dvh)';
    setTimeout(() => {
      document.getElementById(el.id === 'historyEditSheet' ? 'historyEditClose' : 'closeBtn')?.click();
      el.style.transition = 'none';
      el.style.transform = 'translateX(-50%)';
      requestAnimationFrame(() => { el.style.transition = ''; el.style.willChange = ''; });
    }, 220);
  };

  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { gesture = null; return; }
    const t = event.touches[0];
    const editor = document.getElementById('historyEditSheet');
    const add = document.getElementById('sheet');
    const sheet = visible(editor) ? editor : visible(add) ? add : null;
    gesture = {
      x: t.clientX,
      y: t.clientY,
      at: event.target,
      sheet,
      top: sheet?.scrollTop || 0,
      axis: null,
      distance: 0,
      time: Date.now()
    };
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    const g = gesture;
    if (!g || event.touches.length !== 1) return;

    if (!g.sheet) {
      const active = document.querySelector('.view.active');
      if (
        g.x > 35 ||
        !['design', 'itemRegistration'].includes(active?.id) ||
        g.at.closest('input,textarea,select,button,[contenteditable="true"]')
      ) return;

      const t = event.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (dx < 8 || dx < Math.abs(dy) * 1.3) return;

      g.page = active;
      g.axis = 'page';
      g.distance = dx;
      active.style.transition = 'none';
      active.style.transform = 'translateX(' + dx + 'px)';
      active.style.willChange = 'transform';
      if (event.cancelable) event.preventDefault();
      return;
    }

    if (!g.sheet.contains(g.at)) return;
    const t = event.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    if (!g.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return;
      const interactive = g.at.closest('input,textarea,select,button,[contenteditable="true"]');
      if (
        dy > 0 &&
        Math.abs(dy) > Math.abs(dx) * 1.25 &&
        g.top <= 2 &&
        g.sheet.scrollTop <= 2
      ) g.axis = 'y';
      else if (!interactive && g.x < 35 && dx > 0 && dx > Math.abs(dy) * 1.25) g.axis = 'x';
      else return;

      g.sheet.style.transition = 'none';
      g.sheet.style.willChange = 'transform';
    }

    g.distance = Math.max(0, g.axis === 'y' ? dy : dx);
    if (g.axis === 'y') g.sheet.style.transform = 'translate(-50%, ' + g.distance + 'px)';
    else g.sheet.style.transform = 'translateX(calc(-50% + ' + g.distance + 'px))';
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', event => {
    const g = gesture;
    gesture = null;
    if (!g || event.changedTouches.length !== 1) return;

    if (g.page) {
      const page = g.page;
      const commit = g.distance > Math.min(140, page.offsetWidth * .28);
      page.style.transition = 'transform 220ms ease-out';
      page.style.transform = commit ? 'translateX(100vw)' : 'translateX(0)';
      setTimeout(() => {
        if (commit) document.getElementById(page.id === 'design' ? 'designBack' : 'itemRegisterBack')?.click();
        page.style.transition = '';
        page.style.transform = '';
        page.style.willChange = '';
      }, 220);
      return;
    }

    if (g.sheet) {
      if (g.axis) {
        if (
          g.distance > Math.min(150, (g.axis === 'y' ? g.sheet.offsetHeight : g.sheet.offsetWidth) * .28) ||
          (g.distance > 65 && Date.now() - g.time < 300)
        ) dismiss(g);
        else reset(g);
      }
      return;
    }

    // Main bottom-nav views intentionally ignore horizontal swipe gestures.
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    const g = gesture;
    gesture = null;
    if (g?.page) {
      g.page.style.transition = '';
      g.page.style.transform = '';
      g.page.style.willChange = '';
    }
    reset(g);
  }, { passive: true });
})();
