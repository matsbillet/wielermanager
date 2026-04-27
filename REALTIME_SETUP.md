# Real-time Draft Updates - Setup Guide

## Wat is geïmplementeerd?

Je DraftPage heeft nu **real-time updates** dankzij Supabase. Dit betekent:

- 🔄 **Automatische refresh**: Wanneer iemand in een ander venster/device een renner kiest, zie je dat onmiddellijk
- ⚡ **Geen handmatig refreshen nodig**: De pagina luistert naar database changes
- 👥 **Multi-user experience**: Iedereen ziet dezelfde staat tegelijk

## Hoe werkt het?

### 1. **Supabase Client** (`frontend/src/services/supabaseClient.js`)

Maakt een verbinding met Supabase met de anonieme key (public read/write).

### 2. **Real-time Hook** (`frontend/src/hooks/useRealtimeDraft.js`)

- Luistert naar wijzigingen in de `draft` tabel (INSERT, UPDATE, DELETE)
- Luistert naar wijzigingen in de `draft_sessies` tabel (voor actieve speler)
- Triggert een callback wanneer iets verandert

### 3. **DraftPage Updates**

- Roept `useRealtimeDraft` aan om real-time events te ontvangen
- Bij elke wijziging: refreshes teams en actieve speler
- Werkt samen met je bestaande API calls

## Architectuur

```
┌─────────────────────────────────┐
│      Supabase Database          │
│  (draft, draft_sessies tables)  │
└────────┬────────────────────────┘
         │ Real-time updates
         ▼
┌─────────────────────────────────┐
│   Supabase Client (Frontend)    │
│  (useRealtimeDraft hook)        │
└────────┬────────────────────────┘
         │ Callbacks triggeren
         ▼
┌─────────────────────────────────┐
│      DraftPage Component        │
│  (refreshDraftData function)    │
│  (API calls to backend)         │
└─────────────────────────────────┘
```

## Stap-voor-stap flow

### Wanneer Speler A een renner kiest:

1. **Speler A klikt op "Kies [renner]"**
   - `handleKiesRenner()` is aangeroepen
   - Renner wordt lokaal verwijderd (optimistic update)
   - API call naar backend: `POST /api/draft/kies`

2. **Backend verwerkt de keuze**
   - Voert RPC functie uit
   - Inserts record in `draft` tabel
   - Supabase stuurt real-time event uit

3. **Alle clients ontvangen het event** (Supabase real-time)
   - `useRealtimeDraft` hook triggert callback
   - `refreshDraftData()` wordt aangeroepen
   - Haalt new teams en actieve speler op

4. **UI update voor iedereen**
   - Teams tellers updaten
   - Actieve speler indicator verschuift
   - Beschikbare renners worden bijgewerkt

## Environment Variables

In `frontend/.env.local`:

```
VITE_SUPABASE_URL=https://dklagipnrlasrcgcicbe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Deze keys moeten matched zijn met je Supabase project.

## Troubleshooting

### Probleem: Real-time updates werken niet

**Oplossing 1**: Controleer of Real-time is enabled in Supabase

- Ga naar Supabase dashboard → Replication
- Zorg dat `draft` en `draft_sessies` tabellen hebben replication enabled

**Oplossing 2**: Check de console logs

```javascript
// In DraftPage zie je logs als:
// "Draft wijziging ontvangen: {...}"
// "Draft change detected, refreshing..."
```

**Oplossing 3**: Verifieer de Supabase credentials

```bash
# In frontend/.env.local
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Probleem: Network errors

- Check of je Supabase service up is
- Controleer je internet verbinding
- Check CORS instellingen in Supabase

## Testen

### Test real-time in 2 browser tabs:

1. Open DraftPage in 2 tabs
2. Kies een renner in Tab 1
3. Refresh NIET in Tab 2
4. Je zou Tab 2 automatisch zien updaten

### Debuggen

Voeg dit toe in `useRealtimeDraft.js`:

```javascript
console.log("🟢 Subscribing to real-time events...");
// Bij verandering:
console.log("🔄 Database change:", payload);
```

## Volgende Stappen (Optioneel)

- 🎯 **Error handling**: Voeg retry logic toe als refresh fails
- 📊 **Loading state**: Toon "syncing..." indicator tijdens refresh
- 🔔 **Notifications**: Toon toast message bij elke draft update
- ⏱️ **Polling fallback**: Als WebSockets faillen, val terug op polling

## Codebase aanpassingen

| File                                      | Verandering                         |
| ----------------------------------------- | ----------------------------------- |
| `frontend/package.json`                   | + `@supabase/supabase-js`           |
| `frontend/.env.local`                     | Nieuw: Supabase credentials         |
| `frontend/src/services/supabaseClient.js` | Nieuw: Supabase client              |
| `frontend/src/hooks/useRealtimeDraft.js`  | Nieuw: Real-time hook               |
| `frontend/src/pages/DraftPage.jsx`        | Update: Real-time logica toegevoegd |

---

**Vragen?** Check de [Supabase docs](https://supabase.com/docs/guides/realtime) of de code comments.
