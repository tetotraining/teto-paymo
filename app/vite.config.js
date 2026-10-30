import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'paymo-settings',
      transformIndexHtml(html) {
        let next=html;
        const splashStyle = `<link rel="preload" href="/paymo-icon-192-v2.png" as="image" type="image/png" />\n<style id="paymo-launch-splash-style">#paymoLaunchSplash{position:fixed;z-index:99999;inset:0;width:100vw;height:100dvh;background:#000;opacity:1}#paymoLaunchSplash img{position:absolute;display:block;width:min(30vw,150px);height:auto;left:50%;top:50%;transform:translate(-50%,-50%);opacity:0;transition:opacity 1s ease}#paymoLaunchSplash img.fade-in{opacity:1}#paymoLaunchSplash img.fade-away{opacity:0}</style>`;
        const splashMarkup = `<div id="paymoLaunchSplash"><img id="paymoLaunchSplashImg" src="/paymo-icon-192-v2.png" alt="" width="150" height="150"></div>`;
        const splashScript = `<script id="paymo-launch-splash-script">(()=>{const splash=document.getElementById('paymoLaunchSplash');const img=document.getElementById('paymoLaunchSplashImg');if(!splash||!img)return;let started=false;const start=()=>{if(started)return;started=true;setTimeout(()=>img.classList.add('fade-in'),1000);setTimeout(()=>{img.classList.remove('fade-in');img.classList.add('fade-away')},4000);setTimeout(()=>splash.remove(),5000)};if(img.complete)start();else{img.addEventListener('load',start,{once:true});img.addEventListener('error',start,{once:true})}})();</script>`;
        if (!next.includes('paymo-launch-splash-style')) next=next.replace('</head>', `${splashStyle}\n</head>`);
        if (!next.includes('id="paymoLaunchSplash"')) next=next.replace('<body>', `<body>\n${splashMarkup}`);
        if (!next.includes('paymo-launch-splash-script')) next=next.replace('</body>', `${splashScript}\n</body>`);
        if (!next.includes('/paymo-mobile-ui.js')) next=next.replace('</head>', '<script src="/paymo-mobile-ui.js"></script>\n</head>');
        if (!next.includes('/paymo-main-swipe.js')) next=next.replace('</head>', '<script src="/paymo-main-swipe.js"></script>\n</head>');
        if (!next.includes('/paymo-edge-shadow.js')) next=next.replace('</head>', '<script src="/paymo-edge-shadow.js"></script>\n</head>');
        if (!next.includes('/paymo-design.js')) next=next.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
        if (!next.includes('/paymo-items.js')) next=next.replace('</body>', '<script src="/paymo-items.js"></script>\n</body>');
        if (!next.includes('/paymo-subpages.js')) next=next.replace('</body>', '<script src="/paymo-subpages.js"></script>\n</body>');
        if (!next.includes('/paymo-labels.js')) next=next.replace('</body>', '<script src="/paymo-labels.js"></script>\n</body>');
        if (!next.includes('/paymo-periods.js')) next=next.replace('</body>', '<script src="/paymo-periods.js"></script>\n</body>');
        if (!next.includes('/paymo-graph-detail.js')) next=next.replace('</body>', '<script src="/paymo-graph-detail.js"></script>\n</body>');
        if (!next.includes('/paymo-history-payment.js')) next=next.replace('</body>', '<script src="/paymo-history-payment.js"></script>\n</body>');
        if (!next.includes('/paymo-installments.js')) next=next.replace('</body>', '<script src="/paymo-installments.js"></script>\n</body>');
        if (!next.includes('/paymo-installments-layout.js')) next=next.replace('</body>', '<script src="/paymo-installments-layout.js"></script>\n</body>');
        if (!next.includes('/paymo-history-api.js')) next=next.replace('</body>', '<script src="/paymo-history-api.js"></script>\n</body>');
        if (!next.includes('/paymo-history-edit.js')) next=next.replace('</body>', '<script src="/paymo-history-edit.js"></script>\n</body>');
        if (!next.includes('/paymo-paid.js')) next=next.replace('</body>', '<script src="/paymo-paid.js"></script>\n</body>');
        if (!next.includes('/paymo-history-delete-confirm.js')) next=next.replace('</body>', '<script src="/paymo-history-delete-confirm.js"></script>\n</body>');
        if (!next.includes('/paymo-ui-rules.js')) next=next.replace('</body>', '<script src="/paymo-ui-rules.js"></script>\n</body>');
        if (!next.includes('/paymo-bulk-history-delete.js')) next=next.replace('</body>', '<script src="/paymo-bulk-history-delete.js"></script>\n</body>');
        if (!next.includes('/paymo-graph-detail-edit.js')) next=next.replace('</body>', '<script src="/paymo-graph-detail-edit.js"></script>\n</body>');
        if (!next.includes('/paymo-graph-detail-size.js')) next=next.replace('</body>', '<script src="/paymo-graph-detail-size.js"></script>\n</body>');
        return next;
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
