const mongoose = require("mongoose");

const transcriptSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: Number,
      default: 0,
    },

    wordCount: {
      type: Number,
      default: 0,
    },

    summary: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transcript", transcriptSchema);