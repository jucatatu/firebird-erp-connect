"use strict";

const sellersRepository = require("./sellers.repository");
const { z } = require("zod");

const searchSchema = z.object({
  q: z.string().default(""),
  limit: z.preprocess((val) => parseInt(val, 10), z.number().min(1).max(100).default(50))
});

async function handleSearch(req, res) {
  const { q, limit } = searchSchema.parse(req.query);
  const sellers = await sellersRepository.searchSellers(q, limit);
  res.json({ success: true, sellers });
}

module.exports = { handleSearch };
