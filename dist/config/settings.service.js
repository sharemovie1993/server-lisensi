"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getSettingsMap = getSettingsMap;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Get a single setting value from the system_settings table.
 */
async function getSetting(key, fallback = '') {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key }
        });
        return setting ? setting.value : fallback;
    }
    catch (error) {
        console.error(`[SettingsService] Error getting setting "${key}":`, error);
        return fallback;
    }
}
/**
 * Set/update a setting value in the system_settings table.
 */
async function setSetting(key, value) {
    try {
        await prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
    }
    catch (error) {
        console.error(`[SettingsService] Error setting "${key}":`, error);
        throw error;
    }
}
/**
 * Fetch multiple settings at once and return a map of key-value pairs.
 */
async function getSettingsMap(keys) {
    const map = {};
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: { in: keys }
            }
        });
        for (const item of settings) {
            map[item.key] = item.value;
        }
    }
    catch (error) {
        console.error(`[SettingsService] Error fetching settings map:`, error);
    }
    // Populate fallbacks for requested keys that were not found
    for (const key of keys) {
        if (map[key] === undefined) {
            map[key] = '';
        }
    }
    return map;
}
