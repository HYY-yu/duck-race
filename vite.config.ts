import {defineConfig} from 'vite';
export default defineConfig({optimizeDeps:{entries:['index.html']},build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/three'))return 'three';}}}}});
