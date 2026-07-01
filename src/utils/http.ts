import fetch from 'node-fetch';

export async function httpPost(url: string, payload: any, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
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
  } finally {
    clearTimeout(timeout);
  }
}
