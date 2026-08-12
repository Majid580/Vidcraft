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
const jobRoutes = require('./routes/jobs');
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
//
// The CORP override is required, not incidental: helmet defaults every
// response to `Cross-Origin-Resource-Policy: same-origin`, and FR-9's
// assembly step renders inside a headless browser served from Remotion's own
// bundler origin (localhost:3000), which then fetches each shot's still from
// this mount on the API's origin. Under the default policy the browser
// blocks every one of them (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin) and the
// render fails with undecodable images. Scoped to /media alone, which holds
// only generated, non-sensitive media — the strict default still covers the
// API routes below.
app.use(
  '/media',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '..', 'generated')),
);

app.use('/api', healthRoutes);
app.use('/api', promptRoutes);
app.use('/api', storyboardRoutes);
app.use('/api', jobRoutes);
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
