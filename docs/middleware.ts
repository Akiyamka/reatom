import { next } from '@vercel/edge'
import { kv } from '@vercel/kv'

export default async function middleware(req: Request): Promise<Response> {
  const headers: ResponseInit['headers'] = {}

  if (
    req.headers.get('accept')?.includes('text/html') &&
    new URL(req.url).origin.endsWith('reatom.dev')
  ) {
    try {
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)

      headers['x-visit-count'] = String(await kv.incr(today.toISOString()))
    } catch (error) {
      console.error(error)
    }
  }

  return next({ headers })
}
