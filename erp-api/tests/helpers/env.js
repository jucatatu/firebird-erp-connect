"use strict";

// Env mínimo para testes. Aplicado ANTES de qualquer require de src/.
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.PORT = "0";
process.env.FIREBIRD_HOST = "127.0.0.1";
process.env.FIREBIRD_PORT = "3050";
process.env.FIREBIRD_DATABASE = "/tmp/fake.fdb";
process.env.FIREBIRD_USER = "TEST_USER";
process.env.FIREBIRD_PASSWORD = "TEST_PASSWORD_LONG";
process.env.API_KEY = "test-api-key-1234567890";
process.env.HMAC_SECRET = "test-hmac-secret-with-more-than-32-chars-xxxxxx";
process.env.CORS_ORIGINS = "";
process.env.LOG_LEVEL = "silent";
process.env.DEV_BYPASS_AUTH = "false";