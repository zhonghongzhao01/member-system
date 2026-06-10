const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const email = '1719109314@qq.com';
  const username = 'zhonghongzhao001';
  const password = 'Zhao2026!';

  console.log('🌐 打开 GitHub 注册页面...');
  await page.goto('https://github.com/signup', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // ===== Step 1: 填写邮箱 =====
  console.log('📧 填写邮箱: ' + email);
  try {
    const emailInput = page.locator('input[type="email"], #email').first();
    await emailInput.waitFor({ timeout: 8000 });
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.type(email, { delay: 50 });
    await page.waitForTimeout(1000);
    console.log('✅ 邮箱已填写');
  } catch(e) { console.log('邮箱填写出错: ' + e.message); }

  // 点击 Continue
  try {
    const btn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("continue")').first();
    await btn.click();
    console.log('✅ 已点击 Continue');
  } catch(e) { console.log('点击Continue出错: ' + e.message); }

  await page.waitForTimeout(3000);

  // ===== Step 2: 填写密码 =====
  console.log('🔐 填写密码...');
  try {
    const pwInput = page.locator('#password, input[type="password"]').first();
    await pwInput.waitFor({ timeout: 8000 });
    await pwInput.click();
    await pwInput.fill(password);
    await page.waitForTimeout(1000);
    console.log('✅ 密码已填写');
  } catch(e) { console.log('密码填写出错: ' + e.message); }

  try {
    const btn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("continue")').first();
    await btn.click();
    console.log('✅ 已点击 Continue');
  } catch(e) { console.log('点击Continue出错: ' + e.message); }

  await page.waitForTimeout(3000);

  // ===== Step 3: 填写用户名 =====
  console.log('👤 填写用户名: ' + username);
  try {
    const unInput = page.locator('#login, input[name="user[login]"]').first();
    await unInput.waitFor({ timeout: 8000 });
    await unInput.click();
    await unInput.fill(username);
    await page.waitForTimeout(1000);
    console.log('✅ 用户名已填写');
  } catch(e) { console.log('用户名填写出错: ' + e.message); }

  try {
    const btn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("continue")').first();
    await btn.click();
    console.log('✅ 已点击 Continue');
  } catch(e) { console.log('点击Continue出错: ' + e.message); }

  await page.waitForTimeout(3000);

  // ===== Step 4: 验证码页面 =====
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  接下来是验证码/邮箱验证，需要你操作');
  console.log('');
  console.log('📋 请你在浏览器里操作:');
  console.log('   1. 人机验证 → 点一下勾选框');
  console.log('   2. 打开 QQ邮箱 mail.qq.com → 找 GitHub 验证码');
  console.log('   3. 填入验证码 → 点 Continue');
  console.log('');
  console.log('📬 邮箱: 1719109314@qq.com');
  console.log('📬 密码: Zhao2026!  (记下来!)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⏳ 浏览器保持打开等30分钟...');
  console.log('   完成后告诉我，我继续部署');

  await page.waitForTimeout(1800000);
  await browser.close();
})();
