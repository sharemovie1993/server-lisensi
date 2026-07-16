import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get a single setting value from the system_settings table.
 */
export async function getSetting(key: string, fallback: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key }
    });
    return setting ? setting.value : fallback;
  } catch (error) {
    console.error(`[SettingsService] Error getting setting "${key}":`, error);
    return fallback;
  }
}

/**
 * Set/update a setting value in the system_settings table.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  } catch (error) {
    console.error(`[SettingsService] Error setting "${key}":`, error);
    throw error;
  }
}

/**
 * Fetch multiple settings at once and return a map of key-value pairs.
 */
export async function getSettingsMap(keys: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: keys }
      }
    });
    for (const item of settings) {
      map[item.key] = item.value;
    }
  } catch (error) {
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
