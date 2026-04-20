const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes (later invullen)
app.get('/', (req, res) => res.json({ status: 'Wielermanager API werkt!' }));

app.listen(process.env.PORT || 3001, () => {
    console.log('Server draait op poort 3001');
});