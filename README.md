# Happy Tennis Resort Manager — starter tecnico

Prima base del progetto: Next.js + TypeScript + Supabase.

## Incluso
- Schermata iniziale con accesso e registrazione del primo account.
- Flusso di creazione resort tramite RPC `create_resort_with_owner`.
- Primo utente associato al ruolo `maestro_responsabile`.
- Procedura guidata per completare la creazione del resort dopo la conferma email.\n- Dashboard iniziale prototipale.
- Migrazione SQL iniziale con profili, resort, membership, proprietari e abbonamenti.
- Prime policy RLS per isolare l'accesso ai dati del resort.

## Requisiti
- Node.js 20 o successivo
- Un progetto Supabase
- npm

## Avvio locale
1. `npm install`
2. Copiare `.env.example` in `.env.local`
3. Inserire URL e chiave anonima del progetto Supabase
4. Eseguire la migrazione `supabase/migrations/0001_initial_schema.sql` nell'SQL Editor Supabase
5. `npm run dev`
6. Aprire `http://localhost:3000`

## Flusso iniziale
- La registrazione crea l'utente Supabase Auth.
- Se il progetto richiede conferma email, l'utente deve confermare e poi accedere.
- Dopo l'accesso, la funzione RPC `create_resort_with_owner` crea il resort e assegna al creatore il ruolo `maestro_responsabile`.
- La dashboard legge il resort associato all'utente.

## Importante: stato del progetto
Questo è uno starter tecnico iniziale, non un prodotto pronto per la produzione.
Prima di un utilizzo reale occorre:
- completare il flusso di registrazione quando è attiva la conferma email;
- implementare inviti utenti e gestione dei permessi granulari;
- rafforzare RLS e testare l'isolamento con account di resort diversi;
- aggiungere protezione delle route lato server e gestione sessioni con `@supabase/ssr`;
- integrare un provider di pagamento e webhooks verificati;
- aggiungere controlli anti-abuso, rate limiting, logging, backup e monitoraggio;
- implementare i moduli funzionali, PDF, traduzioni e test automatici;
- effettuare revisione di sicurezza e privacy prima della pubblicazione.

## Scelte architetturali da completare
La specifica prevede ambienti/database indipendenti per resort. Questo starter contiene lo schema del singolo ambiente resort e il modello commerciale centrale è ancora da realizzare. Per il multi-resort commerciale, creare un progetto/database separato per ogni cliente oppure un control-plane centrale con provisioning automatizzato e credenziali isolate. Non usare la sola UI per separare i tenant.
