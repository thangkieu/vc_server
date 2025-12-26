const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const { Bot, InputMediaBuilder } = require('grammy');

chromium.use(stealth);

async function run() {
  const url = process.env.TARGET_URL;
  const chatId = process.env.CHAT_ID;
  const bot = new Bot(process.env.BOT_TOKEN);

  // 1. Launch with slightly more "human" settings
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Extract images using browser context (bypasses many blocks)
  const images = await handleMens1069(page, url)

  console.log(`Found ${images.length} images. Sending to Telegram...`);

  // Chunk and send (same logic as before)
  for (let i = 0; i < images.length; i += 10) {
    const chunk = images.slice(i, i + 10).map(u => InputMediaBuilder.photo(u));
    await bot.api.sendMediaGroup(chatId, chunk);
  }

  await browser.close();
}

run().catch(console.error);

async function handleMens1069(page, url) {
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.entry-content');
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.entry-content img'))
      .map(img => img.src);
  });
}

async function handleInstagram(page, url) {
  // Instagram requires a specialized User-Agent to see public content
  await page.goto(url);
  // Logic to find the 'og:image' or the __additionalData script tag
  const imageUrl = await page.evaluate(() => {
    return document.querySelector('meta[property="og:image"]')?.content;
  });
  return imageUrl ? [imageUrl] : [];
}