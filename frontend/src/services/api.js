import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api'
});

export const getScoreboard = (wedstrijdId) => api.get(`/scores/${wedstrijdId}`);
export const getRitten = () => api.get('/ritten');
export const getRit = (id) => api.get(`/ritten/${id}`);
export const triggerScrape = (ritId) => api.post(`/ritten/${ritId}/scrape`);

// 👇 HIER zit je nieuwe versie
export const kiesRenner = async (data) => {
    try {
        const res = await api.post('/draft/kies', data);
        return res;
    } catch (err) {
        console.error('Fout bij kiesRenner:', err.response?.data || err.message);
        throw err;
    }
};

export default api;