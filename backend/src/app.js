const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: 'http://localhost:5173', // Geef je frontend expliciet toegang
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());


app.get('/test', (req, res) => {
    res.send('De server reageert!');
});


const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const draftRoutes = require('./routes/draft');
const rennersRoutes = require('./routes/renners');
const spelersRoutes = require('./routes/spelers');
const transferRoutes = require('./routes/transfer');
const wedstrijdenRoutes = require('./routes/wedstrijden');
const rittenRoutes = require('./routes/ritten');


app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/draft', draftRoutes);
app.use('/api/renners', rennersRoutes);
app.use('/api/spelers', spelersRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/wedstrijden', wedstrijdenRoutes);
app.use('/api/ritten', rittenRoutes);


app.get('/', (req, res) => {
    res.json({ bericht: 'Wielermanager API werkt!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});