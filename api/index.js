const { Bot, webhookCallback, InputMediaBuilder } = require("grammy");
const axios = require('axios');
const cheerio = require('cheerio');
const bot = new Bot(process.env.BOT_TOKEN);

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
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': targetUrl
    };

    try {
        const { data } = await axios.get(targetUrl, { headers });
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