import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          docx: ['docx', 'file-saver'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});
