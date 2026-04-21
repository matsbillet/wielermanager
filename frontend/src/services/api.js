// frontend/src/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api'
});

// Aangepast naar jouw backend-structuur:
export const getScoreboard = () => api.get('/stand/totaal'); // Haalt de totale stand op
export const triggerScrape = (ritId, url) => api.post('/admin/scrape-rit', { ritId, url });

// Deze stonden al goed of zijn voor later:
export const getRitten = () => api.get('/ritten');
export const getRit = (id) => api.get(`/ritten/${id}`);

export const kiesRenner = async (data) => {
    try {
        // Data moet bevatten: { speler_id, renner_id, beurt_nummer }
        const res = await api.post('/draft/kies', data);
        return res.data;
    } catch (err) {
        console.error('Fout bij kiesRenner:', err.response?.data || err.message);
        throw err;
    }
};

export default api;