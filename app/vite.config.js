import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'paymo-design-settings',
      transformIndexHtml(html) {
        if (html.includes('/paymo-design.js')) return html;
        return html.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
