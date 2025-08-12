import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {
          'app-core': ['./js/app.js', './js/utils.js'],
          'app-storage': ['./js/storage.js', './js/api.js'],
          'app-ui': ['./js/ui.js', './js/auth.js']
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      port: 5174
    }
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});