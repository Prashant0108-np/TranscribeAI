const express = require("express");

const {
  saveTranscript,
  getTranscripts,
  updateTranscript,
  deleteTranscript,
} = require("../controllers/transcript.controller");

const router = express.Router();

router.post("/", saveTranscript);
router.get("/", getTranscripts);
router.put("/:id", updateTranscript);
router.delete("/:id", deleteTranscript);

module.exports = router;