const LLM_BASE_URL = "https://ai-api.userfacet.com";

const generateSummary = async (transcript) => {
  const response = await fetch(
    `${LLM_BASE_URL}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that summarizes audio transcripts clearly and concisely.",
          },
          {
            role: "user",
            content: `Summarize the following transcript. Provide a short summary, key points, and action items if present.\n\nTranscript:\n${transcript}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "LLM API request failed"
    );
  }

  return data.choices[0].message.content;
};

module.exports = {
  generateSummary,
};