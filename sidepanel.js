
// Funzione per ottenere la tab attualmente attiva nel browser
async function getCurrentTab() {
    //criteri di ricerca: solo tab attiva e nella finestra corrente del browser
    let queryOptions = { active: true, currentWindow: true };

    // chrome.tabs.query() restituisce un array di tab
    // Prende il primo elemento dall'array di tab restituite
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}


// Aspetta che il DOM del side panel sia completamente caricato
document.addEventListener("DOMContentLoaded", async () => {
    // Ottieni informazioni sulla tab attualmente attiva(URL, titolo, ID, etc.)
    const activeTab = await getCurrentTab();

    const queryParameters = activeTab.url.split("?")[1];

    // Crea un oggetto URLSearchParams per gestire facilmente i parametri
    const urlParameters = new URLSearchParams(queryParameters);

    // Estrae l'ID del video YouTube dal parametro "v"
    // Es: da "v=ABC123&t=45s" ottiene "ABC123"
    const currentVideo = urlParameters.get("v");

    // Controlla se siamo su una pagina di video YouTube E se abbiamo un ID video valido
    if (activeTab.url.includes("youtube.com/watch") && currentVideo) {

        // Se esistono bookmark per questo video, li converte da JSON string ad array
        // Altrimenti crea un array vuoto
        chrome.storage.sync.get([currentVideo], (data) => {
            const currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

            //view 
        })
    } else {

    }

})
