const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();

const { createDeepgramConnection } = require("./services/deepgram.service");
const connectDatabase = require("./config/database");
const app = express();
const transcriptRoutes = require("./routes/transcript.routes");
const summaryRoutes = require("./routes/summary.routes");

app.use(cors());
app.use(express.json());

app.use("/api/transcripts", transcriptRoutes);
app.use("/api/summaries", summaryRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "TranscribeAI backend is running",
  });
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/transcribe",
});

wss.on("connection", async (clientSocket) => {
  console.log("Frontend WebSocket connected");

  let deepgramConnection;

  try {
    deepgramConnection = await createDeepgramConnection();

    deepgramConnection.on("open", () => {
      console.log("Deepgram WebSocket connected");
    });

    deepgramConnection.on("message", (data) => {
        console.log("Deepgram message:", data.type);

        if (clientSocket.readyState === 1) {
            clientSocket.send(JSON.stringify(data));
        }
    });

    deepgramConnection.on("error", (error) => {
      console.error("Deepgram error:", error);

      if (clientSocket.readyState === 1) {
        clientSocket.send(
          JSON.stringify({
            type: "error",
            message: "Deepgram connection error",
          })
        );
      }
    });

    deepgramConnection.on("close", () => {
      console.log("Deepgram connection closed");
    });

    deepgramConnection.connect();
    await deepgramConnection.waitForOpen();

    clientSocket.send(
      JSON.stringify({
        type: "ready",
        message: "Transcription service ready",
      })
    );

    clientSocket.on("message", (audioData) => {
      if (deepgramConnection) {
        deepgramConnection.sendMedia(audioData);
      }
    });

    clientSocket.on("close", () => {
      console.log("Frontend WebSocket disconnected");

      if (deepgramConnection) {
        try {
          deepgramConnection.sendCloseStream();
        } catch (error) {
          console.error("Error closing Deepgram:", error);
        }
      }
    });
  } catch (error) {
    console.error("Failed to initialize Deepgram:", error);

    if (clientSocket.readyState === 1) {
      clientSocket.send(
        JSON.stringify({
          type: "error",
          message: "Failed to connect to transcription service",
        })
      );

      clientSocket.close();
    }
  }
});

const PORT = process.env.PORT || 5000;

connectDatabase();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});