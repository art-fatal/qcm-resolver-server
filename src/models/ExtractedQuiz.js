const mongoose = require('mongoose');

const extractedQuizSchema = new mongoose.Schema({
  extractedContent: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'error', 'ignored'],
    default: 'pending'
  },
  error: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExtractedQuiz', extractedQuizSchema); 