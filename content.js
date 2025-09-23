(() => {
    let youtubeLeftControls, youtubePlayer;
    let currentVideo = "";

    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        const { type, value, videoId } = obj;
        if (type === "NEW") {
            currentVideo = videoId;
            newVideoLoaded();
        }
    })

    //viene chiamata ogni volta che l'utente cambia video su yt
    const newVideoLoaded = async () => {

        //cerca se esiste già un bottone con la classe bookmark-btn, se non trova nulla ritorna undefined, sennò contiene elemento HTML
        const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];

        if (!bookmarkBtnExists) {

            // PROMISE: Aspetta che i controlli si carichino prima di continuare
            // Questa è una operazione asincrona - potrebbe richiedere tempo
            await waitForElement(".ytp-left-controls");

            //Crea un nuovo elemento immagine, ma non mostrarlo ancora
            const bookmarkBtn = document.createElement("img");

            // Imposta l'icona del pulsante
            bookmarkBtn.src = chrome.runtime.getURL("icons/bookmark.png");

            // Ora bookmarkBtn contiene: <img src="path/to/image.png" class="ytp-button bookmark-btn">
            bookmarkBtn.className = "ytp-buttun " + "bookmark-btn";

            bookmarkBtn.title = "Click the bookmark current timestamp";

            //Dove aggiungere il pulsante bookmark
            youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];

            //Da dove leggere il timestamp corrente
            youtubePlayer = document.getElementsByClassName("video-stream")[0];

            // Controlla che esistano prima di usarli
            if (youtubeLeftControls) {
                //aggiunge bottone, appendChild() agginge figlio a un elemento padre del DOM
                youtubeLeftControls.appendChild(bookmarkBtn);
                bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
            } else {
                console.error("Controlli YouTube non trovati!");
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



    newVideoLoaded();

})()