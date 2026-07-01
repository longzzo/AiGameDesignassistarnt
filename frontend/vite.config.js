import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 페이지는 /<repo>/ 하위 경로로 서빙된다.
  // 배포 빌드에서 VITE_BASE=/GameGoal/ 처럼 주입한다(기본값 '/'는 로컬/루트 배포용).
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 같은 LAN/Tailscale의 다른 기기에서 접속 가능하도록 모든 IPv4 인터페이스에 바인딩.
    host: "0.0.0.0",
    // 호스트명(예: Tailscale MagicDNS *.ts.net)으로 접속해도 막히지 않게.
    allowedHosts: true,
    // 백엔드(FastAPI)로의 프록시: 프론트에서 /api 호출 시 8000번으로 전달
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
