// /api/openai.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ ok: false, error: 'Body must include messages: Array<{role, content}>' });
    }

    // On force un “system” pour cadrer l’agent DataClean
    const system = {
      role: 'system',
      content:
        "Tu es DataClean AI, un assistant expert en nettoyage de données d'entreprise. " +
        "Tu réponds de façon concrète, courte et actionnable. " +
        "Tu proposes des règles de validation (email, téléphone E.164, dates ISO 8601, IBAN, URL), " +
        "des stratégies de dédoublonnage (fuzzy, clés composites), des imputations (moyenne/mode), " +
        "et des conseils pour améliorer la qualité des données."
    };

    const payload = {
      model: 'gpt-4o-mini',
      messages: [system, ...messages].slice(-20), // contexte court
      temperature: 0.3
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ ok: false, error: err });
    }

    const data = await r.json();
    const text =
      data?.choices?.[0]?.message?.content ??
      'Désolé, je n’ai pas pu générer de réponse.';

    return res.status(200).json({ ok: true, text });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
