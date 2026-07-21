"use strict";

const { env } = require("./env");

const firebirdOptions = Object.freeze({
  host: env.FIREBIRD_HOST,
  port: env.FIREBIRD_PORT,
  database: env.FIREBIRD_DATABASE,
  user: env.FIREBIRD_USER,
  password: env.FIREBIRD_PASSWORD,
  role: env.FIREBIRD_ROLE || undefined,
  pageSize: env.FIREBIRD_PAGE_SIZE,
  lowercase_keys: false,
  charset: env.FIREBIRD_CHARSET,
});

module.exports = { firebirdOptions };