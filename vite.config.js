import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{main:'index.html',fixtures:'visual-fixtures.html'}}},server:{host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:false}}}});

