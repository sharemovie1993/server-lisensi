"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRIPAY_API_URL = exports.TRIPAY_MERCHANT_CODE = exports.TRIPAY_PRIVATE_KEY = exports.TRIPAY_API_KEY = exports.TOTP_SECRET = exports.ADMIN_SECRET = exports.PUBLIC_KEY = exports.PRIVATE_KEY = void 0;
exports.initializeKeys = initializeKeys;
// src/utils/keys.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const PRIVATE_KEY_PATH = path_1.default.join(__dirname, '../../private_key.pem');
const PUBLIC_KEY_PATH = path_1.default.join(__dirname, '../../public_key.pem');
function initializeKeys() {
    if (!fs_1.default.existsSync(PRIVATE_KEY_PATH) || !fs_1.default.existsSync(PUBLIC_KEY_PATH)) {
        console.log('[CRYPTO] Generating RSA 2048-bit key pair for secure license signing...');
        const { privateKey, publicKey } = crypto_1.default.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        fs_1.default.writeFileSync(PRIVATE_KEY_PATH, privateKey);
        fs_1.default.writeFileSync(PUBLIC_KEY_PATH, publicKey);
        console.log('[CRYPTO] RSA key pair generated and saved successfully.');
    }
}
// Ensure keys exist
initializeKeys();
exports.PRIVATE_KEY = fs_1.default.readFileSync(PRIVATE_KEY_PATH, 'utf8');
exports.PUBLIC_KEY = fs_1.default.readFileSync(PUBLIC_KEY_PATH, 'utf8');
exports.ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
exports.TOTP_SECRET = process.env.TOTP_SECRET || 'ABSENTASECRETKEYMYSECURETOKEN';
exports.TRIPAY_API_KEY = process.env.TRIPAY_API_KEY;
exports.TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
exports.TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE;
exports.TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';
