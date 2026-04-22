const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const draftRoutes = require('./routes/draft');
const rennersRoutes = require('./routes/renners');
const spelersRoutes = require('./routes/spelers');
const transferRoutes = require('./routes/transfer');



app.use(cors());
app.use(express.json());

app.use('/api/draft', draftRoutes);
app.use('/api/renners', rennersRoutes);
app.use('/api/spelers', spelersRoutes);
app.use('/api/transfer', transferRoutes);

app.get('/', (req, res) => {
    res.json({ bericht: 'Wielermanager API werkt!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});