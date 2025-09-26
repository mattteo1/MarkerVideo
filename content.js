(() => {
    let youtubeLeftControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];

    // AGGIUNTA: Funzione per controllare se l'extension context è ancora valido
    function isExtensionContextValid() {
        try {
            return chrome.runtime && chrome.runtime.id;
        } catch (error) {
            return false;
        }
    }

    // Ascolta messaggi dal background
    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        const { type, value, videoId } = obj;
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
                resolve([]);
            }
        });

    }





    //viene chiamata ogni volta che l'utente cambia video su yt
    const newVideoLoaded = async () => {

        //cerca se esiste già un bottone con la classe bookmark-btn, se non trova nulla ritorna undefined, sennò contiene elemento HTML
        const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];
        // Quando l'utente cambia video, carica i suoi bookmark salvati
        if (isExtensionContextValid()) {
            currentVideoBookmarks = await fetchBookmarks();
        }

        if (!bookmarkBtnExists) {

            // PROMISE: Aspetta che i controlli si carichino prima di continuare
            // Questa è una operazione asincrona - potrebbe richiedere tempo
            await waitForElement(".ytp-left-controls");

            //Crea un nuovo elemento immagine, ma non mostrarlo ancora
            const bookmarkBtn = document.createElement("img");

            //Controllo extension context prima di usare chrome.runtime.getURL
            if (!isExtensionContextValid()) {
                console.warn('Extension context invalid, cannot create bookmark button');
                return;
            }

            try {
                // Imposta l'icona del pulsante
                bookmarkBtn.src = chrome.runtime.getURL("icons/bookmark.png");
            } catch (error) {
                console.error('Error loading bookmark icon:', error);
                return;
            }


            // Ora bookmarkBtn contiene: <img src="path/to/image.png" class="ytp-button bookmark-btn">
            bookmarkBtn.className = "ytp-button " + "bookmark-btn";

            bookmarkBtn.title = "Click the bookmark current timestamp";

            //Dove aggiungere il pulsante bookmark
            youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];

            //Da dove leggere il timestamp corrente
            youtubePlayer = document.getElementsByClassName("video-stream")[0];

            // Controlla che esistano prima di usarli
            if (youtubeLeftControls && youtubePlayer) {
                //aggiunge bottone, appendChild() agginge figlio a un elemento padre del DOM
                youtubeLeftControls.appendChild(bookmarkBtn);
                bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
            } else {
                console.error("Controlli YouTube non trovati!");
                console.error("youtubeLeftControls:", youtubeLeftControls);
                console.error("youtubePlayer:", youtubePlayer);
            }

        }

    }

    // PROMISE: Funzione che aspetta che un elemento si carichi nel DOM
    const waitForElement = (selector) => {
        // Crea una nuova Promise - è un "contratto" che dice:
        // "Ti prometto che prima o poi troverò questo elemento"
        return new Promise((resolve) => {
            // Funzione che controlla ripetutamente se l'elemento esiste
            const checkElement = () => {
                // Cerca l'elemento nel DOM
                const element = document.querySelector(selector);
                if (element) {
                    // SUCCESSO: Elemento trovato!
                    // resolve() significa "Promise mantenuta - ecco il risultato"
                    resolve(element);
                } else {
                    // ELEMENTO NON ANCORA PRESENTE: Riprova tra 100ms
                    // setTimeout() aspetta 100ms e poi richiama checkElement()
                    setTimeout(checkElement, 100);
                }
            };
            // Inizia il controllo
            checkElement();
        });
    }

    const addNewBookmarkEventHandler = async () => {

        // AGGIUNTA: Controlla extension context prima di procedere
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
                    showBookmarkSavedFeedback();
                }
            });
        } catch (error) {
            console.error('Error saving bookmark:', error);
            alert('Errore nel salvare il bookmark');
        }
    }

    const getTime = (t) => {
        // Crea un nuovo oggetto Date partendo da 0 (1 gennaio 1970, 00:00:00)
        var date = new Date(0);
        // Imposta i secondi della data (es: se t=125, imposta 125 secondi = 2 minuti e 5 secondi)
        date.setSeconds(t);

        //estrae HH:MM:SS
        return date.toISOString().substring(11, 19);
    }


    newVideoLoaded();

})()


