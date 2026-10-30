export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();

  // iOS home-screen apps only let the page paint behind the status bar when
  // black-translucent is used. Keep this static, then let --page-bg switch
  // between light/dark without reloading the app.
  html = html.replace(
    /<meta name="apple-mobile-web-app-status-bar-style" content="[^"]*" \/>/,
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'
  );
  html = html.replace(
    /document\.querySelector\('meta\[name="apple-mobile-web-app-status-bar-style"\]'\)\.content=isDark\?'black':'default';/g,
    'document.querySelector(\'meta[name="apple-mobile-web-app-status-bar-style"]\').content=\'black-translucent\';'
  );

  const statusSafeAreaStyle = `<style id="paymo-status-safe-area-style">html,body{background:var(--page-bg,#050605)!important}body::before{content:"";position:fixed;z-index:99990;top:0;left:0;right:0;height:env(safe-area-inset-top);background:var(--page-bg,#050605);pointer-events:none;transition:background-color .18s ease}</style>`;
  if (!html.includes('paymo-status-safe-area-style')) html = html.replace('</head>', `${statusSafeAreaStyle}\n</head>`);

  const splashStyle = `<link rel="preload" href="/paymo-icon-192-v2.png" as="image" type="image/png" />\n<style id="paymo-launch-splash-style">#paymoLaunchSplash{position:fixed;z-index:99999;inset:0;width:100vw;height:100dvh;background:#000;opacity:1}#paymoLaunchSplash img{position:absolute;display:block;width:min(30vw,150px);height:auto;left:50%;top:50%;transform:translate(-50%,-50%);opacity:0;transition:opacity 1s ease}#paymoLaunchSplash img.fade-in{opacity:1}#paymoLaunchSplash img.fade-away{opacity:0}</style>`;
  const splashMarkup = `<div id="paymoLaunchSplash"><img id="paymoLaunchSplashImg" src="/paymo-icon-192-v2.png" alt="" width="150" height="150"></div>`;
  const splashScript = `<script id="paymo-launch-splash-script">(()=>{const splash=document.getElementById('paymoLaunchSplash');const img=document.getElementById('paymoLaunchSplashImg');if(!splash||!img)return;let started=false;const start=()=>{if(started)return;started=true;setTimeout(()=>img.classList.add('fade-in'),1000);setTimeout(()=>{img.classList.remove('fade-in');img.classList.add('fade-away')},4000);setTimeout(()=>splash.remove(),5000)};if(img.complete)start();else{img.addEventListener('load',start,{once:true});img.addEventListener('error',start,{once:true})}})();</script>`;
  if (!html.includes('paymo-launch-splash-style')) html = html.replace('</head>', `${splashStyle}\n</head>`);
  if (!html.includes('id="paymoLaunchSplash"')) html = html.replace('<body>', `<body>\n${splashMarkup}`);
  if (!html.includes('paymo-launch-splash-script')) html = html.replace('</body>', `${splashScript}\n</body>`);
  if (!html.includes('/paymo-mobile-ui.js')) html = html.replace('</head>', '<script src="/paymo-mobile-ui.js"></script>\n</head>');
  if (!html.includes('/paymo-main-swipe.js')) html = html.replace('</head>', '<script src="/paymo-main-swipe.js"></script>\n</head>');
  if (!html.includes('/paymo-edge-shadow.js')) html = html.replace('</head>', '<script src="/paymo-edge-shadow.js"></script>\n</head>');
  if (!html.includes('/paymo-d1.js')) html = html.replace('</body>', '<script src="/paymo-d1.js"></script>\n</body>');
  if (!html.includes('/paymo-design.js')) html = html.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
  if (!html.includes('/paymo-items.js')) html = html.replace('</body>', '<script src="/paymo-items.js"></script>\n</body>');
  if (!html.includes('/paymo-subpages.js')) html = html.replace('</body>', '<script src="/paymo-subpages.js"></script>\n</body>');
  if (!html.includes('/paymo-labels.js')) html = html.replace('</body>', '<script src="/paymo-labels.js"></script>\n</body>');
  if (!html.includes('/paymo-periods.js')) html = html.replace('</body>', '<script src="/paymo-periods.js"></script>\n</body>');
  if (!html.includes('/paymo-graph-detail.js')) html = html.replace('</body>', '<script src="/paymo-graph-detail.js"></script>\n</body>');
  if (!html.includes('/paymo-history-payment.js')) html = html.replace('</body>', '<script src="/paymo-history-payment.js"></script>\n</body>');
  if (!html.includes('/paymo-installments.js')) html = html.replace('</body>', '<script src="/paymo-installments.js"></script>\n</body>');
  if (!html.includes('/paymo-installments-layout.js')) html = html.replace('</body>', '<script src="/paymo-installments-layout.js"></script>\n</body>');
  if (!html.includes('/paymo-history-api.js')) html = html.replace('</body>', '<script src="/paymo-history-api.js"></script>\n</body>');
  if (!html.includes('/paymo-history-edit.js')) html = html.replace('</body>', '<script src="/paymo-history-edit.js"></script>\n</body>');
  if (!html.includes('/paymo-paid.js')) html = html.replace('</body>', '<script src="/paymo-paid.js"></script>\n</body>');
  if (!html.includes('/paymo-history-delete-confirm.js')) html = html.replace('</body>', '<script src="/paymo-history-delete-confirm.js"></script>\n</body>');
  if (!html.includes('/paymo-ui-rules.js')) html = html.replace('</body>', '<script src="/paymo-ui-rules.js"></script>\n</body>');
  if (!html.includes('/paymo-bulk-history-delete.js')) html = html.replace('</body>', '<script src="/paymo-bulk-history-delete.js"></script>\n</body>');
  if (!html.includes('/paymo-graph-detail-edit.js')) html = html.replace('</body>', '<script src="/paymo-graph-detail-edit.js"></script>\n</body>');
  if (!html.includes('/paymo-graph-detail-size.js')) html = html.replace('</body>', '<script src="/paymo-graph-detail-size.js"></script>\n</body>');

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
