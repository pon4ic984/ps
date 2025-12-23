function cors(req, res) {
  const origin = req.headers.origin || "";
  const allow = process.env.SITE_URL || "*";
  res.setHeader("Access-Control-Allow-Origin", allow === "*" ? "*" : origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const payment_id = req.query?.payment_id;
  if (!payment_id) return res.status(400).json({ error: "Missing payment_id" });

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return res.status(500).json({ error: "YooKassa env vars missing" });

  const r = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(payment_id)}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64")
    }
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: "YooKassa error", details: data });

  return res.status(200).json({
    id: data.id,
    status: data.status,
    paid: data.paid === true
  });
};
