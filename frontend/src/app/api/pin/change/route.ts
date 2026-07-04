import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const HASH_FILE = '/home/azad/.homeflix-pin-hash';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getExpectedHash(): string {
  try {
    return readFileSync(HASH_FILE, 'utf-8').trim();
  } catch {
    const pin = process.env.SETTINGS_PIN;
    if (!pin) throw new Error('SETTINGS_PIN not set');
    return sha256(pin);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { currentPin, newPin } = await req.json();
    if (!currentPin || !/^\d{4}$/.test(currentPin) || !newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ ok: false, error: 'Invalid PIN format' }, { status: 400 });
    }

    const entered = Buffer.from(sha256(currentPin));
    const expected = Buffer.from(getExpectedHash());
    const verified = entered.length === expected.length && timingSafeEqual(entered, expected);

    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Current PIN is incorrect' });
    }

    writeFileSync(HASH_FILE, sha256(newPin), { mode: 0o600 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
