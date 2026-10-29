import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'paymo-settings',
      transformIndexHtml(html) {
        let next=html;
        if (!next.includes('/paymo-mobile-ui.js')) next=next.replace('</head>', '<script src="/paymo-mobile-ui.js"></script>\n</head>');
        if (!next.includes('/paymo-main-swipe.js')) next=next.replace('</head>', '<script src="/paymo-main-swipe.js"></script>\n</head>');
        if (!next.includes('/paymo-design.js')) next=next.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
        if (!next.includes('/paymo-items.js')) next=next.replace('</body>', '<script src="/paymo-items.js"></script>\n</body>');
        if (!next.includes('/paymo-labels.js')) next=next.replace('</body>', '<script src="/paymo-labels.js"></script>\n</body>');
        if (!next.includes('/paymo-periods.js')) next=next.replace('</body>', '<script src="/paymo-periods.js"></script>\n</body>');
        if (!next.includes('/paymo-history-payment.js')) next=next.replace('</body>', '<script src="/paymo-history-payment.js"></script>\n</body>');
        if (!next.includes('/paymo-installments.js')) next=next.replace('</body>', '<script src="/paymo-installments.js"></script>\n</body>');
        if (!next.includes('/paymo-installments-layout.js')) next=next.replace('</body>', '<script src="/paymo-installments-layout.js"></script>\n</body>');
        if (!next.includes('/paymo-history-api.js')) next=next.replace('</body>', '<script src="/paymo-history-api.js"></script>\n</body>');
        if (!next.includes('/paymo-history-edit.js')) next=next.replace('</body>', '<script src="/paymo-history-edit.js"></script>\n</body>');
        if (!next.includes('/paymo-paid.js')) next=next.replace('</body>', '<script src="/paymo-paid.js"></script>\n</body>');
        if (!next.includes('/paymo-history-delete-confirm.js')) next=next.replace('</body>', '<script src="/paymo-history-delete-confirm.js"></script>\n</body>');
        if (!next.includes('/paymo-ui-rules.js')) next=next.replace('</body>', '<script src="/paymo-ui-rules.js"></script>\n</body>');
        if (!next.includes('/paymo-bulk-history-delete.js')) next=next.replace('</body>', '<script src="/paymo-bulk-history-delete.js"></script>\n</body>');
        return next;
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
