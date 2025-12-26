const { Bot, webhookCallback, InputMediaBuilder } = require("grammy");
const axios = require('axios');
const cheerio = require('cheerio');
const bot = new Bot(process.env.BOT_TOKEN);
const https = require('https');

bot.use(async (ctx, next) => {
    const timeout = setTimeout(() => {
        console.log("Approaching Vercel timeout!");
        // You could send a fallback message here
    }, 8000); // 8 seconds trigger

    try {
        await next();
    } finally {
        clearTimeout(timeout);
    }
});

bot.command("scrape", handleScrapeRequest);

// Create the grammY handler
const handleUpdate = webhookCallback(bot, "http",);

module.exports = async (req, res) => {
    // Only allow POST requests (which is what Telegram sends)
    if (req.method === "POST") {
        return handleUpdate(req, res);
    }

    // If someone visits in a browser (GET), show a friendly message
    res.status(200).send("Bot is running! Please send updates via Telegram Webhook.");
};

module.exports.config = {
    runtime: 'edge',
}


/**
 * Handle the /scrape command
 * @param {import("grammy").CommandContext} ctx Command Context
 * @returns Promise<void>
 */
async function handleScrapeRequest(ctx) {
    const targetUrl = ctx.match;
    if (!targetUrl) return ctx.reply("Usage: /scrape <url>");

    // 1. Respond to Telegram IMMEDIATELY
    await ctx.reply("Request received! I'm extracting in the background to avoid timeouts...");

    // 2. Start the process but DO NOT 'await' the whole thing here
    // This allows the webhook function to finish and return 200 OK to Telegram
    await scrapeAndSend(ctx.chat.id, targetUrl).catch(console.error);
}

// Move the heavy logic to a separate async function
async function scrapeAndSend(chatId, targetUrl) {
    const agent = new https.Agent({
        keepAlive: true,
        // This helps bypass some basic SSL fingerprinting
        ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256',
    });

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    };

    try {
        const { data } = await axios.get(targetUrl, { headers, httpsAgent: agent, timeout: 8000 });
        const $ = cheerio.load(data);
        const imageElements = $('.entry-content img').get();

        const allUrls = imageElements.map(img => {
            const src = $(img).attr('src');
            const srcset = $(img).attr('srcset');
            let imgUrl = src;
            if (srcset) {
                const candidates = srcset.split(',').map(s => s.trim().split(' ')[0]);
                imgUrl = candidates[candidates.length - 1];
            }
            return imgUrl ? new URL(imgUrl, targetUrl).href : null;
        }).filter(url => url !== null);

        if (allUrls.length === 0) {
            return bot.api.sendMessage(chatId, "No images found.");
        }

        const chunkSize = 10;
        for (let i = 0; i < allUrls.length; i += chunkSize) {
            const chunk = allUrls.slice(i, i + chunkSize);
            const mediaGroup = chunk.map(url => ({ type: 'photo', media: url }));

            // Use bot.api instead of ctx (ctx might be expired)
            await bot.api.sendMediaGroup(chatId, mediaGroup);
            await new Promise(r => setTimeout(r, 500));
        }

        await bot.api.sendMessage(chatId, `🎉 Finished sending ${allUrls.length} images!`);
    } catch (err) {
        console.error(err);
        await bot.api.sendMessage(chatId, "Failed to complete scraping. " + err.message);
    }
}