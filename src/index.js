const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const Data = require('./models/Data');
const { solveQuiz } = require('./services/aiService');
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
  .then(() => console.log('Connected to MongoDB'))
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

app.get('/api/data', async (req, res) => {
  try {
    const data = await Data.find().sort({ timestamp: -1 });
    res.json(data);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 