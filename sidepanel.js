// Funzione per ottenere la tab attualmente attiva nel browser
async function getCurrentTab() {
    //criteri di ricerca: solo tab attiva e nella finestra corrente del browser
    let queryOptions = { active: true, currentWindow: true };

    // chrome.tabs.query() restituisce un array di tab
    // Prende il primo elemento dall'array di tab restituite
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

const viewBookmarks = (currentBookmarks = []) => {
    const bookmarksElement = document.getElementsByClassName("bookmarks-list")[0];
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
        //aggioran contatorea

    } else {
        bookmarksElement.innerHTML = `
            <div class="empty-state">
                <p>Nessun bookmark salvato</p>
                <p class="hint">Usa il pulsante sopra per salvare il primo timestamp!</p>
            </div>
        `;
        //aggiorna contatore a 0
    }
}




// Aspetta che il DOM del side panel sia completamente caricato
document.addEventListener("DOMContentLoaded", async () => {
    const activeTab = await getCurrentTab();
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
    const currentVideo = urlParameters.get("v");

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
            <h3 id="video-title">${activeTab.title || 'Video YouTube'}</h3>
            <p id="video-url">ID Video: ${currentVideo}</p>
        `;

        chrome.storage.sync.get([currentVideo], (data) => {
            const currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];
            // Logica per mostrare i bookmark...
        });
    }
});
