require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

const { connectDB } = require('./config/db');
const healthRoutes = require('./routes/health');
const promptRoutes = require('./routes/prompts');
const storyboardRoutes = require('./routes/storyboards');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', promptRoutes);
app.use('/api', storyboardRoutes);

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
