import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        experimental: resolve(
          import.meta.dirname,
          'src/experimental.ts',
        ),
      },
      formats: ['es'],
      fileName: (_format, entryName) => (
        entryName === 'index'
          ? 'html-surface-three.js'
          : `${entryName}.js`
      ),
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
