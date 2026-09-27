import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Ensure artifacts directory exists
const artifactsDir = '/opt/cursor/artifacts';
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

test.describe('Basquet Stat Screenshots', () => {
  test.beforeAll(async () => {
    console.log('Starting screenshot capture...');
    console.log('Artifacts will be saved to:', artifactsDir);
  });

  // Mock authentication for screenshot generation
  test.beforeEach(async ({ page }) => {
    // Inject mock Supabase auth
    await page.addInitScript(() => {
      // @ts-ignore
      window.__SUPABASE_MOCK__ = true;
    });
  });

  test('1. Basketball Court - Both Orientations', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/court-demo');
    
    // Wait for court to render
    await page.waitForSelector('svg');
    
    // Landscape orientation
    await page.screenshot({ 
      path: path.join(artifactsDir, 'court-landscape.png'),
      fullPage: true 
    });
    
    // Portrait orientation (rotate)
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.screenshot({ 
      path: path.join(artifactsDir, 'court-portrait.png'),
      fullPage: true 
    });
    
    console.log('✓ Court screenshots captured');
  });

  test('2. Choose Side Modal', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/choose-side-demo');
    
    await page.waitForSelector('text=Choose Your Basket');
    await page.screenshot({ 
      path: path.join(artifactsDir, 'choose-side-modal.png'),
      fullPage: false 
    });
    
    console.log('✓ Choose side modal captured');
  });

  test('3. Free Throw Markers - Both Baskets', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/ft-markers-demo');
    
    await page.waitForSelector('svg');
    
    // 3-shot set with made (green) and missed (red)
    await page.screenshot({ 
      path: path.join(artifactsDir, 'ft-markers-both-baskets.png'),
      fullPage: true 
    });
    
    console.log('✓ FT markers captured');
  });

  test('4. Capture Top Bar with Menu', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/capture-topbar-demo');
    
    await page.waitForSelector('text=☰');
    
    // Capture just the top bar
    const topBar = await page.locator('div').filter({ hasText: '☰' }).first();
    await topBar.screenshot({ 
      path: path.join(artifactsDir, 'capture-topbar.png')
    });
    
    console.log('✓ Capture top bar captured');
  });

  test('5. Profile Page - Light Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/profile-demo?theme=light');
    
    await page.waitForSelector('text=Profile');
    await page.screenshot({ 
      path: path.join(artifactsDir, 'profile-light.png'),
      fullPage: true 
    });
    
    console.log('✓ Profile light mode captured');
  });

  test('6. Profile Page - Dark Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/profile-demo?theme=dark');
    
    await page.waitForSelector('text=Profile');
    await page.screenshot({ 
      path: path.join(artifactsDir, 'profile-dark.png'),
      fullPage: true 
    });
    
    console.log('✓ Profile dark mode captured');
  });

  test('7. Navbar with Avatar, Name, Role Pills, Club Logo', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/navbar-demo');
    
    await page.waitForSelector('nav');
    
    // Capture just the navbar
    const navbar = await page.locator('nav').first();
    await navbar.screenshot({ 
      path: path.join(artifactsDir, 'navbar.png')
    });
    
    console.log('✓ Navbar captured');
  });

  test('8. Admin Clubs Page', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/test/admin-clubs-demo');
    
    await page.waitForSelector('text=Clubs');
    await page.screenshot({ 
      path: path.join(artifactsDir, 'admin-clubs.png'),
      fullPage: true 
    });
    
    console.log('✓ Admin clubs page captured');
  });

  test.afterAll(async () => {
    console.log('\n=== Screenshot Summary ===');
    console.log('All screenshots saved to:', artifactsDir);
    const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.png'));
    console.log('Generated screenshots:');
    files.forEach(f => console.log(`  - ${f}`));
  });
});
