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
        if (!isExtensionContextValid() || !obj) {
            console.warn("Message ignored: extension context invalid");
            return;
        }
        const { type, videoId } = obj;
        if (type === "NEW") {
            currentVideo = videoId;
            newVideoLoaded();
        }
    })

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
                chrome.storage.sync.get([currentVideo], (obj) => {
                    // Controlla anche chrome.runtime.lastError
                    if (chrome.runtime.lastError) {
                        console.error('Storage error:', chrome.runtime.lastError);
                        resolve([]);
                        return;
                    }
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
            desc: "",
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
                    console.log("✅ Bookmark saved successfully");
                    // Feedback visivo opzionale
                    //showBookmarkSavedFeedback();
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
            // 1. Controlla duplicati
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

            // 6. Controlla di nuovo se il bottone è stato aggiunto nel frattempo
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

    const init = () => {
        const videoId = new URLSearchParams(location.search).get("v");
        if (!videoId) return;
        currentVideo = videoId;
        newVideoLoaded();
    };
    document.addEventListener("yt-navigate-finish", () => {
        setTimeout(init, 500);
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }


    newVideoLoaded();

})()


