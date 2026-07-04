import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { readFileSync } from 'fs';

const HASH_FILE = '/home/azad/.homeflix-pin-hash';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getExpectedHash(): string {
  try {
    return readFileSync(HASH_FILE, 'utf-8').trim();
  } catch {
    // Fall back to env var default
    const pin = process.env.SETTINGS_PIN;
    if (!pin) throw new Error('SETTINGS_PIN not set');
    return sha256(pin);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const entered = Buffer.from(sha256(pin));
    const expected = Buffer.from(getExpectedHash());

    // Constant-time comparison to prevent timing attacks
    const ok = entered.length === expected.length && timingSafeEqual(entered, expected);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
