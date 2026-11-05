(() => {
  'use strict';

  // Isolated navigation enhancement. Remove this script + stylesheet to revert.
  const TAB_LABELS = {
    home: 'ホーム',
    graph: 'グラフ',
    categorySpend: '項目別履歴',
    menu: 'メニュー'
  };
  const TAB_IDS = Object.keys(TAB_LABELS);
  let nav = null;
  let pill = null;
  let navObserver = null;
  let drag = null;
  let syncFrame = 0;
  let lastCenter = null;
  let ignoreNativeClickUntil = 0;

  function validButton(button) {
    return !!button && TAB_IDS.includes(button.dataset.view) && button.matches('.nav-btn[data-view]');
  }

  function centerOf(button) {
    const outer = nav.getBoundingClientRect();
    const inner = button.getBoundingClientRect();
    return inner.left - outer.left + inner.width / 2;
  }

  function currentLeft() {
    const left = parseFloat(getComputedStyle(pill).left);
    return Number.isFinite(left) ? left : 0;
  }

  function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  }

  function moveTo(x, animated = true) {
    if (!pill || !pill.isConnected) return;
    const from = currentLeft();
    const distance = Math.abs(from - x);
    const duration = reducedMotion() || !animated ? 0 : Math.min(480, Math.max(280, 280 + distance * .38));
    pill.style.transition = duration
      ? 'left ' + Math.round(duration) + 'ms cubic-bezier(.22,.8,.25,1)'
      : 'none';
    pill.style.left = x + 'px';
    lastCenter = x;
  }

  function activeButton() {
    const selected = nav?.querySelector('.nav-btn.active[data-view]');
    if (validButton(selected)) return selected;
    const activeView = document.querySelector('.view.active');
    const fallback = activeView && nav?.querySelector('.nav-btn[data-view="' + activeView.id + '"]');
    return validButton(fallback) ? fallback : nav?.querySelector('.nav-btn[data-view="home"]');
  }

  function syncPill(animate = true) {
    if (!nav || !pill || !pill.isConnected || drag?.engaged) return;
    const selected = activeButton();
    if (!selected) return;
    const destination = centerOf(selected);
    if (!pill.dataset.ready) {
      const initial = lastCenter ?? destination;
      pill.style.transition = 'none';
      pill.style.left = initial + 'px';
      pill.dataset.ready = '1';
      if (Math.abs(initial - destination) > .5) {
        requestAnimationFrame(() => moveTo(destination, animate));
      }
    } else {
      if (Math.abs(currentLeft() - destination) > .5) moveTo(destination, animate);
      else lastCenter = destination;
    }
  }

  function queueSync() {
    if (syncFrame) return;
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      if (!nav || !nav.isConnected) {
        mount();
        return;
      }
      addLabels();
      if (!pill?.isConnected) mount();
      else syncPill();
    });
  }

  function addLabels() {
    if (!nav) return;
    for (const button of nav.querySelectorAll('.nav-btn[data-view]')) {
      if (!validButton(button) || button.querySelector('.paymo-pill-label')) continue;
      const label = document.createElement('span');
      label.className = 'paymo-pill-label';
      label.textContent = TAB_LABELS[button.dataset.view];
      label.setAttribute('aria-hidden', 'true');
      button.appendChild(label);
    }
  }

  function mount() {
    const target = document.querySelector('.bottom-nav');
    if (!target) return;
    if (nav !== target) {
      navObserver?.disconnect();
      nav = target;
      pill = null;
    }
    nav.classList.add('paymo-sliding-nav');
    addLabels();
    pill = nav.querySelector(':scope > .paymo-sliding-pill');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'paymo-sliding-pill';
      pill.setAttribute('aria-hidden', 'true');
      nav.prepend(pill);
    }
    if (!navObserver || !navObserver._paymoTarget || navObserver._paymoTarget !== nav) {
      navObserver?.disconnect();
      navObserver = new MutationObserver(queueSync);
      navObserver.observe(nav, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
      navObserver._paymoTarget = nav;
    }
    syncPill(false);
  }

  function buttonsFor(gesture) {
    return Array.from(gesture.nav.querySelectorAll('.nav-btn[data-view]')).filter(validButton);
  }

  function positionFor(gesture, clientX) {
    const positions = gesture.buttons.map(centerOf);
    return Math.max(Math.min(...positions), Math.min(Math.max(...positions),
      gesture.origin + clientX - gesture.startX));
  }

  function onPointerDown(event) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const button = event.target?.closest?.('.bottom-nav .nav-btn[data-view]');
    if (!validButton(button) || !nav || !pill || !nav.contains(button)) return;

    // Do not limit drag initiation to selected/active items.
    const active = activeButton();
    drag = {
      pointerId: event.pointerId,
      nav,
      pill,
      buttons: [],
      startX: event.clientX,
      startY: event.clientY,
      origin: button === active ? currentLeft() : centerOf(button),
      current: currentLeft(),
      engaged: false
    };
    drag.buttons = buttonsFor(drag);
  }

  function onPointerMove(event) {
    const g = drag;
    if (!g || event.pointerId !== g.pointerId) return;
    if (!g.nav.isConnected || g.pill !== pill) {
      drag = null;
      mount();
      return;
    }
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.engaged) {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) {
        drag = null; // vertical scrolling remains a native gesture
        return;
      }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      g.engaged = true;
      g.pill.classList.add('is-dragging');
    }
    g.current = positionFor(g, event.clientX);
    moveTo(g.current, false);
  }

  function finishDrag(g, x, commit) {
    g.pill.classList.remove('is-dragging');
    const active = activeButton();
    if (!commit || !g.buttons.length) {
      if (active) moveTo(centerOf(active), true);
      return;
    }
    const nearest = g.buttons.reduce((best, button) =>
      Math.abs(centerOf(button) - x) < Math.abs(centerOf(best) - x)
        ? button : best
    );
    if (!nearest || !nearest.isConnected) {
      if (active) moveTo(centerOf(active), true);
      return;
    }
    if (nearest === active) {
      moveTo(centerOf(active), true);
    } else {
      // Reuse Paymo's existing click handlers rather than replacing routing.
      nearest.click();
      moveTo(centerOf(nearest), true);
    }
  }

  function onPointerUp(event) {
    const g = drag;
    if (!g || event.pointerId !== g.pointerId) return;
    drag = null;
    if (!g.nav.isConnected || g.pill !== pill) return;
    if (!g.engaged) return; // keep the native tap and active-tab scroll-to-top
    ignoreNativeClickUntil = performance.now() + 500;
    const x = positionFor(g, event.clientX);
    g.current = x;
    moveTo(x, false);
    finishDrag(g, x, true);
  }

  function onPointerCancel(event) {
    const g = drag;
    if (!g || event.pointerId !== g.pointerId) return;
    drag = null;
    if (!g.engaged) return;
    ignoreNativeClickUntil = performance.now() + 500;
    finishDrag(g, g.current, false);
  }

  // Suppress only the browser's click generated after a drag, never our
  // deliberate nearest.click(), nor ordinary taps including re-taps.
  document.addEventListener('click', (event) => {
    if (!event.isTrusted || performance.now() > ignoreNativeClickUntil) return;
    if (!event.target?.closest?.('.bottom-nav .nav-btn[data-view]')) return;
    ignoreNativeClickUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerup', onPointerUp, { passive: true });
  document.addEventListener('pointercancel', onPointerCancel, { passive: true });

  window.addEventListener('resize', () => {
    if (drag?.engaged) return;
    if (nav?.isConnected && pill?.isConnected) {
      const active = activeButton();
      if (active) moveTo(centerOf(active), false);
    }
  }, { passive: true });

  function init() {
    mount();
    // Navigation can be replaced without losing the active pill's position.
    new MutationObserver(() => {
      if (document.querySelector('.bottom-nav') !== nav) mount();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
