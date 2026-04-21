import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api'
});

export const getScoreboard = (wedstrijdId) => api.get(`/scores/${wedstrijdId}`);
export const getRitten = () => api.get('/ritten');
export const getRit = (id) => api.get(`/ritten/${id}`);
export const getDraft = (wedstrijdId) => api.get(`/draft/${wedstrijdId}`);
export const getSpelers = () => api.get('/spelers');
export const triggerScrape = (ritId) => api.post(`/ritten/${ritId}/scrape`);

export default api;