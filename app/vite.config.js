import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'paymo-settings',
      transformIndexHtml(html) {
        let next=html;
        if (!next.includes('/paymo-design.js')) next=next.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
        if (!next.includes('/paymo-items.js')) next=next.replace('</body>', '<script src="/paymo-items.js"></script>\n</body>');
        if (!next.includes('/paymo-labels.js')) next=next.replace('</body>', '<script src="/paymo-labels.js"></script>\n</body>');
        return next;
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
