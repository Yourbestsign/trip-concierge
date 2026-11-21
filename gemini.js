// netlify/functions/gemini.js
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { prompt, systemContext, apiKey } = JSON.parse(event.body || "{}");
    const cleanKey = String(apiKey || process.env.GEMINI_API_KEY || "")
      .replace(/[\r\n\t\s]+/g, "")
      .replace(/^["']+|["']+$/g, "")
      .trim();

    if (!cleanKey) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "APIキーが指定されていません（リクエストまたは環境変数 GEMINI_API_KEY）。" }),
      };
    }

    if (!prompt || !String(prompt).trim()) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "prompt が空です。" }),
      };
    }

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: systemContext
                ? `${systemContext}\n\n【ユーザー発話】\n${prompt}`
                : prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (_) {}

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: data && data.error ? data.error : rawText,
          keyPrefix: cleanKey.slice(0, 6),
          keyLength: cleanKey.length,
        }),
      };
    }

    const replyText =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: replyText }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err && err.message ? err.message : String(err) }),
    };
  }
};