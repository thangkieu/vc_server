const { chromium } = require('playwright'); // Playwright is better for this
const { Bot, InputMediaBuilder } = require('grammy');

async function run() {
  const url = process.env.TARGET_URL;
  const chatId = process.env.CHAT_ID;
  const bot = new Bot(process.env.BOT_TOKEN);

  // 1. Launch with slightly more "human" settings
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.entry-content', { timeout: 30000 });

  // Extract images using browser context (bypasses many blocks)
  const images = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.entry-content img'));
    return imgs.map(img => img.srcset ? img.srcset.split(',').pop().trim().split(' ')[0] : img.src);
  });

  console.log(`Found ${images.length} images. Sending to Telegram...`);

  // Chunk and send (same logic as before)
  for (let i = 0; i < images.length; i += 10) {
    const chunk = images.slice(i, i + 10).map(u => InputMediaBuilder.photo(u));
    await bot.api.sendMediaGroup(chatId, chunk);
  }

  await browser.close();
}

run().catch(console.error);