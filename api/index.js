// api/index.js
const { Bot, webhookCallback } = require("grammy");

// 1. Initialize the bot
const bot = new Bot(process.env.BOT_TOKEN);

// 2. Add your commands and logic
bot.command("start", (ctx) => ctx.reply("Welcome! Up and running on Vercel."));
bot.on("message", (ctx) => ctx.reply(`You said: ${ctx.message.text}`));

// 3. Export the Vercel serverless function
module.exports = webhookCallback(bot, "http");