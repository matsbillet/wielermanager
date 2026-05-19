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
export const vulDraftAutomatisch = (sessieId) =>
    api.post("/draft/auto-vullen", { sessieId });
export const syncStartlijst = (wedstrijdId) => {
    return api.post(`/wedstrijden/${wedstrijdId}/sync-startlijst`);
};
export const getScoreboard = (competitieId) =>
    api.get(`/scores/competitie/${competitieId}`);

export const getRitten = () => api.get("/ritten");
export const getRit = (id) => api.get(`/ritten/${id}`);
export const triggerScrape = (id) => api.post(`/ritten/${id}/auto-scrape`);

export const getRenners = () => api.get("/renners");
export const getBeschikbareRenners = (sessieId) =>
    api.get(`/renners/beschikbaar/${sessieId}`);

export const getSpelers = (sessieId) => api.get(`/spelers/${sessieId}`);
export const getSpelersVoorCompetitie = (competitieId) =>
    api.get(`/spelers/competitie/${competitieId}`);

export const getWedstrijden = () => api.get("/wedstrijden");
export const getKlassiekersByYear = (jaar) =>
    api.get(`/wedstrijden/klassiekers/${jaar}`);
export const getWedstrijd = (slug) => api.get(`/wedstrijden/${slug}`);
export const getRittenVanWedstrijd = (slug) =>
    api.get(`/ritten/wedstrijd/${slug}`);

// Verander dit in services/api.js:
export const getHallOfFame = () => api.get('/scores/hall-of-fame');

export const kiesRenner = (data) => api.post("/draft/kies", data);
export const getTeams = (sessieId) => api.get(`/draft/teams/${sessieId}`);
export const getTeamVanSpeler = (sessieId, spelerId) =>
    api.get(`/draft/team/${sessieId}/${spelerId}`);
export const getActieveSpeler = (sessieId) =>
    api.get(`/draft/actieve-speler/${sessieId}`);
export const getSessieVoorCompetitie = (competitieId) =>
    api.get(`/draft/sessie/${competitieId}`);
export const getDraftSessiesVoorCompetitie = (competitieId) =>
    api.get(`/draft/sessies/${competitieId}`);
export const getScoreboardVoorSessie = (sessieId) =>
    api.get(`/scores/sessie/${sessieId}`);

// Handmatig een renner toevoegen via Admin
export const voegRennerToe = (rennerData) => api.post("/renners", rennerData);

export const getUitvallers = (wedstrijdId) => api.get(`/wedstrijden/${wedstrijdId}/uitvallers`);

export const vervangRennerVoorStart = (data) =>
    api.post("/transfer/voor-start", data);
export const blessureWissel = (data) => api.post("/transfer/blessure", data);

export const getAdminRitten = () => api.get("/admin/ritten");
export const getAdminRenners = () => api.get("/admin/renners");

export const getAdminDrafts = (wedstrijdId) => {
    // Als er geen ID is, roepen we gewoon /admin/drafts aan
    // Als er wel een ID is, plakken we die erachter: /admin/drafts/123
    const path = (wedstrijdId && wedstrijdId !== 'undefined')
        ? `/admin/drafts/${wedstrijdId}`
        : `/admin/drafts`;

    return api.get(path);
};
export const getAdminWedstrijden = () => api.get("/admin/wedstrijden");

export const importStartlist = (url, wedstrijdId) =>
    api.post("/admin/import-startlist", { url, wedstrijdId });

// Zoek deze en vervang hem:
export const scrapeRit = (ritId) => api.post(`/ritten/${ritId}/auto-scrape`);

export const addRit = (data) => api.post("/admin/ritten/add", data);

export const deleteRit = (id) => api.delete(`/admin/ritten/${id}`);
export const deleteRenner = (id) => api.delete(`/admin/renners/${id}`);
export const deleteAllRenners = () => api.delete("/admin/renners-all");

export const deleteAllDrafts = () => api.delete("/admin/drafts-all");
export const deleteDraftById = (id) => api.delete(`/admin/drafts/${id}`);

export const maakCompetitie = (data) => api.post("/competitie/create", data);
export const joinCompetitie = (data) => api.post("/competitie/join", data);
export const getMijnCompetities = (userId) =>
    api.get(`/competitie/mijn/${userId}`);
export const previewRaceLifecycle = () =>
    api.get("/admin/race-lifecycle/preview");

export const runRaceLifecycle = (instellingen = {}) =>
    api.post("/admin/race-lifecycle/run", {
        bevestiging: "START",
        aantalBasis: instellingen.aantalBasis,
        aantalBank: instellingen.aantalBank,
    });

export const getDashboardStats = () => api.get("/dashboard/me");

export const scrapePastRitten = async (wedstrijdId) => {
    return await api.post(`/ritten/wedstrijd/${wedstrijdId}/scrape-past`);
};

export const resetAllRitten = async (wedstrijdId) => {
    return await api.post(`/ritten/wedstrijd/${wedstrijdId}/reset-all`);
};

export const forceAutoSync = async () => {
    return await api.post("/ritten/force-sync");
};

export const cancelRit = (ritId) => api.post(`/ritten/${ritId}/cancel`);

export const importVolledigeWedstrijd = (url) =>
    api.post("/admin/import-volledige-wedstrijd", { url });

export const importKlassiekerAlsRit = (pcsUrl) =>
    api.post("/admin/klassieker", { url: pcsUrl });

export const resetRit = async (ritId) => {
    return await api.post(`/ritten/${ritId}/reset`);
};

export const scrapeEindklassement = (wedstrijdId) => {
    return api.post(`/wedstrijden/${wedstrijdId}/scrape-eindklassement`);
};
export const getEindklassement = (wedstrijdId) => {
    return api.get(`/wedstrijden/${wedstrijdId}/eindklassement`);
};
export default api;
