import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:3000/api",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

export const loginGebruiker = (data) => api.post("/auth/login", data);
export const registreerGebruiker = (data) => api.post("/auth/register", data);

export const getScoreboard = (competitieId) => api.get(`/scores/competitie/${competitieId}`);

export const getRitten = () => api.get("/ritten");
export const getRit = (id) => api.get(`/ritten/${id}`);
export const triggerScrape = (id) => api.post(`/ritten/${id}/auto-scrape`);

export const getRenners = () => api.get("/renners");
export const getBeschikbareRenners = (sessieId) => api.get(`/renners/beschikbaar/${sessieId}`);

export const getSpelers = (sessieId) => api.get(`/spelers/${sessieId}`);
export const getSpelersVoorCompetitie = (competitieId) =>
    api.get(`/spelers/competitie/${competitieId}`);

export const getWedstrijden = () => api.get("/wedstrijden");
export const getWedstrijd = (slug) => api.get(`/wedstrijden/${slug}`);
export const getRittenVanWedstrijd = (slug) => api.get(`/ritten/wedstrijd/${slug}`);

export const kiesRenner = (data) => api.post("/draft/kies", data);
export const getTeams = (sessieId) => api.get(`/draft/teams/${sessieId}`);
export const getTeamVanSpeler = (sessieId, spelerId) =>
    api.get(`/draft/team/${sessieId}/${spelerId}`);
export const getActieveSpeler = (sessieId) =>
    api.get(`/draft/actieve-speler/${sessieId}`);
export const getSessieVoorCompetitie = (competitieId) =>
    api.get(`/draft/sessie/${competitieId}`);

export const vervangRennerVoorStart = (data) =>
    api.post("/transfer/voor-start", data);
export const blessureWissel = (data) =>
    api.post("/transfer/blessure", data);

export const getAdminRitten = () => api.get("/admin/ritten");
export const getAdminRenners = () => api.get("/admin/renners");
export const getAdminDrafts = () => api.get("/admin/drafts");
export const getAdminWedstrijden = () => api.get("/admin/wedstrijden");

export const importStartlist = (url, wedstrijdId) =>
    api.post("/admin/import-startlist", { url, wedstrijdId });

export const scrapeRit = (ritId, ritNummer) =>
    api.post("/admin/scrape-rit", { ritId, ritNummer });

export const addRit = (data) => api.post("/admin/ritten/add", data);

export const deleteRit = (id) => api.delete(`/admin/ritten/${id}`);
export const deleteRenner = (id) => api.delete(`/admin/renners/${id}`);
export const deleteAllRenners = () => api.delete("/admin/renners-all");

export const deleteAllDrafts = () => api.delete("/admin/drafts-all");
export const deleteDraftById = (id) => api.delete(`/admin/drafts/${id}`);

export const maakCompetitie = (data) => api.post("/competitie/create", data);
export const joinCompetitie = (data) => api.post("/competitie/join", data);
export const getMijnCompetities = (userId) => api.get(`/competitie/mijn/${userId}`);

export default api;