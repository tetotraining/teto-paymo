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

  // iPhone-like gestures: dismiss sheets downward, or navigate back from the left edge.
  let start = null;
  const visible = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
  const tapClose = (id) => document.getElementById(id)?.click();
  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) { start = null; return; }
    const t = event.touches[0];
    const editor = document.getElementById('historyEditSheet');
    const add = document.getElementById('sheet');
    const activeSheet = visible(editor) ? editor : visible(add) ? add : null;
    start = { x: t.clientX, y: t.clientY, at: event.target, sheet: activeSheet,
      scrollTop: activeSheet?.scrollTop || 0 };
  }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (!start || event.changedTouches.length !== 1) { start = null; return; }
    const s = start; start = null;
    const t = event.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (s.sheet) {
      if (!s.sheet.contains(s.at)) return;
      if (dy > 95 && Math.abs(dy) > Math.abs(dx) * 1.35 &&
          s.scrollTop <= 2 && s.sheet.scrollTop <= 2 &&
          !s.at.closest('input,textarea,select')) {
        if (s.sheet.id === 'historyEditSheet') tapClose('historyEditClose');
        else tapClose('closeBtn');
      } else if (s.x < 35 && dx > 90 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        if (s.sheet.id === 'historyEditSheet') tapClose('historyEditClose');
        else tapClose('closeBtn');
      }
      return;
    }
    if (s.x > 35 || dx < 95 || Math.abs(dx) <= Math.abs(dy) * 1.35) return;
    if (s.at.closest('input,textarea,select,[contenteditable="true"]')) return;
    const active = document.querySelector('.view.active');
    if (!active || active.id === 'home') return;
    document.querySelector('.nav-btn[data-view="home"]')?.click();
  }, { passive: true });
  document.addEventListener('touchcancel', () => { start = null; }, { passive: true });
})();
