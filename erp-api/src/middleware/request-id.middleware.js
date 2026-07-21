"use strict";

const { randomUUID } = require("crypto");

function requestIdMiddleware(req, res, next) {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[a-zA-Z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

module.exports = { requestIdMiddleware };