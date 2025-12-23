module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    hasShopId: !!process.env.YOOKASSA_SHOP_ID,
    hasSecret: !!process.env.YOOKASSA_SECRET_KEY
  });
};
