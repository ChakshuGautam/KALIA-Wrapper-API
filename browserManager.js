const puppeteer = require("puppeteer");

class BrowserManager {
    constructor() {
        this.browser = null;
    }

    async launchBrowser() {
        if(!this.browser) {
            this.browser = await puppeteer.launch();
        }
        return this.browser;
    }

    async closeBrowser() {
        if(this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

const browserManager = new BrowserManager();

module.exports = browserManager;