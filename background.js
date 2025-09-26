chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

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


chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});