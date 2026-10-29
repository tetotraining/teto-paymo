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
      .paymo-swipe-front{
        position:relative!important;
        z-index:2!important;
        background:var(--page-bg,#000)!important;
        min-height:calc(100dvh - env(safe-area-inset-top) - 142px);
      }
      .paymo-swipe-preview{
        position:absolute;
        left:16px;
        right:16px;
        top:calc(env(safe-area-inset-top) + 18px);
        bottom:calc(106px + env(safe-area-inset-bottom));
        z-index:1;
        pointer-events:none;
        overflow:hidden;
        background:var(--page-bg,#000);
        opacity:.16;
        transform:scale(.985);
        transform-origin:center top;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('gesturestart', event => event.preventDefault(), { passive:false });
  document.addEventListener('gesturechange', event => event.preventDefault(), { passive:false });
  document.addEventListener('gestureend', event => event.preventDefault(), { passive:false });
  document.addEventListener('dblclick', event => event.preventDefault(), { passive:false });

  let gesture = null;
  const visible = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none';

  const resetSheet = (g, animate = true) => {
    if (!g?.sheet) return;
    const el = g.sheet;
    el.style.transition = animate ? 'transform 240ms cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = 'translateX(-50%)';
    el.style.willChange = '';
    if (animate) setTimeout(() => {
      if (el.style.transform === 'translateX(-50%)') el.style.transition = '';
    }, 260);
    else el.style.transition = '';
  };

  const dismissSheet = g => {
    const el = g.sheet;
    el.style.transition = 'transform 220ms cubic-bezier(.25,.8,.4,1)';
    el.style.transform = g.axis === 'x'
      ? 'translateX(calc(-50% + 110vw))'
      : 'translate(-50%, 110dvh)';
    setTimeout(() => {
      document.getElementById(el.id === 'historyEditSheet' ? 'historyEditClose' : 'closeBtn')?.click();
      el.style.transition = 'none';
      el.style.transform = 'translateX(-50%)';
      requestAnimationFrame(() => {
        el.style.transition = '';
        el.style.willChange = '';
      });
    }, 220);
  };

  const pageBackTarget = page => ['design','itemRegistration'].includes(page?.id) ? 'menu' : '';

  const beginPageSwipe = (g, page) => {
    const targetId = pageBackTarget(page);
    const target = document.getElementById(targetId);
    const app = document.querySelector('.app');
    if (!target || !app) return false;

    const preview = target.cloneNode(true);
    preview.removeAttribute('id');
    preview.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    preview.classList.remove('view','active');
    preview.classList.add('paymo-swipe-preview');
    app.appendChild(preview);

    page.classList.add('paymo-swipe-front');
    page.style.transition = 'none';
    page.style.willChange = 'transform';

    g.page = page;
    g.preview = preview;
    g.axis = 'page';
    return true;
  };

  const updatePageSwipe = (g, distance) => {
    g.distance = Math.max(0, distance);
    const width = Math.max(g.page?.offsetWidth || 1, 1);
    const progress = Math.min(1, g.distance / (width * .72));
    g.page.style.transform = `translateX(${g.distance}px)`;
    if (g.preview) {
      g.preview.style.opacity = String(.16 + progress * .84);
      g.preview.style.transform = `scale(${.985 + progress * .015})`;
    }
  };

  const cleanupPageSwipe = g => {
    if (!g) return;
    if (g.page) {
      g.page.classList.remove('paymo-swipe-front');
      g.page.style.transition = '';
      g.page.style.transform = '';
      g.page.style.willChange = '';
    }
    g.preview?.remove();
  };

  const finishPageSwipe = (g, commit) => {
    const page = g.page;
    const preview = g.preview;
    page.style.transition = 'transform 220ms cubic-bezier(.22,.8,.3,1)';
    page.style.transform = commit ? 'translateX(100vw)' : 'translateX(0)';
    if (preview) {
      preview.style.transition = 'opacity 220ms ease, transform 220ms ease';
      preview.style.opacity = commit ? '1' : '0.16';
      preview.style.transform = commit ? 'scale(1)' : 'scale(.985)';
    }
    setTimeout(() => {
      if (commit) {
        document.getElementById(page.id === 'design' ? 'designBack' : 'itemRegisterBack')?.click();
      }
      cleanupPageSwipe(g);
    }, 220);
  };

  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) {
      gesture = null;
      return;
    }
    const t = event.touches[0];
    const editor = document.getElementById('historyEditSheet');
    const add = document.getElementById('sheet');
    const sheet = visible(editor) ? editor : visible(add) ? add : null;
    gesture = {
      x:t.clientX,
      y:t.clientY,
      at:event.target,
      sheet,
      top:sheet?.scrollTop || 0,
      axis:null,
      distance:0,
      time:Date.now(),
      page:null,
      preview:null
    };
  }, { passive:true });

  document.addEventListener('touchmove', event => {
    const g = gesture;
    if (!g || event.touches.length !== 1) return;

    const t = event.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    if (g.page) {
      updatePageSwipe(g, dx);
      if (event.cancelable) event.preventDefault();
      return;
    }

    if (!g.sheet) {
      const active = document.querySelector('.view.active');
      if (
        g.x > 35 ||
        !pageBackTarget(active) ||
        g.at.closest('input,textarea,select,button,[contenteditable="true"]') ||
        dx < 8 ||
        dx < Math.abs(dy) * 1.3
      ) return;

      if (!beginPageSwipe(g, active)) return;
      updatePageSwipe(g, dx);
      if (event.cancelable) event.preventDefault();
      return;
    }

    if (!g.sheet.contains(g.at)) return;

    if (!g.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return;
      const interactive = g.at.closest('input,textarea,select,button,[contenteditable="true"]');
      if (
        dy > 0 &&
        Math.abs(dy) > Math.abs(dx) * 1.25 &&
        g.top <= 2 &&
        g.sheet.scrollTop <= 2
      ) {
        g.axis = 'y';
      } else if (
        g.sheet.id === 'historyEditSheet' &&
        !interactive &&
        g.x < 35 &&
        dx > 0 &&
        dx > Math.abs(dy) * 1.25
      ) {
        g.axis = 'x';
      } else {
        return;
      }

      g.sheet.style.transition = 'none';
      g.sheet.style.willChange = 'transform';
    }

    g.distance = Math.max(0, g.axis === 'y' ? dy : dx);
    if (g.axis === 'y') g.sheet.style.transform = `translate(-50%, ${g.distance}px)`;
    else g.sheet.style.transform = `translateX(calc(-50% + ${g.distance}px))`;
    if (event.cancelable) event.preventDefault();
  }, { passive:false });

  document.addEventListener('touchend', event => {
    const g = gesture;
    gesture = null;
    if (!g || event.changedTouches.length !== 1) return;

    if (g.page) {
      const commit = g.distance > Math.min(140, g.page.offsetWidth * .28);
      finishPageSwipe(g, commit);
      return;
    }

    if (g.sheet) {
      if (g.axis) {
        const dismiss =
          g.distance > Math.min(150, (g.axis === 'y' ? g.sheet.offsetHeight : g.sheet.offsetWidth) * .28) ||
          (g.distance > 65 && Date.now() - g.time < 300);
        if (dismiss) dismissSheet(g);
        else resetSheet(g);
      }
      return;
    }

    // Main bottom-nav views intentionally ignore horizontal swipe gestures.
  }, { passive:true });

  document.addEventListener('touchcancel', () => {
    const g = gesture;
    gesture = null;
    if (g?.page) finishPageSwipe(g, false);
    else resetSheet(g);
  }, { passive:true });
})();
