import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const message = body?.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          error: "Message is required",
        },
        {
          status: 400,
        },
      );
    }

    console.log("ULTRON USER:", message);

    // Temporary response.
    // We will connect the actual AI here next.
    const reply = `Hello. I heard you say: ${message}`;

    console.log("ULTRON AI:", reply);

    return NextResponse.json({
      reply,
    });
  } catch (error) {
    console.error("Assistant API error:", error);

    return NextResponse.json(
      {
        error: "Assistant failed",
      },
      {
        status: 500,
      },
    );
  }
}