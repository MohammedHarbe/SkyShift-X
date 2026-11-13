import { expect, test, type Page } from '@playwright/test';

/** Collect uncaught page errors so a broken view fails the test even if it "looks" fine. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test.describe('SkyShift X demonstration path', () => {
  test('landing page leads into the 3D explorer at Neptune', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Watch the infrared sky');
    await expect(page.getByText('Demo · simulated data').first()).toBeVisible();
    await page.getByRole('link', { name: /Start exploring/ }).click();
    await expect(page).toHaveURL(/#\/explore\/neptune/);
    await expect(page.getByRole('heading', { name: 'Neptune', exact: true })).toBeVisible();
    await expect(page.getByText(/Not to scale/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the Planet Nine search region is presented as an unconfirmed hypothesis', async ({ page }) => {
    await page.goto('/#/explore/planet-nine-region');
    await expect(page.getByRole('heading', { name: 'Planet Nine search region' })).toBeVisible();
    await expect(page.getByText('A hypothesis, not a discovery')).toBeVisible();
    await expect(page.getByText(/No such planet has been observed/).first()).toBeVisible();
  });

  test('Time Explorer: two epochs, blink and difference views, all labelled simulated', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/time');
    await expect(page.getByRole('heading', { name: 'How does this patch of sky change?' })).toBeVisible();
    await expect(page.getByText('Simulated observations.')).toBeVisible();

    // Default view is a blink comparison of the two earliest epochs.
    await expect(page).toHaveURL(/view=blink|#\/time$/);
    await expect(page.getByRole('img', { name: /Simulated Band 2 .* image of Simulated Field A/ }).first()).toBeVisible();
    await expect(page.getByText('Simulated data').first()).toBeVisible();

    await page.getByText('Side by side', { exact: true }).click();
    await expect(page.getByRole('img', { name: /Epoch 1/ }).first()).toBeVisible();
    await expect(page.getByRole('img', { name: /Epoch 2/ }).first()).toBeVisible();

    await page.getByText('Difference', { exact: true }).click();
    await expect(page.getByRole('img', { name: /Simulated difference image/ })).toBeVisible();
    await expect(page.getByText('Fainter or gone')).toBeVisible();
    await expect(page.getByText('Brighter or appeared')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('candidate inspection: status, explanations, evidence and spectrum', async ({ page }) => {
    await page.goto('/#/time?region=field-a&view=diff&cand=cand-a-001');
    await expect(page.getByText('SSX-A-001').first()).toBeVisible();
    await expect(page.getByText(/needs follow-up/i).first()).toBeVisible();

    await page.getByText('Explanations', { exact: true }).click();
    await expect(page.getByText('A known asteroid or comet')).toBeVisible();
    await expect(page.getByText('An undiscovered planet')).toBeVisible();
    await expect(page.getByText(/Nothing in this evidence singles out a planet/)).toBeVisible();

    await page.getByText('Evidence', { exact: true }).click();
    await expect(page.getByText('Paired residual in the difference image')).toBeVisible();
    await expect(page.getByText('Simulated spectrum of SSX-A-001').first()).toBeVisible();
  });

  test('asking why a source moved opens a narrated journey that advances on its own', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/time?region=field-a&view=diff&cand=cand-a-001');
    await page.getByRole('button', { name: 'Why does this source appear to move?' }).first().click();
    await expect(page).toHaveURL(/#\/journey\/journey-moving-source/);
    await expect(page.getByRole('heading', { name: 'Why Did This Source Move?' })).toBeVisible();
    await expect(page.getByText(/It is not AI-generated/)).toBeVisible();

    // Narration never starts by itself.
    await expect(page.getByText('Scene 1 of 9')).toBeVisible();
    await page.getByRole('button', { name: 'Begin without sound' }).click();
    await expect(page.getByTestId('captions')).toContainText(/Every planet, moon and asteroid|Seen from Earth/);

    // Speed up, then let narration finish the scene: the player must advance without any click.
    await page.getByRole('button', { name: /Playback speed/ }).click();
    await page.getByRole('button', { name: /Playback speed/ }).click();
    await expect(page.getByText('Scene 2 of 9')).toBeVisible({ timeout: 45_000 });

    // Pause holds position.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

    // Jump to the difference-image scene; the visual and its evidence are there.
    await page.getByRole('button', { name: 'Scene 5: Subtracting the sky' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('img', { name: /Simulated difference image/ })).toBeVisible();
    await page.getByRole('button', { name: /Evidence and sources/ }).click();
    await expect(page.getByText('Claims in this scene')).toBeVisible();
    await expect(page.getByText('Image subtraction is a standard way to isolate sources that changed between exposures.')).toBeVisible();

    // Transcript lets the user jump anywhere.
    await page.getByText('Transcript', { exact: true }).click();
    await page.getByRole('button', { name: /So, why did this source move\?/ }).click();
    await expect(page.getByRole('heading', { name: 'A candidate is a question, not a discovery' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('unsupported questions are declined honestly in demo mode', async ({ page }) => {
    await page.goto('/#/explore/neptune');
    await page.getByLabel('Ask a question').fill('What is dark energy?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Not available in demo mode');
    await expect(page.getByRole('alert')).toContainText('Dynamic journey generation is not available');
    await expect(page).toHaveURL(/#\/explore\/neptune/);
  });

  test('mission page lists real sources and the integrity rules', async ({ page }) => {
    await page.goto('/#/mission');
    await expect(page.getByRole('heading', { name: 'How to read the labels' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Evidence for a Distant Giant Planet in the Solar System/ })).toHaveAttribute('href', 'https://doi.org/10.3847/0004-6256/151/2/22');
    await expect(page.getByRole('link', { name: /SPHEREx: An All-Sky Spectral Survey/ })).toBeVisible();
  });
});

test.describe('small screens', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ['/', '/#/time', '/#/time?region=field-a&view=diff&cand=cand-a-001', '/#/mission', '/#/explore/neptune']) {
    test(`no horizontal overflow at 390px: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(2500);
      const overflow = await page.evaluate(() => {
        const vw = window.innerWidth;
        const offenders: string[] = [];
        if (document.documentElement.scrollWidth > vw + 1) offenders.push('document');
        // Wide data tables may scroll sideways inside their own box; the page and its panels must not.
        document.querySelectorAll<HTMLElement>('.scroll-area, main > *').forEach((el) => {
          const overflowX = getComputedStyle(el).overflowX;
          if (el.scrollWidth > el.clientWidth + 1 && overflowX !== 'hidden' && overflowX !== 'auto' && overflowX !== 'scroll') offenders.push(el.className.slice(0, 80));
        });
        // Nothing visible may extend past the right edge unless an ancestor scrolls or clips it.
        document.querySelectorAll<HTMLElement>('main *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= vw + 1) return;
          for (let a = el.parentElement; a; a = a.parentElement) {
            if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return;
          }
          offenders.push(`${el.tagName} ${el.className.toString().slice(0, 60)}`);
        });
        return offenders;
      });
      expect(overflow).toEqual([]);
    });
  }
});
