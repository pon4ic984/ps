// Vercel Serverless Function: /api/payment-status
// GET /api/payment-status?payment_id=...  -> returns YooKassa payment status
// Env required:
//   YOOKASSA_SHOP_ID
//   YOOKASSA_SECRET_KEY

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method Not Allowed" });

  const paymentId = String(req.query?.payment_id || "").trim();
  if (!paymentId) return json(res, 400, { error: "Missing payment_id" });

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) {
    return json(res, 500, { error: "Missing YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY env vars" });
  }

  try {
    const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");

    const resp = await fetch(`${YOOKASSA_API}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json(res, resp.status, { error: "YooKassa error", details: data });

    return json(res, 200, {
      id: data.id,
      status: data.status,
      paid: !!data.paid,
      amount: data.amount,
      metadata: data.metadata
    });
  } catch (e) {
    return json(res, 500, { error: "Server error", details: String(e?.message || e) });
  }
}
