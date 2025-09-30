// Funzione per ottenere la tab attualmente attiva nel browser
async function getCurrentTab() {
    //criteri di ricerca: solo tab attiva e nella finestra corrente del browser
    let queryOptions = { active: true, currentWindow: true };

    // chrome.tabs.query() restituisce un array di tab
    // Prende il primo elemento dall'array di tab restituite
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}


// Funzione per controllare se l'extension context è ancora valido
function isExtensionContextValid() {
    try {
        return chrome.runtime && chrome.runtime.id;
    } catch (error) {
        return false;
    }
}

// Variabili globali per tenere traccia dello stato
let currentVideo = "";
let currentVideoBookmarks = [];

const addNewBookmark = (bookmarkElement, bookmark) => {
    //Crea: <div></div> così const bookmarkTitleElement = document.createElement("div"); ...
    //però ho già template in hmtl
    const template = document.getElementById('bookmark-template');
    //fa una fotocopia del template scrivendoci sopra senza rovinare l'originale
    const bookmarkHTML = template.content.cloneNode(true);

    // TROVA gli elementi che già esistono:
    const newBookmarkElement = bookmarkHTML.querySelector('.bookmark-item');
    const timeDisplay = bookmarkHTML.querySelector('.time-display');
    const jumpButton = bookmarkHTML.querySelector('.jump-btn');
    const deleteButton = bookmarkHTML.querySelector('.delete-btn');
    const timestampDiv = bookmarkHTML.querySelector('.timestamp');
    const bookmarkTitleElement = bookmarkHTML.querySelector('.bookmark-title');
    const bookmarkDateElement = bookmarkHTML.querySelector('.bookmark-date');


    newBookmarkElement.id = "bookmark-" + bookmark.time;
    timeDisplay.textContent = formatTime(bookmark.time);
    bookmarkTitleElement.textContent = bookmark.title;
    timestampDiv.setAttribute('data-time', bookmark.time);

    // Aggiungi data se presente
    if (bookmark.date) {
        bookmarkDateElement.textContent = new Date(bookmark.date).toLocaleDateString();
    } else {
        bookmarkDateElement.textContent = 'Oggi';
    }


    jumpButton.addEventListener('click', () => {
        jumpToTimestamp(bookmark);
    });


    deleteButton.addEventListener('click', () => {
        deleteBookmark(bookmark);
    });


    //Aggiungi l'elemento al contenitore
    bookmarkElement.appendChild(bookmarkHTML);
}


const jumpToTimestamp = async (bookmark) => {
    const timestamp = bookmark.time;
    const currentTab = await getCurrentTab();

    chrome.tabs.sendMessage(currentTab.id, { type: "JUMP", timestamp: timestamp });
}


const deleteBookmark = async (bookmark) => {
    const currentTab = await getCurrentTab();
    chrome.tabs.sendMessage(currentTab.id, { type: "DELETE", timestamp: bookmark.time });
};


const deleteAllBookmarksFunction = async () => {
    const currentTab = await getCurrentTab();
    if (!currentTab) return;
    chrome.tabs.sendMessage(currentTab.id, { type: "DELETEALL" });
}



// Funzione per aggiornare il contatore
const updateBookmarkCount = () => {
    const countElement = document.getElementById('bookmark-count');
    if (countElement) {
        countElement.textContent = currentVideoBookmarks.length;
    }
}


// Funzione per formattare il tempo in HH:MM:SS
function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substring(11, 19);
}

const viewBookmarks = (currentBookmarks = []) => {
    const bookmarksElement = document.getElementById("bookmarks-container");
    if (!bookmarksElement) {
        console.error("Elemento bookmarks-list non trovato");
        return;
    }
    bookmarksElement.innerHTML = "";

    if (currentBookmarks.length > 0) {
        for (let i = 0; i < currentBookmarks.length; i++) {
            const bookmark = currentBookmarks[i];
            addNewBookmark(bookmarksElement, bookmark);
        }
        updateBookmarkCount();

    } else {
        bookmarksElement.innerHTML = `
            <div class="empty-state">
                <p>Nessun bookmark salvato</p>
                <p class="hint">Usa il pulsante sopra per salvare il primo timestamp!</p>
            </div>
        `;
        updateBookmarkCount();
    }
}

