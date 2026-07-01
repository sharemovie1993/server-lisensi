"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpPost = httpPost;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function httpPost(url, payload, headers = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await (0, node_fetch_1.default)(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        const bodyText = await res.text();
        return { status: res.status, body: bodyText };
    }
    finally {
        clearTimeout(timeout);
    }
}
