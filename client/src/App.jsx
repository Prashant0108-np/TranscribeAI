import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready to record");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [summaryModal, setSummaryModal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const timerRef = useRef(null);
  const isRecordingRef = useRef(false);

  const updateTranscript = async (id) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/transcripts/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: editText,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to update transcript"
      );
    }

    setHistory((previous) =>
      previous.map((item) =>
        item._id === id
          ? {
              ...item,
              text: data.data.text,
              wordCount: data.data.wordCount,
              summary: null,
            }
          : item
      )
    );

    setEditingId(null);
    setEditText("");
    setStatus("Transcript updated successfully");
  } catch (error) {
    console.error("Update transcript error:", error);
    setStatus("Failed to update transcript");
  }
};

  const fetchHistory = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/transcripts"
      );

      const data = await response.json();

      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

useEffect(() => {
  const loadHistory = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/transcripts"
      );

      const data = await response.json();

      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  loadHistory();

  return () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };
}, []);

  const startTimer = () => {
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      if (recordingStartTimeRef.current) {
        const seconds = Math.floor(
          (Date.now() - recordingStartTimeRef.current) / 1000
        );

        setRecordingTime(seconds);
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      setTranscript("");
      setInterimTranscript("");
      finalTranscriptRef.current = "";

      setStatus("Connecting...");

      const socket = new WebSocket(
        "ws://localhost:5000/transcribe"
      );

      socketRef.current = socket;

      socket.onopen = () => {
        console.log("Connected to backend WebSocket");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "ready") {
            setStatus("Listening...");
            startMicrophone();
          }

          if (data.type === "Results") {
            const alternative = data.channel?.alternatives?.[0];

            if (!alternative) return;

            const text = alternative.transcript;

            if (!text) return;

            if (data.is_final) {
              setTranscript((previous) => {
                const finalText = previous
                  ? `${previous} ${text}`
                  : text;

                finalTranscriptRef.current = finalText;

                return finalText;
              });

              setInterimTranscript("");
            } else {
              setInterimTranscript(text);
            }
          }

          if (data.type === "error") {
            console.error(data.message);
            setStatus("Transcription service error");
          }
        } catch (error) {
          console.error("Message parsing error:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);

        if (isRecordingRef.current) {
          setStatus("Connection lost");
        } else {
          setStatus("Connection error");
        }
      };

      socket.onclose = () => {
        console.log("Backend WebSocket closed");

        if (isRecordingRef.current) {
          setStatus("Connection lost");
        }
      };
    } catch (error) {
      console.error("Recording error:", error);
      setStatus("Something went wrong");
    }
  };

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          socketRef.current?.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        isRecordingRef.current = true;
        recordingStartTimeRef.current = Date.now();

        setIsRecording(true);
        setStatus("Listening...");
        startTimer();
      };

      mediaRecorder.onstop = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        stopTimer();

        stream.getTracks().forEach((track) => track.stop());

        setStatus("Finalizing transcript...");

        setTimeout(async () => {
          await saveTranscript();

          if (socketRef.current) {
            socketRef.current.close();
          }
        }, 1500);
      };

      mediaRecorder.start(250);
    } catch (error) {
      console.error("Microphone error:", error);

      setStatus("Microphone permission denied");

      if (socketRef.current) {
        socketRef.current.close();
      }
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const saveTranscript = async () => {
    try {
      const text = finalTranscriptRef.current.trim();

      if (!text) {
        setStatus("No transcript available");
        return;
      }

      const duration = recordingStartTimeRef.current
        ? Math.round(
            (Date.now() - recordingStartTimeRef.current) / 1000
          )
        : 0;

      const response = await fetch(
        "http://localhost:5000/api/transcripts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            duration,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save transcript"
        );
      }

      setStatus("Transcript saved successfully");

      await fetchHistory();
    } catch (error) {
      console.error("Save transcript error:", error);
      setStatus("Failed to save transcript");
    }
  };

  const generateSummary = async (id) => {
  try {
    setSummaryModal({
      loading: true,
      summary: "",
    });

    const response = await fetch(
      `http://localhost:5000/api/summaries/${id}`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to generate summary"
      );
    }

    setHistory((previous) =>
      previous.map((item) =>
        item._id === id
          ? {
              ...item,
              summary: data.data.summary,
            }
          : item
      )
    );

    setSummaryModal({
      loading: false,
      summary: data.data.summary,
    });
  } catch (error) {
    console.error("Summary error:", error);

    setSummaryModal({
      loading: false,
      summary: "",
      error: "Failed to generate AI summary.",
    });
  }
};

  const copyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedId(id);

      setTimeout(() => {
        setCopiedId(null);
      }, 1000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

const downloadTranscript = (text) => {
  try {
    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript-${new Date()
      .toISOString()
      .slice(0, 10)}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setStatus("Transcript downloaded");
  } catch (error) {
    console.error("Download error:", error);
    setStatus("Failed to download transcript");
  }
};

  const deleteTranscript = async (id) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/transcripts/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete transcript"
        );
      }

      setHistory((previous) =>
        previous.filter((item) => item._id !== id)
      );

      setDeleteTarget(null);
      setStatus("Transcript deleted");
    } catch (error) {
      console.error("Delete error:", error);
      setStatus("Failed to delete transcript");
    }
  };

  const filteredHistory = history.filter((item) =>
    item.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">T</div>

          <div>
            <h1>TranscribeAI</h1>
            <p>Real-time AI transcription</p>
          </div>
        </div>

        <div
          className={`connection ${
            status === "Connection lost"
              ? "connection-lost"
              : ""
          }`}
        >
          <span
            className={`status-dot ${
              isRecording ? "active" : ""
            } ${
              status === "Connection lost"
                ? "lost"
                : ""
            }`}
          />

          {status === "Connection lost"
            ? "Connection Lost"
            : isRecording
              ? "Recording"
              : "Ready"}
        </div>
      </header>

      <main className="dashboard">
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">AI POWERED</span>

            <h2>
              Turn your voice into
              <span> clear text.</span>
            </h2>

            <p>
              Record your voice and watch your words appear
              instantly with real-time transcription.
            </p>
          </div>

          <div className="record-card">
            <div className="record-status">
              <div
                className={`mic-circle ${
                  isRecording ? "recording" : ""
                }`}
              >
                🎙️
              </div>

              <div>
                <strong>
                  {isRecording
                    ? "Recording in progress"
                    : "Ready to record"}
                </strong>

                <span>{status}</span>
              </div>
            </div>

            <div className="timer">
              {formatTime(recordingTime)}
            </div>

            <button
              className={`record-button ${
                isRecording ? "stop" : ""
              }`}
              onClick={
                isRecording ? stopRecording : startRecording
              }
            >
              <span>{isRecording ? "■" : "🎙️"}</span>
              {isRecording
                ? "Stop Recording"
                : "Start Recording"}
            </button>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel transcript-panel">
            <div className="panel-header">
              <div>
                <span className="panel-label">LIVE</span>
                <h3>Current Transcript</h3>
              </div>

              {transcript && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    copyText(transcript, "current")
                  }
                >
                  {copiedId === "current"
                    ? "Copied"
                    : "Copy"}
                </button>
              )}
            </div>

            <div className="live-transcript">
              {transcript || interimTranscript ? (
                <>
                  <span>{transcript}</span>{" "}
                  <span className="interim">
                    {interimTranscript}
                  </span>
                </>
              ) : (
                <div className="empty-transcript">
                  <div>🎤</div>
                  <p>
                    Your live transcription will appear here.
                  </p>
                  <span>
                    Click "Start Recording" and begin speaking.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="panel history-panel">
            <div className="panel-header">
              <div>
                <span className="panel-label">LIBRARY</span>
                <h3>Previous Transcriptions</h3>
              </div>

              <span className="count">
                {history.length}
              </span>
            </div>

            <input
              className="search"
              type="text"
              placeholder="Search transcripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="history-list">
              {filteredHistory.length === 0 ? (
                <div className="empty-history">
                  <div>📂</div>
                  <p>No transcripts found.</p>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <article
                    className="history-card"
                    key={item._id}
                  >
                    <div className="history-card-top">
                      <span>
                        {new Date(
                          item.createdAt
                        ).toLocaleDateString()}
                      </span>

                      <span>
                        {item.duration}s · {item.wordCount} words
                      </span>
                    </div>

                    {editingId === item._id ? (
                      <textarea
                        className="edit-textarea"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                    ) : (
                      <p>{item.text}</p>
                    )}

                    <div className="history-actions">
  {editingId === item._id ? (
    <>
      <button
        className="summary-button"
        onClick={() => updateTranscript(item._id)}
      >
        Save Changes
      </button>

      <button
        className="secondary-button"
        onClick={() => {
          setEditingId(null);
          setEditText("");
        }}
      >
        Cancel
      </button>
    </>
  ) : (
    <>
      <button
        className="secondary-button"
        onClick={() => {
          setEditingId(item._id);
          setEditText(item.text);
        }}
      >
        Edit
      </button>

      <button
        className="secondary-button"
        onClick={() =>
          copyText(
            item.text,
            `history-${item._id}`
          )
        }
      >
        {copiedId === `history-${item._id}`
          ? "Copied"
          : "Copy"}
      </button>

      <button
        className="secondary-button"
        onClick={() =>
          downloadTranscript(item.text)
        }
      >
        Download
      </button>

      <button
        className="secondary-button delete-button"
        onClick={() => setDeleteTarget(item)}
      >
        Delete
      </button>

      {!item.summary && (
        <button
          className="summary-button"
          onClick={() =>
            generateSummary(item._id)
          }
        >
          ✨ Generate Summary
        </button>
      )}
    </>
  )}
</div>

                    {item.summary && (
                      <div className="summary-box">
                        <div className="summary-title">
                          ✨ AI Summary
                        </div>

                        <p>{item.summary}</p>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <div className="delete-icon">!</div>

            <h3>Delete transcript?</h3>

            <p>
              This transcript will be permanently removed
              from your history.
            </p>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                className="confirm-delete-button"
                onClick={() =>
                  deleteTranscript(deleteTarget._id)
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {summaryModal && (
        <div className="modal-overlay">
          <div className="summary-modal">
            <button
              className="summary-close"
              onClick={() => setSummaryModal(null)}
            >
              ×
            </button>

            <div className="summary-modal-header">
              <div className="summary-modal-icon">
                ✨
              </div>

              <div>
                <h3>AI Summary</h3>
                <span>
                  {summaryModal.loading
                    ? "Analyzing your transcript..."
                    : "Summary generated successfully"}
                </span>
              </div>
            </div>

            {summaryModal.loading ? (
              <div className="ai-loading">
                <div className="ai-loader">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <p>Generating your summary...</p>

                <small>
                  AI is analyzing the transcript and extracting
                  the important points.
                </small>
              </div>
            ) : summaryModal.error ? (
              <div className="summary-error">
                {summaryModal.error}
              </div>
            ) : (
              <div className="summary-result">
                <div className="summary-result-label">
                  ✨ Generated Summary
                </div>

                <p>{summaryModal.summary}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <footer>
        <span>TranscribeAI</span>
        <span>Real-time speech intelligence</span>
      </footer>
    </div>
  );
}

export default App;