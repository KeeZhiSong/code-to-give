import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req) {
  try {
    const { 
      shiftEvent, 
      shiftRole, 
      incomingVolunteerName, 
      incomingPhoneNumber, 
      rawLogs 
    } = await req.json();

    // Validate incoming parameters early
    if (!incomingPhoneNumber) {
      return NextResponse.json(
        { error: 'Missing incomingPhoneNumber parameter' },
        { status: 400 }
      );
    }

    // 1. Generate Briefing via Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const prompt = `
      You are an AI Volunteer Coordinator for "Passion To Serve".
      Synthesize the following shift logs into a concise 3-bullet handover brief for volunteer ${incomingVolunteerName}.

      Event: ${shiftEvent}
      Role: ${shiftRole}
      Logs:
      ${rawLogs && rawLogs.length > 0 ? rawLogs.join('\n') : 'No previous logs recorded. Standard arrival protocols apply.'}

      Format Rules:
      - Exactly 3 bullet points starting with '•'.
      - High-priority actionable items only.
    `;

    const aiResult = await model.generateContent(prompt);
    const aiBrief = aiResult.response.text().trim();

    // 2. Format Green API URL and Payload
    // Fixed domain: api.green-api.com
    const baseUrl = (process.env.GREENAPI_API_URL || 'https://api.green-api.com').replace(/\/$/, '');
    const idInstance = process.env.GREENAPI_ID_INSTANCE;
    const token = process.env.GREENAPI_TOKEN;

    if (!idInstance || !token) {
      throw new Error('GREENAPI_ID_INSTANCE or GREENAPI_TOKEN is missing in environment variables.');
    }

    // Clean phone number (strip non-digits)
    const cleanPhone = incomingPhoneNumber.replace(/\D/g, ''); 
    const chatId = `${cleanPhone}@c.us`;

    const greenApiEndpoint = `${baseUrl}/waInstance${idInstance}/sendMessage/${token}`;

    const whatsappMessage = 
`🤖 *AI Handover Briefing — Passion To Serve*

Hello *${incomingVolunteerName}*! You are taking over:
📅 *Event:* ${shiftEvent}
📋 *Role:* ${shiftRole}

📝 *AI Summary Brief:*
${aiBrief}

Please check in with the Lead Coordinator upon arrival!`;

    // 3. Send WhatsApp message via Green API
    const response = await fetch(greenApiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chatId,
        message: whatsappMessage,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`Green API returned status ${response.status}: ${JSON.stringify(responseData)}`);
    }

    return NextResponse.json({ 
      success: true, 
      data: responseData, 
      summary: aiBrief 
    });

  } catch (error) {
    console.error('Handover API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process handover briefing', details: error.message },
      { status: 500 }
    );
  }
}