// Vercel Serverless Function: /api/create-payment
// Creates a YooKassa payment and returns { payment_id, confirmation_url }.
// Env required:
//   YOOKASSA_SHOP_ID
//   YOOKASSA_SECRET_KEY
// Optional:
//   SITE_URL (e.g. https://ugolek.example.com) - used for return_url if Origin header is absent.

import crypto from "crypto";

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function toAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  // YooKassa expects a string with 2 decimals
  return n.toFixed(2);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method Not Allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const amountStr = toAmount(body.amount);
    const orderId = String(body.orderId || "").trim();
    const description = String(body.description || `Заказ #${orderId}`).slice(0, 128);

    if (!amountStr) return json(res, 400, { error: "Invalid amount" });
    if (!orderId) return json(res, 400, { error: "Missing orderId" });

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secret = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secret) {
      return json(res, 500, { error: "Missing YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY env vars" });
    }

    const origin = req.headers.origin || process.env.SITE_URL || "";
    const returnUrl = origin
      ? `${origin.replace(/\/$/, "")}/?pay=return&order=${encodeURIComponent(orderId)}`
      : `https://example.com/?pay=return&order=${encodeURIComponent(orderId)}`;

    const idempotenceKey = crypto.randomUUID();

    const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");

    const payload = {
      amount: { value: amountStr, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description,
      metadata: { order_id: orderId }
    };

    const resp = await fetch(`${YOOKASSA_API}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": idempotenceKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return json(res, resp.status, { error: "YooKassa error", details: data });
    }

    const confirmationUrl = data?.confirmation?.confirmation_url;
    const paymentId = data?.id;

    if (!confirmationUrl || !paymentId) {
      return json(res, 502, { error: "Unexpected YooKassa response", details: data });
    }

    return json(res, 200, { payment_id: paymentId, confirmation_url: confirmationUrl });
  } catch (e) {
    return json(res, 500, { error: "Server error", details: String(e?.message || e) });
  }
}
