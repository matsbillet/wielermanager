import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api'
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

export const loginGebruiker = (data) => api.post('/auth/login', data);
export const registreerGebruiker = (data) => api.post('/auth/register', data);

export const getScoreboard = (wedstrijdId) => api.get(`/scores/${wedstrijdId}`);
export const getRitten = () => api.get('/ritten');
export const getRit = (id) => api.get(`/ritten/${id}`);
export const triggerScrape = (ritId) => api.post(`/ritten/${ritId}/scrape`);

export const getRenners = () => api.get('/renners');
export const getBeschikbareRenners = () => api.get('/renners/beschikbaar');
export const getSpelers = () => api.get('/spelers');

export const getWedstrijden = () => api.get('/wedstrijden');
export const getWedstrijd = (slug) => api.get(`/wedstrijden/${slug}`);
export const getRittenVanWedstrijd = (slug) => api.get(`/wedstrijden/${slug}/ritten`);

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