const mongoose = require('mongoose');

async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set (see backend/.env, derived from .env.example)');
  }
  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = { connectDB };
