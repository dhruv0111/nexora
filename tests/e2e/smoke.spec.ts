import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
test('style guide renders, changes workspace and validates form', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/style-guide');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'A bold beginning.',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Mentor', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Make room for great potential.' }),
  ).toBeVisible();
  await page.getByLabel(/Email address/).fill('learner@example.com');
  await page.getByRole('button', { name: 'Validate example' }).click();
  await expect(page.getByRole('status')).toContainText('Valid email format');
  expect(errors).toEqual([]);
  if (process.env.CAPTURE_STYLE_GUIDE) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/style-guide');
    await expect(
      page.getByRole('heading', { name: 'Your next chapter starts here.' }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/previews/${testInfo.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
});
test('navigation and course links work', async ({ page }) => {
  await page.goto('/programs');
  await page
    .locator('#main')
    .getByRole('link', { name: 'QA / SDET', exact: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'QA / SDET',
  );
  await expect(
    page.getByRole('link', { name: 'Start Application', exact: true }).first(),
  ).toBeVisible();
});
test('all live role workspaces redirect anonymous visitors', async ({
  page,
}) => {
  for (const role of ['student', 'mentor', 'employer', 'admin']) {
    await page.goto(`/dashboard/${role}`);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole('heading', { name: 'Keep your momentum.' }),
    ).toBeVisible();
  }
});
test('keyboard skip link works and reduced motion is honored', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/style-guide');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  expect(
    await page
      .locator('.loading-icon')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});
test('navigation matches the viewport', async ({ page }) => {
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 0) > 1050) {
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    await expect(page.getByLabel('Open navigation')).not.toBeVisible();
    return;
  }
  await page.getByLabel('Open navigation').click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Sign in' })
    .click();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('public and auth shells meet automated WCAG AA checks', async ({
  page,
}) => {
  for (const route of ['/style-guide', '/programs', '/sign-in']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
