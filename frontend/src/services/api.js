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
// src/services/api.js
export const triggerScrape = (id) => api.post(`/ritten/${id}/auto-scrape`);

export const getRenners = () => api.get('/renners');
export const getBeschikbareRenners = () => api.get('/renners/beschikbaar');
export const getSpelers = () => api.get('/spelers');

export const getWedstrijden = () => api.get('/wedstrijden');
export const getWedstrijd = (slug) => api.get(`/wedstrijden/${slug}`);
export const getRittenVanWedstrijd = (slug) => api.get(`/ritten/wedstrijd/${slug}`);

// Draft
export const kiesRenner = async (data) => {
    try {
        const res = await api.post('/draft/kies', data);
        return res;
    } catch (err) {
        console.error('Fout bij kiesRenner:', err.response?.data || err.message);
        throw err;
    }
};

// Admin
export const getAdminRitten = () => api.get('/admin/ritten');
export const getAdminRenners = () => api.get('/admin/renners');
export const getAdminDrafts = () => api.get('/admin/drafts');
export const getAdminWedstrijden = () => api.get('/admin/wedstrijden');

export const importStartlist = (url) => api.post('/admin/import-startlist', { url });
export const scrapeRit = (ritId, ritNummer) => api.post('/admin/scrape-rit', { ritId, ritNummer });

export const addRit = (data) => api.post('/admin/ritten/add', data);

export const deleteRit = (id) => api.delete(`/admin/ritten/${id}`);
export const deleteRenner = (id) => api.delete(`/admin/renners/${id}`);
export const deleteAllRenners = () => api.delete('/admin/renners-all');

export const deleteAllDrafts = () => api.delete('/admin/drafts-all');
export const deleteDraftById = (id) => api.delete(`/admin/drafts/${id}`);
export const getTeams = (sessieId) => api.get(`/draft/teams/${sessieId}`);
export const getActieveSpeler = () => api.get('/draft/actieve-speler');

export default api;