const Transcript = require("../models/Transcript");

const saveTranscript = async (req, res) => {
  try {
    const { text, duration } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transcript text is required",
      });
    }

    const cleanText = text.trim();

    const wordCount = cleanText
      .split(/\s+/)
      .filter(Boolean).length;

    const transcript = await Transcript.create({
      text: cleanText,
      duration: duration || 0,
      wordCount,
    });

    res.status(201).json({
      success: true,
      message: "Transcript saved successfully",
      data: transcript,
    });
  } catch (error) {
    console.error("Save transcript error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save transcript",
    });
  }
};

const deleteTranscript = async (req, res) => {
  try {
    const { id } = req.params;

    const transcript = await Transcript.findByIdAndDelete(id);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "Transcript not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transcript deleted successfully",
    });
  } catch (error) {
    console.error("Delete transcript error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete transcript",
    });
  }
};

const updateTranscript = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transcript text is required",
      });
    }

    const cleanText = text.trim();

    const wordCount = cleanText
      .split(/\s+/)
      .filter(Boolean).length;

    const transcript = await Transcript.findByIdAndUpdate(
      id,
      {
        text: cleanText,
        wordCount,
        summary: null,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "Transcript not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transcript updated successfully",
      data: transcript,
    });
  } catch (error) {
    console.error("Update transcript error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update transcript",
    });
  }
};

const getTranscripts = async (req, res) => {
  try {
    const transcripts = await Transcript.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: transcripts,
    });
  } catch (error) {
    console.error("Get transcripts error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transcripts",
    });
  }
};

module.exports = {
  saveTranscript,
  getTranscripts,
  updateTranscript,
  deleteTranscript,
};