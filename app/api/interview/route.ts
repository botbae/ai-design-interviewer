import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a professional technical interviewer conducting a real-time interview.
You have been given the candidate's resume and any optional GitHub/LinkedIn context below.
Ask one focused question at a time. Start with a brief greeting and your first question.
Be direct, professional, and conversational. Do not add meta-commentary or break character.`;

export async function POST(req: NextRequest) {
  let body: { messages: { role: string; content: string }[]; candidate: { resume: string; github: string; linkedin: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { candidate } = body;
  let { messages } = body;

  if (!candidate?.resume) {
    return NextResponse.json({ error: 'Missing candidate context' }, { status: 400 });
  }

  const systemWithContext = `${SYSTEM_PROMPT}

--- CANDIDATE CONTEXT ---
Resume:
${candidate.resume}
${candidate.github ? `\nGitHub: ${candidate.github}` : ''}
${candidate.linkedin ? `\nLinkedIn: ${candidate.linkedin}` : ''}`;

  if (!messages || messages.length === 0) {
    messages = [{ role: 'user', content: 'Start the interview now using the candidate context.' }];
  }

  const anthropicMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemWithContext,
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
