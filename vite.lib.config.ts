import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'html-surface-three',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      external: (id) => id === 'three'
        || id.startsWith('three/')
        || id === 'three-html-render'
        || id.startsWith('three-html-render/'),
    },
  },
});
