import { useEffect } from "react";
import { supabase } from "../services/supabaseClient";

/**
 * Hook die real-time updates naar de draft tabel luistert
 * Wanneer iemand een renner kiest, worden alle clients automatisch geupdate
 *
 * @param {Function} onDraftChange - Callback wanneer de draft tabel verandert
 * @param {Function} onActivePlayerChange - Callback wanneer de actieve speler verandert
 */
export function useRealtimeDraft(onDraftChange, onActivePlayerChange) {
  useEffect(() => {
    // Subscribe naar alle wijzigingen in de draft tabel
    const draftSubscription = supabase
      .channel("draft_changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Luister naar INSERT, UPDATE, DELETE
          schema: "public",
          table: "draft",
        },
        (payload) => {
          console.log("Draft wijziging ontvangen:", payload);
          // Trigger de callback zodat de data wordt vernieuwd
          if (onDraftChange) {
            onDraftChange(payload);
          }
        },
      )
      .subscribe();

    // Subscribe naar veranderingen in draft_sessies (voor actieve speler)
    const activePlayerSubscription = supabase
      .channel("active_player_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "draft_sessies",
        },
        (payload) => {
          console.log("Draft sessie wijziging ontvangen:", payload);
          if (onActivePlayerChange) {
            onActivePlayerChange(payload);
          }
        },
      )
      .subscribe();

    // Cleanup: Unsubscribe wanneer component unmount
    return () => {
      draftSubscription.unsubscribe();
      activePlayerSubscription.unsubscribe();
    };
  }, [onDraftChange, onActivePlayerChange]);
}
