const { performance } = require('perf_hooks'); // Built-in Node tool
const { autoRetry } = require('@grammyjs/auto-retry');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const { Bot, InputMediaBuilder } = require('grammy');

chromium.use(stealth);

/**
 * [MAIN] Start the scraping process
 */
run().catch(console.error);

const UNSUPPORTED_DOMAIN_MESSAGE = `
❌ **Error: Unsupported Domain**
━━━━━━━━━━━━━━
❌ **URL:** {url}
⏱ **Supported domains:**
1. instagram.com
2. mens1069.com
Please check the URL and try again.
`;

async function run() {
  const url = process.env.TARGET_URL;
  const chatId = process.env.CHAT_ID;
  const bot = new Bot(process.env.BOT_TOKEN);
  // 1. Add the auto-retry plugin
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 5, // Try 5 times before giving up
      maxDelaySeconds: 30, // Don't wait longer than 30s
    })
  );

  const startTime = performance.now(); // Start the clock
  let totalSent = 0;

  // 1. Launch with slightly more "human" settings
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Extract images using browser context (bypasses many blocks)
  let images = [];
  switch (new URL(url).hostname) {
    case 'instagram.com':
    case 'www.instagram.com':
      images = await handleInstagram(page, url);
      break;
    // Add more cases for different sites as needed
    case 'www.mens1069.com':
    case 'mens1069.com':
      images = await handleMens1069(page, url);
      break;
    default:
      console.log('No handler for this domain, skipping specialized extraction.', url);
      await bot.api.sendMessage(chatId, UNSUPPORTED_DOMAIN_MESSAGE.replace('{url}', url), {
        parse_mode: 'Markdown',
      });
      return;
  }
  console.log(`Found ${images.length} images. Sending to Telegram...`);
  let progressMsg = await bot.api.sendMessage(
    chatId,
    `📥 Found ${images.length} images. Starting download...`
  );

  // Chunk and send (same logic as before)
  for (let i = 0; i < images.length; i += 10) {
    const chunk = images.slice(i, i + 10).map((u) => InputMediaBuilder.photo(u));
    try {
      const progress = Math.min(((i + 10) / images.length) * 100, 100).toFixed(0);
      const progressBar =
        '▓'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

      if (progressMsg) bot.api.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
      progressMsg = await bot.api
        .sendMessage(
          chatId,
          `📥 Progress: ${progress}%\n${progressBar}\nSending batch ${Math.floor(i / 10) + 1}...`
        )
        .catch(() => {}); // Catch errors if user deleted the message

      await bot.api.sendMediaGroup(chatId, chunk, {
        disable_notification: i > 0, // Only notify for the first batch
      });
      totalSent += chunk.length;
    } catch (error) {
      console.error('Batch failed', error);
      await bot.api.sendMessage(
        chatId,
        `⚠️ Failed to send batch starting at image ${i + 1}. Continuing...`
      );
    }
  }

  if (progressMsg) bot.api.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
  // --- Generate Summary ---
  const endTime = performance.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(1);
  const summary = `
📊 **Download Summary**
━━━━━━━━━━━━━━
✅ **Images Sent:** ${totalSent} / ${images.length}
⏱ **Total Time:** ${durationSeconds}s
🌐 **URL:** ${url}
    `;

  await bot.api.sendMessage(chatId, summary, {
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true },
  });

  await browser.close();
}

async function handleMens1069(page, url) {
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.entry-content');
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.entry-content img')).map((img) => img.src);
  });
}

async function handleInstagram(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return await page.evaluate(() => {
    const INSTAGRAM_SELCTOR =
      'x1yvgwvq xjd31um x1ixjvfu xwt6s21 x13fuv20 x18b5jzi x1q0q8m5 x1t7ytsu x178xt8z x1lun4ml xso031l xpilrb4 x78zum5 x1q0g3np xh8yej3';
    const cls = INSTAGRAM_SELCTOR.split(' ').join('.');

    return Array.from(document.querySelectorAll(`.${cls} img`)).map((img) => img.src);
  });
}
