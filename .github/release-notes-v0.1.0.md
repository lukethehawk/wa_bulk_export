# WA Bulk Export v0.1.0

Prima versione di WA Bulk Export, estensione Firefox open source e gratuita per esportare tutte le conversazioni WhatsApp Web in un'unica operazione.

### Funzioni
- Esportazione bulk delle chat disponibili su WhatsApp Web, incluse quelle archiviate e i gruppi.
- Lettura progressiva dei messaggi più vecchi raggiungibili e deduplicazione.
- Un unico archivio ZIP con file **TXT** e **JSON** per ogni chat.
- File `manifest.json` per il riepilogo e la segnalazione di eventuali errori.
- Avanzamento ed eventuale annullamento; elaborazione locale, senza servizi esterni.

### Test
- Build automatica e test unitari superati.
- Test manuale riportato dall'utilizzatore: oltre 500 chat esportate, con cronologia fino al 2024.

### Come installare il pacchetto
1. Scarica **wa-bulk-export-0.1.0.zip** qui sotto.
2. **Estrai il pacchetto** in una cartella.
3. Firefox: apri `about:debugging#/runtime/this-firefox`.
4. Seleziona **Carica componente aggiuntivo temporaneo** e indica il file `manifest.json` estratto.
5. Apri/ricarica `https://web.whatsapp.com/`, poi clicca **Esporta tutte le chat**.

**Attenzione:** questo ZIP contiene un componente aggiuntivo *non firmato da Mozilla*, installabile temporaneamente tramite debugging; non è ancora un'estensione installabile in modo permanente nel Firefox standard. Per la distribuzione permanente occorrerà la firma Mozilla (AMO).

**Limiti:** il backup include testo e metadati, non gli allegati binari (foto, audio, documenti, video). La cronologia recuperabile dipende da quella accessibile a WhatsApp Web. Lo ZIP esportato contiene conversazioni private: conservarlo in modo sicuro.

Per verificare l'integrità del pacchetto, confronta l'hash SHA-256 con `SHA256SUMS.txt`.
