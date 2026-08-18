"use strict";

const sellersRepository = require("./sellers.repository");
const { z } = require("zod");

const searchSchema = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  companyId: z.preprocess((val) => {
    if (val === "1") return 1;
    if (val === "3") return 3;
    if (val === "" || val === undefined || val === null) return null;
    return "INVALID";
  }, z.union([z.literal(1), z.literal(3), z.null()]))
});

const idSchema = z.object({
  id: z.coerce.number().int().positive()
});

async function handleSearch(req, res, next) {
  try {
    const { AppError } = require("../../shared/errors/app-error");
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError({
        message: "Parâmetros de busca inválidos.",
        statusCode: 400,
        code: "INVALID_PARAMS",
        exposeDetails: true,
        details: parsed.error.format()
      });
    }
    const { q, limit, companyId } = parsed.data;
    const sellers = await sellersRepository.searchSellers({ query: q, limit, companyId });
    res.json({ success: true, data: { sellers } });
  } catch (err) {
    next(err);
  }
}

async function handleGetById(req, res, next) {
  try {
    const { AppError } = require("../../shared/errors/app-error");
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new AppError({
        message: "ID de vendedor inválido.",
        statusCode: 400,
        code: "INVALID_ID",
        exposeDetails: true,
        details: parsed.error.format()
      });
    }
    const { id } = parsed.data;
    const seller = await sellersRepository.getSellerById(id);

    if (!seller) {
      throw new AppError({
        message: "Vendedor não encontrado no ERP ou não autorizado.",
        statusCode: 404,
        code: "SELLER_NOT_FOUND"
      });
    }

    res.json({ success: true, data: { seller } });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleSearch, handleGetById };
