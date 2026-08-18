"use strict";

const sellersRepository = require("./sellers.repository");
const { z } = require("zod");

const searchSchema = z.object({
  q: z.string().default(""),
  limit: z.preprocess((val) => val ? parseInt(val, 10) : 50, z.number().min(1).max(100).default(50)),
  companyId: z.preprocess((val) => val ? parseInt(val, 10) : null, z.union([z.literal(1), z.literal(3), z.null()]).default(null))
});

const idSchema = z.object({
  id: z.preprocess((val) => parseInt(val, 10), z.number().positive())
});

async function handleSearch(req, res, next) {
  try {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      const { AppError } = require("../../shared/errors/app-error");
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
    res.json({ success: true, sellers });
  } catch (err) {
    next(err);
  }
}

async function handleGetById(req, res, next) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      const { AppError } = require("../../shared/errors/app-error");
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
      return res.status(404).json({
        success: false,
        error: {
          code: "SELLER_NOT_FOUND",
          message: "Vendedor não encontrado no ERP ou não autorizado."
        }
      });
    }

    res.json({ success: true, seller });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleSearch, handleGetById };
