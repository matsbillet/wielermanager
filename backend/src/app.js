const express = require('express');
const cors = require('cors');
require('dotenv').config();

const draftRoutes = require('./routes/draft');
const rennersRoutes = require('./routes/renners');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/draft', draftRoutes);
app.use('/api/renners', rennersRoutes);

app.get('/', (req, res) => {
    res.json({ bericht: 'Wielermanager API werkt!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});