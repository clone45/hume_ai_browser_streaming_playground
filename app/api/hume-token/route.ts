import { NextResponse } from 'next/server';

export async function POST() {
  const apiKey = process.env.HUME_API_KEY;
  const secretKey = process.env.HUME_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return NextResponse.json(
      { error: 'Hume AI credentials not configured' },
      { status: 500 }
    );
  }

  try {
    // Create base64 encoded credentials
    const credentials = `${apiKey}:${secretKey}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');

    // Get access token from Hume AI
    const response = await fetch('https://api.hume.ai/oauth2-cc/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}