module.exports = (req, res) => {
  const shop = process.env.YOOKASSA_SHOP_ID || "";
  const secret = process.env.YOOKASSA_SECRET_KEY || "";
  res.status(200).json({
    ok: true,
    shopId_tail: shop.slice(-4),
    secret_prefix: secret.slice(0, 5),
    secret_tail: secret.slice(-4),
  });
};
