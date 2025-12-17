import { createClient } from "@supabase/supabase-js";

const YK_PAYMENTS = "https://api.yookassa.ru/v3/payments/";

function basicAuth(shopId, secretKey) {
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const shopId = process.env.YK_SHOP_ID;
  const secretKey = process.env.YK_SECRET_KEY;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!shopId || !secretKey) return res.status(500).end();
  if (!supabaseUrl || !serviceKey) return res.status(500).end();

  const event = req.body;
  const paymentId = event?.object?.id;

  if (event?.event !== "payment.succeeded" || !paymentId) {
    return res.status(200).json({ ok: true });
  }

  // confirm status from YooKassa
  const pr = await fetch(YK_PAYMENTS + paymentId, {
    headers: { "Authorization": basicAuth(shopId, secretKey) }
  });
  const pdata = await pr.json().catch(() => ({}));
  if (!pr.ok) return res.status(200).json({ ok: true });

  if (pdata.status !== "succeeded") return res.status(200).json({ ok: true });

  const orderId = pdata?.metadata?.orderId;
  if (!orderId) return res.status(200).json({ ok: true });

  const sb = createClient(supabaseUrl, serviceKey);

  await sb
    .from("orders")
    .update({ status: "paid", payment_id: paymentId, is_paid: true, payment_method: "yookassa" })
    .eq("order_id", orderId);

  return res.status(200).json({ ok: true });
}
