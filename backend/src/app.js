const express = require('express');
const cors = require('cors');
const draftRoutes = require('./src/routes/draft');
// Voeg later ook je scores en renners routes toe

const app = express();

// Cruciaal: dit zorgt dat je React frontend data mag sturen naar deze server
app.use(cors());

// Zorgt dat de server JSON-data begrijpt
app.use(express.json());

// Koppel de draft-routes aan de URL /api/draft
app.use('/api/draft', draftRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});