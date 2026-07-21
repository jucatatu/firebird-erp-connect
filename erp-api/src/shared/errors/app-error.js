"use strict";

class AppError extends Error {
  /**
   * @param {{ message: string, statusCode?: number, code?: string, retryable?: boolean, details?: any }} opts
   */
  constructor({ message, statusCode = 500, code = "INTERNAL_ERROR", retryable = false, details }) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.details = details; // uso interno; nunca serializado ao cliente
    this.isOperational = true;
  }
}

module.exports = { AppError };