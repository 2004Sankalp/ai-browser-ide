import { type NextRequest, NextResponse } from "next/server"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

async function generateAIResponse(messages: ChatMessage[]) {
  const systemPrompt = `
You are an expert AI coding assistant.
Help with debugging, explanations, best practices and clean code.
Keep answers clear and concise.
Use proper code blocks with language formatting.
`

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ]

  const prompt = fullMessages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n")

  const controller = new AbortController()

  // Increased timeout (local models need more time)
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      model: "codellama:latest",



        prompt,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 250,     // 🔥 Reduced from 1000
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama error: ${errorText}`)
    }

    const data = await response.json()

    if (!data.response) {
      throw new Error("Empty response from Ollama")
    }

    return data.response.trim()
  } catch (error) {
    clearTimeout(timeoutId)

    if ((error as Error).name === "AbortError") {
      throw new Error("AI request timeout")
    }

    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { message, history } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message must be a string" },
        { status: 400 }
      )
    }

    const validHistory = Array.isArray(history)
      ? history
          .filter(
            (msg: any) =>
              msg &&
              typeof msg.role === "string" &&
              typeof msg.content === "string"
          )
          .slice(-4)   // 🔥 Only last 4 messages
      : []

    const messages: ChatMessage[] = [
      ...validHistory,
      { role: "user", content: message },
    ]

    const aiResponse = await generateAIResponse(messages)

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "AI Chat API running",
    timestamp: new Date().toISOString(),
  })
}
