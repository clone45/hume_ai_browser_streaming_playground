import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const apiKey = process.env.HUME_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Support both simple format and utterances format
    const text = payload.text || payload.utterances?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Build the payload in Hume's expected format with utterances array
    const humePayload: Record<string, unknown> = {
      utterances: [
        {
          text: text.trim()
        }
      ]
    };

    // Add acting instructions to the utterance if provided
    const utterances = humePayload.utterances as Record<string, unknown>[];
    const utterance = utterances[0];
    
    if (payload.description) {
      utterance.description = payload.description;
      console.log('🎭 Adding acting instructions:', payload.description);
    }

    if (payload.speed && payload.speed !== 1.0) {
      utterance.speed = payload.speed;
      console.log('⚡ Adding speed:', payload.speed);
    }

    if (payload.trailing_silence && payload.trailing_silence > 0) {
      utterance.trailing_silence = payload.trailing_silence;
      console.log('⏸️ Adding trailing silence:', payload.trailing_silence);
    }

    // Add continuation context if provided
    if (payload.context) {
      humePayload.context = payload.context;
      console.log('🔗 Adding continuation context:', payload.context);
    }

    // Add voice if provided, otherwise disable instant mode
    if (payload.voice) {
      // Check if voice is a string (just ID) or object (ID + provider)
      if (typeof payload.voice === 'string') {
        utterance.voice = {
          id: payload.voice,
          provider: 'CUSTOM_VOICE'
        };
      } else {
        utterance.voice = payload.voice;
      }
      // Enable instant mode when voice is provided
      humePayload.instant_mode = true;
    } else {
      // Disable instant mode when no voice is provided
      humePayload.instant_mode = false;
    }

    // Log the payload being sent to Hume for debugging
    console.log('📤 Sending to Hume API:', JSON.stringify(humePayload, null, 2));

    // Call Hume AI TTS API with exact payload from client
    const response = await fetch('https://api.hume.ai/v0/tts/stream/json', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(humePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Hume API error (${response.status}):`, errorText);
      console.error('Failed payload was:', JSON.stringify(payload, null, 2));
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    // Stream the response back to client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
      }
    });

  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}