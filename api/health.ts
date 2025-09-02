import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: Boolean(process.env.OPENAI_API_KEY),
    provider: 'openai',
    time: new Date().toISOString()
  });
}
