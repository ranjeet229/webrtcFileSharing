require('dotenv').config(); // load .env first

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./db');
const File = require('./models/File');
const multer = require('multer');
const path = require('path');

// connect to MongoDB
connectDB(process.env.MONGO_URI);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = new File({
    filename: req.file.originalname,
    path: req.file.filename,
    size: req.file.size
  });
  await file.save();
  res.json({ success: true, file });
});

// List files
app.get('/api/files', async (req, res) => {
  const files = await File.find().sort({ createdAt: -1 });
  res.json(files);
});

// WebRTC signaling via Socket.IO
io.on('connection', socket => {
  console.log('New client connected');

  socket.on('signal', data => {
    const { to, signal } = data;
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('join-room', room => {
    socket.join(room);
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start server on env PORT or default 5000
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
