"use strict";

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function failure(res, { code, message, retryable = false, status = 500, requestId }) {
  const body = {
    success: false,
    error: { code, message, retryable },
  };
  if (requestId) body.error.requestId = requestId;
  return res.status(status).json(body);
}

module.exports = { success, failure };