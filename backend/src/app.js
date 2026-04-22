const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const adminRoutes = require('./routes/admin');
app.get('/test', (req, res) => {
    res.send('De server reageert!');
});
app.use('/api/admin', adminRoutes);

const draftRoutes = require('./routes/draft');
const rennersRoutes = require('./routes/renners');
const spelersRoutes = require('./routes/spelers');
const transferRoutes = require('./routes/transfer');
const wedstrijdenRoutes = require('./routes/wedstrijden');



app.use('/api/draft', draftRoutes);
app.use('/api/renners', rennersRoutes);
app.use('/api/spelers', spelersRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/wedstrijden', wedstrijdenRoutes);

app.get('/', (req, res) => {
    res.json({ bericht: 'Wielermanager API werkt!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});