"use strict";

const sellersRepository = require("./sellers.repository");
const { z } = require("zod");

const searchSchema = z.object({
  q: z.string().default(""),
  limit: z.preprocess((val) => parseInt(val, 10), z.number().min(1).max(100).default(50))
});

async function handleSearch(req, res, next) {
  try {
    const { q, limit } = searchSchema.parse(req.query);
    const sellers = await sellersRepository.searchSellers(q, limit);
    res.json({ success: true, sellers });
  } catch (err) {
    if (err.code === "SELLER_SCHEMA_NOT_DISCOVERED") {
      return res.status(501).json({ 
        success: false, 
        error: { 
          code: err.code,
          message: "Consulta de vendedores ERP aguardando homologação do schema." 
        } 
      });
    }
    next(err);
  }
}

module.exports = { handleSearch };

