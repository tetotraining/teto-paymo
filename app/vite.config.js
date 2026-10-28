import { defineConfig } from 'vite';

export default defineConfig({
  root: '..',
  publicDir: false,
  plugins: [
    {
      name: 'paymo-d1-client',
      transformIndexHtml(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module', src: '/paymo-d1.js' },
              injectTo: 'body'
            }
          ]
        };
      }
    }
  ],
  build: {
    outDir: 'app/dist',
    emptyOutDir: true
  }
});
