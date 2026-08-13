const { DeepgramClient } = require("@deepgram/sdk");

const deepgram = new DeepgramClient({
  apiKey: process.env.DEEPGRAM_API_KEY,
});

const createDeepgramConnection = async () => {
  const connection = await deepgram.listen.v1.connect({
    model: "nova-3",
    language: "en-US",
    smart_format: true,
    interim_results: true,
    endpointing: 300,
    diarize: true,
    punctuate: true,
    vad_events: true,
    numerals: true,
  });

  return connection;
};

module.exports = {
  createDeepgramConnection,
};