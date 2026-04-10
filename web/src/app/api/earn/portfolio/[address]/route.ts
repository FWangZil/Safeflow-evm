import { NextRequest, NextResponse } from 'next/server';

const EARN_API = 'https://earn.li.fi';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const res = await fetch(`${EARN_API}/v1/earn/portfolio/${address}/positions`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Portfolio API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Portfolio API proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
