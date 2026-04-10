import { NextRequest, NextResponse } from 'next/server';

const EARN_API = 'https://earn.li.fi';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams();

    for (const [key, value] of searchParams.entries()) {
      params.set(key, value);
    }

    const res = await fetch(`${EARN_API}/v1/earn/vaults?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Earn API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Earn API proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch vaults' }, { status: 500 });
  }
}
