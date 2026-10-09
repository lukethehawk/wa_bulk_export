# WA Bulk Export

Estensione Firefox open source e gratuita per **esportare tutte le chat di WhatsApp Web in un'unica operazione** (anche quelle archiviate).

**Stato: prototipo sperimentale (v0.1.0), non ancora verificato con una sessione WhatsApp reale.**

## Cosa fa

- Un solo pulsante: **Esporta tutte le chat**, senza selezione manuale.
- Legge le conversazioni disponibili su WhatsApp Web, individuali e di gruppo.
- Recupera progressivamente i messaggi precedenti utilizzando WA-JS, eliminando i duplicati.
- Genera un unico ZIP con un file `.json` e un `.txt` per ogni conversazione.
- Aggiunge `manifest.json` con numero di messaggi, stato e possibili errori per chat.
- Mostra l'avanzamento; permette di interrompere l'operazione.
- Tutto in locale, senza servizi remoti, account aggiuntivi o API a pagamento.

**Limiti:** il recupero riguarda soltanto i messaggi resi disponibili da WhatsApp Web. Non possiamo garantire che siano presenti tutti quelli storici conservati sul telefono o eliminati. Questa versione esporta **solo testo e metadati**: foto, video, audio, documenti e loro bytes non sono inclusi. Alcuni tipi di messaggio potrebbero non contenere testo; per questi viene riportato il tipo. Ogni chat fallita viene segnalata nel manifest invece di bloccare il backup.

## Installazione e uso (Firefox 128+)

Serve Node.js 20.11+ (consigliato 22).

```sh
git clone https://github.com/lukethehawk/wa_bulk_export.git
cd wa_bulk_export
npm install
npm test
npm run build
```

Per provare la versione di sviluppo:

1. Apri `about:debugging#/runtime/this-firefox`.
2. Premi **Carica componente aggiuntivo temporaneo**.
3. Seleziona `dist/manifest.json`.
4. Apri o **ricarica** `https://web.whatsapp.com/` e attendi che sia collegato.
5. Clicca sull'icona dell'estensione e su **Esporta tutte le chat**.
6. Attendi il download dello ZIP. Mantieni aperta la scheda di WhatsApp Web: puoi invece chiudere il popup dell'estensione.

Per generare un file ZIP dell'estensione stessa: `npm run package`. Lo ZIP generato è il **pacchetto da installare/testare**, distinto dall'archivio ZIP dei messaggi esportati. La CI pubblica il pacchetto come artifact della build.

## Privacy e sicurezza

L'estensione accede soltanto a `web.whatsapp.com`. WA-JS e fflate vengono impacchettati localmente: nessun JavaScript remoto viene caricato dall'estensione. Il contenuto delle chat non viene inviato a server esterni né memorizzato sul repository. Il file ZIP finale contiene dati personali: conservarlo in modo sicuro, non pubblicarlo su GitHub.

Il codice utilizza API interne **non ufficiali** di WhatsApp Web, che possono cambiare senza preavviso; l'automazione potrebbe non essere conforme ad alcune condizioni d'uso del servizio. Usare esclusivamente con chat di cui si ha legittima disponibilità. Non sono implementate funzioni di invio messaggi.

## Note tecniche

- Firefox Manifest V3, content script in `MAIN` world (supportato da Firefox 128).
- Libreria `@wppconnect/wa-js` fissata alla versione 4.6.1, usata per `chat.list` e `chat.getMessages`.
- Lettura paginata di 250 messaggi con rilevazione dello stallo.
- Archiviazione ZIP locale tramite `fflate`.
- `npm test`: test unitari del core senza accedere a WhatsApp.

## Licenza

MIT per il codice di questa estensione. La dipendenza WA-JS è distribuita con licenza Apache-2.0; consultare i file della dipendenza per le relative condizioni.
