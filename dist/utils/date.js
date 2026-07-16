"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDateStr = toDateStr;
exports.addDays = addDays;
/**
 * Format a Date object as YYYY-MM-DD string.
 * Defaults to today if no date is provided.
 */
function toDateStr(date = new Date()) {
    return date.toISOString().slice(0, 10);
}
/**
 * Add a number of days to a Date object.
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
