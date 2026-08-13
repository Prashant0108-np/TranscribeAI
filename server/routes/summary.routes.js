const express = require("express");

const {
  createSummary,
} = require("../controllers/summary.controller");

const router = express.Router();

router.post("/:id", createSummary);

module.exports = router;