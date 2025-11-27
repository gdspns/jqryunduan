const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ message: 'register' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ message: 'login' });
});

app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
});
