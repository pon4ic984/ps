const crypto = require("crypto");

function cors(req, res) {
  const origin = req.headers.origin || "";
  const allow = process.env.SITE_URL || "*";
  res.setHeader("Access-Control-Allow-Origin", allow === "*" ? "*" : origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { amount, description, return_url, metadata } = req.body || {};

    if (!amount || !Number(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: "Bad amount" });
    }
    if (!return_url) return res.status(400).json({ error: "Missing return_url" });

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secret = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secret) return res.status(500).json({ error: "YooKassa env vars missing" });

    const idempotenceKey = crypto.randomUUID();

    const payload = {
      amount: { value: Number(amount).toFixed(2), currency: "RUB" },
      confirmation: { type: "redirect", return_url },
      capture: true,
      description: description || "Оплата заказа",
      metadata: metadata || {}
    };

    const r = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
        "Authorization": "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64")
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({ error: "YooKassa error", details: data });
    }

    return res.status(200).json({
      payment_id: data.id,
      status: data.status,
      confirmation_url: data?.confirmation?.confirmation_url
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
};
