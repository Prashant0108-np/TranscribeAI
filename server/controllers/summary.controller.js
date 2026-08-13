const Transcript = require("../models/Transcript");
const { generateSummary } = require("../services/llm.service");

const createSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const transcript = await Transcript.findById(id);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "Transcript not found",
      });
    }

    if (!transcript.text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transcript is empty",
      });
    }

    const summary = await generateSummary(transcript.text);

    transcript.summary = summary;

    await transcript.save();

    res.status(200).json({
      success: true,
      message: "Summary generated successfully",
      data: {
        id: transcript._id,
        summary: transcript.summary,
      },
    });
  } catch (error) {
    console.error("Summary generation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate summary",
    });
  }
};

module.exports = {
  createSummary,
};