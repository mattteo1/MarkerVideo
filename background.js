/**
 * BACKGROUND SCRIPT - Service Worker per Chrome Extension MV3
 * Gestisce eventi globali del browser e comunicazione tra componenti
 */


//Listener per i cambiamenti di stato delle tab del browser
//Si attiva ogni volta che una tab viene aggiornata (caricamento, URL change, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    // Controlla se il caricamento della pagina è completato E se siamo su una pagina video YouTube
    // changeInfo.status può essere: "loading", "complete"
    // Filtra solo gli URL che contengono "youtube.com/watch" (pagine video)
    if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
        const queryParameters = tab.url.split("?")[1];

        //URLSearchParams serve per estrarre e gestire i parametri dall'URL di YouTube, URLSearchParams ti permette di sapere quale video sta guardando l'utente e da che momento ha iniziato!
        const urlParameters = new URLSearchParams(queryParameters);
        console.log(urlParameters);

        //Cominca al content script "l'utente ha cambiato video, ecco il nuovo ID"
        chrome.tabs.sendMessage(tabId, {
            type: "NEW",
            videoId: urlParameters.get("v")

        })
    }
})

//Listener per il click sull'icona dell'estensione nella toolbar
//Quando l'utente clicca l'icona, apre il sidepanel invece di un popup
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});