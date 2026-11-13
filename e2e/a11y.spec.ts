import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility scan (axe-core, WCAG 2.1 A/AA rules) of each main view.
 * Catches missing names, bad ARIA and low contrast. It does not replace a screen-reader pass.
 */
const VIEWS: { name: string; path: string; ready: RegExp | string; before?: 'begin-journey' }[] = [
  { name: 'landing', path: '/', ready: 'Start exploring' },
  { name: 'explorer', path: '/#/explore/neptune', ready: 'The planet found by prediction' },
  { name: 'time explorer with candidate', path: '/#/time?region=field-a&view=diff&cand=cand-a-001', ready: 'SSX-A-001' },
  { name: 'journey start', path: '/#/journey/journey-moving-source', ready: 'Begin journey' },
  { name: 'journey playing', path: '/#/journey/journey-moving-source', ready: 'Begin journey', before: 'begin-journey' },
  { name: 'mission', path: '/#/mission', ready: 'How to read the labels' },
];

for (const view of VIEWS) {
  test(`no serious accessibility violations: ${view.name}`, async ({ page }) => {
    await page.goto(view.path);
    await expect(page.getByText(view.ready).first()).toBeVisible();
    if (view.before === 'begin-journey') {
      await page.getByRole('button', { name: 'Begin without sound' }).click();
      await page.getByRole('button', { name: 'Scene 5: Subtracting the sky' }).click();
      await expect(page.getByRole('img', { name: /Simulated|Difference imaging/ }).first()).toBeVisible();
    }
    await page.waitForTimeout(1500); // let entrance animations finish so contrast is measured on final colours
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')} :: ${v.nodes[0]?.failureSummary?.replace(/\s+/g, ' ').slice(0, 160)}`);
    expect(serious).toEqual([]);
  });
}