// Funzione per ascoltare i cambiamenti nello storage
const listenForStorageChanges = () => {
    if (!isExtensionContextValid()) {
        console.warn('Cannot set up storage listener: extension context invalid');
        return;
    }

    try {
        // Questa funzione viene chiamata AUTOMATICAMENTE ogni volta che:
        // - Qualcuno salva nuovi dati nel chrome.storage
        // - Qualcuno modifica dati esistenti
        // - Qualcuno elimina dati
        // changes = oggetto con i cambiamenti
        // namespace = "sync" | "local" | "managed"
        chrome.storage.onChanged.addListener((changes, namespace) => {
            // 1. Controlla se il cambiamento è nello storage 'sync'
            // 2. Controlla se abbiamo un video corrente caricato (currentVideo)
            // 3. Controlla se il cambiamento riguarda il nostro video (changes[currentVideo])
            if (namespace === 'sync' && currentVideo && changes[currentVideo]) {

                // 4. I bookmark sono cambiati per il video corrente
                const newBookmarks = changes[currentVideo].newValue ?
                    JSON.parse(changes[currentVideo].newValue) : [];

                // 5. Aggiorna la variabile globale
                currentVideoBookmarks = newBookmarks;
                // 6. Aggiorna l'interfaccia utente
                viewBookmarks(currentVideoBookmarks);
            }
        });
    } catch (error) {
        console.error('Error setting up storage listener:', error);
    }
}


// Funzione per mostrare errore nel UI
const showExtensionError = () => {
    const container = document.getElementsByClassName("video-info")[0];
    if (container) {
        container.innerHTML = `
            <h3 id="video-title">⚠️ Errore Estensione</h3>
            <p id="video-url">L'estensione è stata ricaricata. Ricarica questa pagina per ripristinare la funzionalità.</p>
        `;
    }
}

//funzione che sistema titolo del video
function cleanYouTubeTitle(title) {
    if (!title) return 'Video YouTube';

    return title
        .replace(/^\(\d+\)\s*/, '') // Rimuove contatore notifiche
        .replace(/\s*-\s*YouTube$/, '') // Rimuove suffisso YouTube
        .trim();
}

// Aspetta che il DOM del side panel sia completamente caricato
document.addEventListener("DOMContentLoaded", async () => {
    // Controlla subito se l'extension context è valido
    if (!isExtensionContextValid()) {
        showExtensionError();
        return;
    }

    const activeTab = await getCurrentTab();
    if (!activeTab) {
        showExtensionError();
        return;
    }
    const container = document.getElementsByClassName("video-info")[0];

    // CASO 1: Non siamo su YouTube
    if (!activeTab.url.includes("youtube.com")) {
        container.innerHTML = `
            <h3 id="video-title">❌ Non è una pagina YouTube</h3>
            <p id="video-url">Vai su un video YouTube per usare MarkerVideo</p>
        `;
        return;
    }

    // CASO 2: Siamo su YouTube ma non su un video specifico
    const queryParameters = activeTab.url.split("?")[1];
    if (!queryParameters) {
        container.innerHTML = `
            <h3 id="video-title">📺 Nessun video caricato</h3>
            <p id="video-url">Vai su un video YouTube per iniziare</p>
        `;
        return;
    }

    const urlParameters = new URLSearchParams(queryParameters);
    currentVideo = urlParameters.get("v");

    // CASO 3: Siamo su YouTube ma l'URL non ha parametro "v"
    if (!currentVideo) {
        container.innerHTML = `
            <h3 id="video-title">📺 Nessun video caricato</h3>
            <p id="video-url">Vai su un video YouTube per iniziare</p>
        `;
        return;
    }

    // CASO 4: Siamo su un video YouTube valido
    if (activeTab.url.includes("youtube.com/watch") && currentVideo) {
        // Aggiorna le info del video
        container.innerHTML = `
            <h3 id="video-title">${cleanYouTubeTitle(activeTab.title) || 'Video YouTube'}</h3>
            <p id="video-url">ID Video: ${currentVideo}</p>
        `;

        chrome.storage.sync.get([currentVideo], (data) => {
            currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];
            viewBookmarks(currentVideoBookmarks);
        });
    }


    const currentTimestampBtn = document.querySelector('.primary-btn');
    if (currentTimestampBtn) {
        currentTimestampBtn.addEventListener('click', async () => {
            const currentTab = await getCurrentTab();
            if (!currentTab) return;

            chrome.tabs.sendMessage(currentTab.id, {
                type: "CREATE_BOOKMARK"
            })
        })
    }

    const deleteAllBtn = document.querySelector('.danger-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            deleteAllBookmarksFunction();
        });
    }

    listenForStorageChanges();
});
