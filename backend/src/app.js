require('dotenv').config();

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

const { connectDB } = require('./config/db');
const healthRoutes = require('./routes/health');
const promptRoutes = require('./routes/prompts');
const storyboardRoutes = require('./routes/storyboards');
const imageRoutes = require('./routes/images');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Generated shot assets (BACKEND-005 real generation wiring) — a
// disposable, gitignored directory, same pattern as remotion/out/ and
// ai-service/rag/data/.
app.use('/media', express.static(path.join(__dirname, '..', 'generated')));

app.use('/api', healthRoutes);
app.use('/api', promptRoutes);
app.use('/api', storyboardRoutes);
app.use('/api', imageRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Backend server listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB, server not started:', err.message);
      process.exit(1);
    });
}

module.exports = app;
