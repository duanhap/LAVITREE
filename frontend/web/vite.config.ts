import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import dns from 'node:dns/promises'
import net from 'node:net'

function isPrivateOrReservedIp(rawIp: string): boolean {
  let ip = rawIp.trim().toLowerCase()
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7)
  }
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
    return false
  }
  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true
    if (ip.startsWith('ff')) return true
    return false
  }
  return true
}

async function validatePublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl.trim())
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ giao thức http:// hoặc https://')
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('URL không được phép trỏ tới địa chỉ nội bộ (SSRF protection)')
  }
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('URL không được phép trỏ tới IP mạng nội bộ (SSRF protection)')
    }
    return parsed
  }
  const records = await dns.lookup(host, { all: true })
  if (!records.length || records.some((r) => isPrivateOrReservedIp(r.address))) {
    throw new Error('Tên miền trỏ tới địa chỉ IP nội bộ hoặc không hợp lệ (SSRF protection)')
  }
  return parsed
}

function devFetchUrlPlugin(): Plugin {
  return {
    name: 'dev-fetch-url-proxy',
    configureServer(server) {
      server.middlewares.use('/__dev/fetch-url', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost')
          const rawTarget = reqUrl.searchParams.get('url') || ''
          if (!rawTarget) {
            res.statusCode = 400
            res.end(JSON.stringify({ detail: 'Thiếu tham số url.' }))
            return
          }

          let currentUri = await validatePublicHttpUrl(rawTarget)
          let upstreamRes: Response | null = null
          const maxRedirects = 3

          for (let hop = 0; hop <= maxRedirects; hop++) {
            upstreamRes = await fetch(currentUri.toString(), {
              method: 'GET',
              redirect: 'manual',
              signal: AbortSignal.timeout(45000),
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
              },
            })

            if ([301, 302, 303, 307, 308].includes(upstreamRes.status)) {
              const loc = upstreamRes.headers.get('location')
              if (!loc || hop === maxRedirects) {
                res.statusCode = 422
                res.end(JSON.stringify({ detail: 'Trang web chuyển hướng quá nhiều lần.' }))
                return
              }
              const nextUrl = new URL(loc, currentUri).toString()
              currentUri = await validatePublicHttpUrl(nextUrl)
              continue
            }
            break
          }

          if (!upstreamRes || !upstreamRes.ok) {
            res.statusCode = 422
            res.end(
              JSON.stringify({
                detail: `Trang web phản hồi HTTP ${upstreamRes?.status ?? 502}. Vui lòng mở trang gốc và copy thủ công.`,
              })
            )
            return
          }

          const maxBytes = 2 * 1024 * 1024
          const chunks: Uint8Array[] = []
          let totalBytes = 0
          const reader = upstreamRes.body?.getReader()
          if (reader) {
            while (totalBytes < maxBytes) {
              const { done, value } = await reader.read()
              if (done || !value) break
              const remaining = maxBytes - totalBytes
              if (value.byteLength > remaining) {
                chunks.push(value.subarray(0, remaining))
                totalBytes += remaining
                await reader.cancel()
                break
              }
              chunks.push(value)
              totalBytes += value.byteLength
            }
          }
          const combined = new Uint8Array(totalBytes)
          let offset = 0
          for (const c of chunks) {
            combined.set(c, offset)
            offset += c.byteLength
          }
          const html = new TextDecoder('utf-8').decode(combined)
          res.statusCode = 200
          res.end(JSON.stringify({ url: currentUri.toString(), html }))
        } catch (err) {
          res.statusCode = 422
          res.end(
            JSON.stringify({
              detail: err instanceof Error ? err.message : 'Không thể tải trang web này.',
            })
          )
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devFetchUrlPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // AI Agent SSE streaming chat endpoint (Agent Service on port 8001)
      '/api/v1/agent/chat': {
        target: process.env.AGENT_SERVICE_URL || 'http://localhost:8001',
        changeOrigin: true,
      },
      // Core API backend endpoints (port 5176 locally on Mac, 5000 in docker)
      '/api': {
        target: process.env.CORE_API_URL || 'http://localhost:5176',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'sonner'],
        },
      },
    },
  },
})
