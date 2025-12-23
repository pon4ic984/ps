// Vercel Serverless Function: /api/webhook
// Receives YooKassa webhooks (payment.succeeded, payment.canceled, etc).
// IMPORTANT: A static front-end cannot be updated from here (localStorage is on user device).
// Use this endpoint to update your database (Supabase) or notify admins.
//
// Env required:
//   YOOKASSA_SHOP_ID
//   YOOKASSA_SECRET_KEY
//
// Recommendations from YooKassa: verify webhook authenticity by checking object status via API
// or by verifying sender IP list (harder behind proxies). See docs.

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

async function getPayment(paymentId) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
  const resp = await fetch(`${YOOKASSA_API}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" }
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method Not Allowed" });

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) {
    return json(res, 500, { error: "Missing YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY env vars" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const event = body.event;
    const object = body.object || {};
    const paymentId = object.id;

    if (!event || !paymentId) {
      return json(res, 400, { error: "Bad webhook payload" });
    }

    // Verify by re-fetching payment status from YooKassa API
    const verified = await getPayment(paymentId);
    if (!verified.ok) {
      return json(res, 502, { error: "Failed to verify payment", details: verified.data });
    }

    const pay = verified.data;
    const orderId = pay?.metadata?.order_id;

    // TODO: Here is where you update your DB / send Telegram / etc.
    // Example:
    // - if (pay.status === "succeeded") mark order as paid
    // - if (pay.status === "canceled") mark order as canceled

    // For now, just log:
    console.log("[YooKassa webhook]", { event, paymentId, status: pay.status, orderId });

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Server error", details: String(e?.message || e) });
  }
}
