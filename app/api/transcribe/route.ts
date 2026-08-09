import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Get the uploaded audio from the browser
    const formData = await request.formData();

    const audio = formData.get("audio");

    // Make sure an audio file was actually received
    if (!(audio instanceof File)) {
      return NextResponse.json(
        {
          error: "No audio file received.",
        },
        {
          status: 400,
        },
      );
    }

    // Basic validation
    if (audio.size === 0) {
      return NextResponse.json(
        {
          error: "Audio file is empty.",
        },
        {
          status: 400,
        },
      );
    }

    // OpenAI supports webm for file transcription.
    const transcription =
      await openai.audio.transcriptions.create({
        file: audio,
        model: "gpt-transcribe",
      });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (error) {
    console.error(
      "TRANSCRIPTION ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error: "Speech transcription failed.",
      },
      {
        status: 500,
      },
    );
  }
}