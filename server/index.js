require('dotenv').config();
const path = require('path');
const express = require('express');
const dataRouter = require('./routes/data');
const { apiKeyAuth, apiRateLimit } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRateLimit, apiKeyAuth, dataRouter);

app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`MDE Finance Pro server listening on port ${PORT}`);
});
