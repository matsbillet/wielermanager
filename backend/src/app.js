const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { verwerkRaceLifecycle } = require('./services/raceLifecycleService');

const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
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
const scoresRoutes = require('./routes/scores');
const competitieRoutes = require('./routes/competitie');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/draft', draftRoutes);
app.use('/api/renners', rennersRoutes);
app.use('/api/spelers', spelersRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/wedstrijden', wedstrijdenRoutes);
app.use('/api/ritten', rittenRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/competitie', competitieRoutes);

app.get('/', (req, res) => {
    res.json({ bericht: 'Wielermanager API werkt!' });
});

cron.schedule('0 */6 * * *', async () => {
    console.log('Automatische race lifecycle check gestart...');

    try {
        const resultaat = await verwerkRaceLifecycle();
        console.log('Race lifecycle resultaat:', resultaat);
    } catch (error) {
        console.error('Race lifecycle fout:', error.message);
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});