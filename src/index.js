const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const Data = require('./models/Data');
const ExtractedQuiz = require('./models/ExtractedQuiz');
const { solveQuiz, extractQuizFromHtml } = require('./services/aiService');
const { initializeConfigs, getConfig, setConfig } = require('./services/configService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz-extractor')
  .then(async () => {
    console.log('Connected to MongoDB');
    // Initialize default configurations
    await initializeConfigs();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Routes
app.post('/api/data', async (req, res) => {
  try {
    console.log(["req.body", req.body.data]);
    
    // Return early if req.body.data is an empty object
    if (Object.keys(req.body.data || {}).length === 0) {
      return res.status(200).json({ message: 'No data to process' });
    }

    const data = new Data({
      content: req.body
    });
    
    const savedData = await data.save();
    
    // Send data immediately to front
    io.emit('newData', savedData);
    res.status(201).json(savedData);
    
    // Process solveQuiz in parallel
    try {
      const aiSolution = await solveQuiz(req.body);
      savedData.aiSolution = aiSolution;
      await savedData.save();
      
      // Send updated data with AI solution
      io.emit('aiSolution', {
        id: savedData._id,
        aiSolution: aiSolution
      });
    } catch (aiError) {
      console.error('Error getting AI solution:', aiError);
      savedData.aiError = aiError.message;
      await savedData.save();
      
      // Send error to front
      io.emit('aiError', {
        id: savedData._id,
        error: aiError.message
      });
    }
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'An error occurred while processing your request'
    });
  }
});

app.post('/api/extract-quiz', async (req, res) => {
  try {
    // Validate request body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        error: 'Request body is empty',
        details: 'Please provide HTML content in the request body'
      });
    }

    const { html } = req.body;
    if (!html) {
      return res.status(400).json({ 
        error: 'HTML content is required',
        details: 'Please provide HTML content in the request body'
      });
    }

    // Check if quiz extraction is enabled
    const isExtractQuizEnabled = await getConfig('extract_quiz_enabled');
    if (!isExtractQuizEnabled) {
      return res.status(403).json({ 
        error: 'Quiz extraction feature is currently disabled',
        details: 'Please contact the administrator to enable this feature'
      });
    }

    // Create a new extracted quiz entry with a placeholder for extractedContent
    const extractedQuiz = new ExtractedQuiz({
      extractedContent: 'Processing...', // Temporary placeholder
      status: 'pending'
    });
    
    const savedQuiz = await extractedQuiz.save();
    
    // Send data immediately to front via socket
    io.emit('newExtractedQuiz', savedQuiz);
    
    // Send initial response to client
    res.status(201).json(savedQuiz);
    
    // Process HTML extraction in parallel
    try {
      const extractedContent = await extractQuizFromHtml(html);

      if (extractedContent === "NONE") {
        savedQuiz.extractedContent = "Aucun QCM trouvé dans le HTML";
        savedQuiz.status = 'ignored';
        await savedQuiz.save();
        
        // Send update via socket
        io.emit('quizIgnored', {
          id: savedQuiz._id,
          extractedContent: "Aucun QCM trouvé dans le HTML",
          status: 'ignored'
        });
      } else {
        savedQuiz.extractedContent = extractedContent;
        savedQuiz.status = 'completed';
        await savedQuiz.save();

        console.log(["extractedContent", extractedContent]);

        // Send updated data with extracted quiz via socket
        io.emit('quizExtracted', {
          id: savedQuiz._id,
          extractedContent: extractedContent,
          status: 'completed'
        });
      }
      
    } catch (extractionError) {
      console.error('Error extracting quiz:', extractionError);
      savedQuiz.status = 'error';
      savedQuiz.error = extractionError.message;
      await savedQuiz.save();
      
      // Send error to front via socket
      io.emit('extractionError', {
        id: savedQuiz._id,
        error: extractionError.message
      });
    }
  } catch (error) {
    console.error('Error processing HTML:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'An error occurred while processing the HTML'
    });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const data = await Data.find().sort({ timestamp: -1 }).limit(30);
    res.json(data);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new endpoint to get all extracted quizzes
app.get('/api/extracted-quizzes', async (req, res) => {
  try {
    const quizzes = await ExtractedQuiz.find().sort({ timestamp: -1 }).limit(30);
    res.json(quizzes);
  } catch (error) {
    console.error('Error retrieving extracted quizzes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configuration endpoints
app.get('/api/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await getConfig(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    res.json({ key, value });
  } catch (error) {
    console.error('Error getting configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const config = await setConfig(key, value);
    res.json(config);
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 