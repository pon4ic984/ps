import crypto from "crypto";

const YK_API = "https://api.yookassa.ru/v3/payments";

function basicAuth(shopId, secretKey) {
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export default async function handler(req, res) {
  // CORS for GitHub Pages
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const shopId = process.env.YK_SHOP_ID;
  const secretKey = process.env.YK_SECRET_KEY;
  const returnUrl = process.env.RETURN_URL;

  if (!shopId || !secretKey) return res.status(500).json({ error: "YK env not set" });
  if (!returnUrl) return res.status(500).json({ error: "RETURN_URL env not set" });

  const { amount, orderId, description } = req.body || {};
  const value = Number(amount);

  if (!orderId) return res.status(400).json({ error: "orderId required" });
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: "bad amount" });

  const payload = {
    amount: { value: value.toFixed(2), currency: "RUB" },
    confirmation: { type: "redirect", return_url: returnUrl },
    capture: true,
    description: description || `Заказ ${orderId}`,
    metadata: { orderId }
  };

  const idempotenceKey = crypto.randomUUID();

  const r = await fetch(YK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
      "Authorization": basicAuth(shopId, secretKey)
    },
    body: JSON.stringify(payload)
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json(data);

  return res.status(200).json({
    payment_id: data.id,
    confirmation_url: data?.confirmation?.confirmation_url
  });
}
