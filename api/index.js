const { Bot, webhookCallback } = require("grammy");

const bot = new Bot(process.env.BOT_TOKEN);

bot.command("start", (ctx) => ctx.reply("Welcome!"));
bot.on("message", (ctx) => ctx.reply("Got your message!"));

// Create the grammY handler
const handleUpdate = webhookCallback(bot, "http");

module.exports = async (req, res) => {
    // Only allow POST requests (which is what Telegram sends)
    if (req.method === "POST") {
        return handleUpdate(req, res);
    }

    // If someone visits in a browser (GET), show a friendly message
    res.status(200).send("Bot is running! Please send updates via Telegram Webhook.");
};