/**
 * CONTENT SCRIPT - YouTube Bookmark Extension
 * Si esegue nel contesto delle pagine YouTube per aggiungere funzionalità di bookmark.
 * Gestisce: bottone bookmark nei controlli player, marker timeline, storage bookmark,
 * comunicazione con sidepanel/background, navigazione video e salto timestamp.
 */

(() => {
    let youtubeLeftControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];

    // Funzione per controllare se l'extension context è ancora valido
    function isExtensionContextValid() {
        try {
            return chrome.runtime && chrome.runtime.id;
        } catch (error) {
            return false;
        }
    }

    // Ascolta messaggi dal background
    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        // Controllo di sicurezza: verifica che l'estensione sia ancora attiva
        // e che il messaggio ricevuto non sia null/undefined
        if (!isExtensionContextValid() || !obj) {
            console.warn("Message ignored: extension context invalid");
            return;
        }
        const { type, videoId, timestamp } = obj;

        // CASO 1: Nuovo video caricato (messaggio dal background script)
        // Viene inviato quando l'utente naviga su un nuovo video YouTube
        if (type === "NEW") {
            currentVideo = videoId;
            newVideoLoaded();
        }

        // CASO 2: Salto a timestamp specifico (messaggio dal sidepanel)
        // Quando l'utente clicca su un bookmark nel sidepanel
        if (type === "JUMP") {
            youtubePlayer.currentTime = timestamp;
        }

        // CASO 3: Eliminazione bookmark singolo (messaggio dal sidepanel)
        // Quando l'utente clicca il bottone elimina su un bookmark specifico
        if (type === "DELETE") {
            deleteBookmarkStorage(timestamp);
        }

        // CASO 4: Eliminazione tutti i bookmark (messaggio dal sidepanel)
        // Quando l'utente clicca "Cancella Tutto" nel footer
        if (type === "DELETEALL") {
            deleteAllBookmarksStorage();
        }

        // CASO 5: Creazione nuovo bookmark (messaggio dal sidepanel)
        // Quando l'utente clicca il bottone "Aggiungi Bookmark" nel sidepanel
        if (type === "CREATE_BOOKMARK") {
            addNewBookmarkEventHandler();
        }
    })


    const addBookmarkMarkers = async () => {
        try {
            // Selettori per la progress bar di YouTube
            const progressBar = await waitForElement(".ytp-progress-bar-container") ||
                await waitForElement(".ytp-chrome-bottom .ytp-progress-bar") ||
                await waitForElement(".ytp-progress-bar");

            if (!progressBar) {
                console.warn("Progress bar non trovata");
                return;
            }

            // Ottieni la durata totale del video
            const videoDuration = youtubePlayer.duration;
            if (!videoDuration) return;

            // Rimuovi marker esistenti per evitare duplicati
            document.querySelectorAll('.bookmark-marker').forEach(marker => marker.remove());

            // Carica i bookmark correnti
            const bookmarks = await fetchBookmarks();

            // Crea un marker per ogni bookmark
            bookmarks.forEach(bookmark => {
                createBookmarkMarker(progressBar, bookmark.time, videoDuration);
            });

        } catch (error) {
            console.error("Errore nel creare i marker:", error);
        }
    };



    const createBookmarkMarker = (progressBar, bookmarkTime, videoDuration) => {
        // Crea l'elemento marker
        const marker = document.createElement('div');
        marker.className = 'bookmark-marker';

        // Calcola la posizione percentuale sulla timeline
        const positionPercent = (bookmarkTime / videoDuration) * 100;

        // Stili CSS per il marker
        marker.style.cssText = `
        position: absolute;
        width: 8px;
        height: 8px;
        background-color: white;
        border: 2px solid #ff0000;
        border-radius: 50%;
        top: 50%;
        left: ${positionPercent}%;
        transform: translate(-50%, -50%);
        z-index: 100;
        pointer-events: none;
        box-shadow: 0 0 4px rgba(0,0,0,0.5);
        `;

        // Aggiungi tooltip opzionale
        marker.title = `Bookmark: ${getTime(bookmarkTime)}`;

        // Aggiungi alla progress bar
        progressBar.appendChild(marker);
    };


    //Elimina tutti i bookmark per il video corrente dal Chrome Storage
    //Viene chiamata quando l'utente clicca "Cancella Tutto" nel sidepanel
    const deleteAllBookmarksStorage = async () => {
        try {
            chrome.storage.sync.set({
                [currentVideo]: JSON.stringify([])
            }, () => {
                if (!chrome.runtime.lastError) {
                    console.log("Bookmark deleted successfully");
                }
                // Aggiorna i marker sulla timeline dopo l'eliminazione
                // Il setTimeout evita problemi di timing con lo storage
                setTimeout(() => {
                    addBookmarkMarkers();  // Rimuove tutti i puntini dalla timeline
                }, 500);
            });
        } catch (error) {
            console.error("Error in deleteAllBookmark:", error);
        }
    }


    //Elimina un bookmark specifico dal Chrome Storage basandosi sul timestamp
    //Viene chiamata quando l'utente clicca il bottone elimina su un singolo bookmark nel sidepanel
    const deleteBookmarkStorage = async (timestamp) => {
        try {
            currentVideoBookmarks = await fetchBookmarks();

            // Trova e rimuovi il bookmark con quel timestamp
            const indexToDelete = currentVideoBookmarks.findIndex(bookmark => bookmark.time === timestamp);

            // Rimuove 1 elemento dall'array a partire dall'indice trovato
            if (indexToDelete !== -1) {
                currentVideoBookmarks.splice(indexToDelete, 1);

            } else {
                console.error(" Bookmark not found");
                return;
            }

            console.log("After delete:", currentVideoBookmarks.length);

            // Salva l'array aggiornato (senza il bookmark eliminato) nel Chrome Storage
            chrome.storage.sync.set({
                [currentVideo]: JSON.stringify(currentVideoBookmarks)
            }, () => {
                // Callback eseguito dopo che il salvataggio è completato
                if (!chrome.runtime.lastError) {
                    console.log("Bookmark deleted successfully");
                    // Aggiorna i marker visivi sulla timeline di YouTube
                    setTimeout(() => {
                        addBookmarkMarkers();
                    }, 500);
                }
            });
        } catch (error) {
            // Gestisce errori generici (extension context invalidated, etc.)
            console.error("Error in deleteBookmark:", error);
        }
    }

    // Carica bookmark dal storage
    const fetchBookmarks = () => {
        return new Promise((resolve) => {
            // Controlla se l'extension context è valido
            if (!isExtensionContextValid()) {
                console.warn('Extension context invalidated, cannot fetch bookmarks');
                resolve([]);
                return;
            }
            try {
                // Richiede i dati dal Chrome Storage Sync usando currentVideo come chiave
                // Storage sync sincronizza i dati tra dispositivi con lo stesso account Google
                chrome.storage.sync.get([currentVideo], (obj) => {
                    // Controlla anche chrome.runtime.lastError
                    if (chrome.runtime.lastError) {
                        console.error('Storage error:', chrome.runtime.lastError);
                        resolve([]); // Restituisce array vuoto per continuare l'esecuzione
                        return;
                    }
                    // Se esistono bookmark per questo video, li deserializza da JSON
                    // Altrimenti restituisce array vuoto per video senza bookmark
                    resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
                });

            } catch (error) {
                console.error('Error fetching bookmarks:', error);
                //restituisce array vuoto
                resolve([]);
            }
        });

    }


    async function addNewBookmarkEventHandler() {

        //Controlla extension context prima di procedere
        if (!isExtensionContextValid()) {
            console.warn('Cannot save bookmark: extension context invalid');
            alert('Errore: Estensione non disponibile. Ricarica la pagina.');
            return;
        }

        // Controlla che youtubePlayer esista
        if (!youtubePlayer) {
            console.error('YouTube player not found');
            alert('Errore: Player YouTube non trovato');
            return;
        }

        // Ottiene il tempo corrente del video in secondi 
        const currentTime = youtubePlayer.currentTime;

        // Prima di salvare un nuovo bookmark, ricarica la lista aggiornata
        currentVideoBookmarks = await fetchBookmarks();


        // Crea un oggetto bookmark con le informazioni del timestamp
        const newBookmark = {
            time: currentTime,
            title: "Bookmark at " + getTime(currentTime),
            date: new Date().toISOString()
        }

        // Salva tutto insieme con gestione errori
        try {
            chrome.storage.sync.set({
                [currentVideo]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a, b) => a.time - b.time))
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving bookmark:', chrome.runtime.lastError);
                    alert('Errore nel salvare il bookmark');
                } else {
                    console.log("Bookmark saved successfully");
                    //Aggiorna i marker dopo aver salvato
                    setTimeout(() => {
                        addBookmarkMarkers();
                    }, 500);
                }
            });
        } catch (error) {
            console.error('Error saving bookmark:', error);
            alert('Errore nel salvare il bookmark');
        }
    }


    //viene chiamata ogni volta che l'utente cambia video su yt
    const newVideoLoaded = async () => {
        try {
            // Controlla duplicati
            if (document.querySelector(".bookmark-btn")) {
                console.log("Bookmark button already exists");
                return;
            }

            // Assicura che l’ID video sia aggiornato
            const v = new URLSearchParams(location.search).get("v");
            if (!v) { return; }
            currentVideo = v;

            // Attendi i controlli con selettori più affidabili
            const controls = await waitForElement(".ytp-left-controls") ||
                await waitForElement(".ytp-chrome-controls .ytp-left-controls") ||
                await waitForElement("div.ytp-left-controls");

            const player = await waitForElement("video.video-stream") ||
                await waitForElement("video.html5-video-container") ||
                await waitForElement("video");

            console.log("Controls found:", controls);
            console.log("Player found:", player);

            if (!controls || !player) {
                console.error("Controls or player not found after all attempts");
                console.error("Available controls:", document.querySelectorAll("[class*='ytp']"));
                console.error("Available videos:", document.querySelectorAll("video"));
                return;
            }

            youtubeLeftControls = controls;
            youtubePlayer = player;

            // Controlla di nuovo se il bottone è stato aggiunto nel frattempo
            if (controls.querySelector(".bookmark-btn")) {
                console.log("Bookmark button already exists in controls");
                return;
            }

            // Crea bottone
            const bookmarkBtn = document.createElement("img");
            // Controlla extension context prima di usare chrome.runtime.getURL
            if (!isExtensionContextValid()) {
                console.warn('Extension context invalid, cannot create bookmark button');
                return;
            }

            bookmarkBtn.src = chrome.runtime.getURL("icons/bookmark.png");
            bookmarkBtn.className = "ytp-button bookmark-btn";
            bookmarkBtn.title = "Salva timestamp";


            console.log("Adding bookmark button to controls...");
            controls.appendChild(bookmarkBtn);
            bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);

            console.log(" Bookmark button added successfully");


            setTimeout(() => {
                addBookmarkMarkers();
            }, 2000); // Aspetta che YouTube si stabilizzi


        } catch (e) {
            console.error("Errore in newVideoLoaded:", e);
        }

    }



    // PROMISE: Funzione che aspetta che un elemento si carichi nel DOM
    const waitForElement = (selector, timeout = 5000) => {
        return new Promise((resolve) => {
            const start = performance.now();

            const checkElement = () => {
                const element = document.querySelector(selector);

                if (element) {
                    console.log(` Element found: ${selector}`);
                    return resolve(element);
                }

                // Controlla se è scaduto il timeout
                if (performance.now() - start > timeout) {
                    console.warn(` Timeout for element: ${selector}`);
                    return resolve(null);
                }

                // Riprova dopo 100ms
                setTimeout(checkElement, 100);
            };

            // Inizia il controllo
            checkElement();
        });
    }



    const getTime = (t) => {
        // Crea un nuovo oggetto Date partendo da 0 (1 gennaio 1970, 00:00:00)
        var date = new Date(0);
        // Imposta i secondi della data (es: se t=125, imposta 125 secondi = 2 minuti e 5 secondi)
        date.setSeconds(t);

        //estrae HH:MM:SS
        return date.toISOString().substring(11, 19);
    }



    //Funzione di inizializzazione che gestisce il caricamento dell'estensionesu una pagina YouTube. 
    // Estrae l'ID video dalla URL e avvia il processo di creazione del bottone bookmark.

    const init = () => {
        const videoId = new URLSearchParams(location.search).get("v");
        if (!videoId) return;
        currentVideo = videoId;
        newVideoLoaded();
    };


    //Event Listener per la navigazione SPA (Single Page Application) di YouTube non ricarica la pagina 
    // quando navigi tra video, ma usa la history API
    // L'evento "yt-navigate-finish" viene triggerato quando la navigazione è completata
    document.addEventListener("yt-navigate-finish", () => {
        setTimeout(init, 500);
    });

    //Gestione dell'inizializzazione basata sullo stato del documento 
    // Garantisce che l'estensione funzioni sia al primo caricamento che durante la navigazione successiva
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }


})()


