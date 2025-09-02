export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, context } = body || {};
    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      // fallback local
      return new Response(
        JSON.stringify({
          reply:
            "Mode démo local (pas de clé OpenAI). Je peux normaliser les dates en ISO-8601, formater les téléphones en E.164, et supprimer les doublons recommandés."
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    const sys =
      "Tu es un assistant expert en nettoyage de données. Donne des conseils courts et actionnables (doublons, manquants, normalisation).";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content:
              `Question: ${prompt}\n` +
              `Context: ${JSON.stringify(context).slice(0, 1500)}`
          }
        ],
        temperature: 0.2,
        max_tokens: 250
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ reply: txt.slice(0, 500) }), {
        headers: { "content-type": "application/json" }
      });
    }
    const j = await r.json();
    const reply = j.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ reply }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ reply: e?.message || "error" }), {
      headers: { "content-type": "application/json" }
    });
  }
}
