const { Bot, webhookCallback } = require('grammy');
const axios = require('axios');
const { WELCOM_MESSAGE, IMG_COMMAND_USAGE } = require('./constant');
const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', handleStartCommand);
bot.command('img', handleImgCommand);

// Create the grammY handler
const handleUpdate = webhookCallback(bot, 'http');
module.exports = async (req, res) => {
  if (req.method === 'POST') return handleUpdate(req, res);
  res.status(200).send('Bot is running! Please send updates via Telegram Webhook.');
};

/**
 *  Handle /img command
 * @param {import('grammy').Context} ctx
 * @returns
 */
async function handleImgCommand(ctx) {
  const url = ctx.match;
  if (!url)
    return ctx.reply(IMG_COMMAND_USAGE, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });

  await ctx.reply('🚀 Preparing images...');
  await ctx.replyWithChatAction('upload_photo');

  try {
    await axios.post(
      `https://api.github.com/repos/thangkieu/vc_server/dispatches`,
      {
        event_type: 'scrape-command',
        client_payload: {
          url: url,
          chatId: ctx.chat.id.toString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
  } catch (err) {
    await ctx.reply('Failed to trigger GitHub Action.');
  }
}

/**
 *
 * @param {import('grammy').Context} ctx
 */
async function handleStartCommand(ctx) {
  await ctx.reply(WELCOM_MESSAGE, { parse_mode: 'Markdown' });
}
