import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { EXCHANGE_RATE } from '../mocks/bankingData';
import { db } from '../mocks/db';
import { server } from '../mocks/server';
import { quoteTransfer } from '../mocks/transferRules';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';
import type { TransferQuoteRequest } from '../types/banking';

const PEDRO = '3001458824410';

interface ConfirmCall {
  key: string | null;
  body: { quoteId: string; otp?: string; saveBeneficiary?: boolean };
}

let confirmCalls: ConfirmCall[] = [];

function recordConfirms({ request }: { request: Request }) {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/transfers') return;
  const key = request.headers.get('Idempotency-Key');
  void request
    .clone()
    .json()
    .then((body) => confirmCalls.push({ key, body }));
}

function quoteExpiringIn(ms: number) {
  server.use(
    http.post(
      '/api/transfers/quote',
      async ({ request }) => {
        const body = (await request.json()) as TransferQuoteRequest;
        const state = {
          accounts: db.accounts,
          directory: db.directory,
          transfers: db.transfers,
          rate: EXCHANGE_RATE,
        };
        const result = quoteTransfer(state, body, Date.now());
        if (!result.ok) return HttpResponse.json(result.error, { status: result.status });
        const quote = { ...result.quote, expiresAt: new Date(Date.now() + ms).toISOString() };
        db.quotes[quote.quoteId] = { request: body, quote, otpAttempts: 0, status: 'open' };
        return HttpResponse.json(quote);
      },
      { once: true },
    ),
  );
}

async function renderTransfers() {
  confirmCalls = [];
  server.events.on('request:start', recordConfirms);
  await seedSession();
  const utils = renderApp('/transfers');
  await screen.findByLabelText('From');
  return utils;
}

async function reviewOwnTransfer(amount = '1500.50', to = 'acc-dop-checking') {
  const utils = await renderTransfers();
  await utils.user.selectOptions(screen.getByLabelText('To account'), to);
  await utils.user.type(screen.getByLabelText('Amount'), amount);
  await utils.user.click(screen.getByRole('button', { name: 'Review transfer' }));
  await screen.findByRole('heading', { level: 2, name: 'Review your transfer' });
  return utils;
}

async function reviewThirdPartyTransfer(
  options: { beneficiary?: string; accountNumber?: string; save?: boolean } = {},
) {
  const utils = await renderTransfers();
  const { user } = utils;
  await user.click(screen.getByRole('tab', { name: 'Someone else' }));
  const beneficiary = await screen.findByLabelText('Beneficiary');
  if (options.accountNumber) {
    await user.selectOptions(beneficiary, 'new');
    await user.type(screen.getByLabelText('Account number'), options.accountNumber);
    await user.tab();
    await screen.findByText(/Account holder:/);
    if (options.save)
      await user.click(screen.getByRole('checkbox', { name: 'Save as beneficiary' }));
  } else {
    await user.selectOptions(beneficiary, options.beneficiary ?? 'ben-maria');
  }
  await user.type(screen.getByLabelText('Amount'), '1000');
  await user.click(screen.getByRole('button', { name: 'Review transfer' }));
  await screen.findByRole('heading', { level: 2, name: 'Review your transfer' });
  return utils;
}

async function enterCode(user: Awaited<ReturnType<typeof renderTransfers>>['user'], code: string) {
  const input = screen.getByLabelText('Verification code');
  await user.clear(input);
  await user.type(input, code);
  await user.click(screen.getByRole('button', { name: 'Confirm transfer' }));
}

const confirmButton = () => screen.getByRole('button', { name: 'Confirm transfer' });

describe('TransfersPage confirmation', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('shows the quote before confirming', async () => {
    await reviewOwnTransfer('100000', 'acc-usd-savings');

    const summary = screen.getByRole('region', { name: 'Review your transfer' });
    expect(within(summary).getByText('Savings DOP **** 4521')).toBeInTheDocument();
    expect(within(summary).getByText('Savings USD **** 3307')).toBeInTheDocument();
    expect(within(summary).getByText('RD$100,000.00')).toBeInTheDocument();
    expect(within(summary).getByText('1 USD = 61.40 DOP')).toBeInTheDocument();
    expect(within(summary).getByText('US$1,628.66')).toBeInTheDocument();
    expect(screen.getByText('This quote expires in 5:00')).toBeInTheDocument();
  });

  it('goes back to the form with the draft intact', async () => {
    const { user } = await reviewOwnTransfer('100000', 'acc-usd-savings');

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'New transfer' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue('100000');
    expect(screen.getByLabelText('To account')).toHaveValue('acc-usd-savings');
  });

  it('confirms the latest quote after editing', async () => {
    const { user } = await reviewOwnTransfer('100');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const amount = await screen.findByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '200');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    await screen.findByText('RD$200.00');

    await user.click(confirmButton());

    await screen.findByRole('heading', { level: 2, name: 'Transfer sent' });
    const [firstQuote, secondQuote] = Object.keys(db.quotes);
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0].body.quoteId).toBe(secondQuote);
    expect(confirmCalls[0].body.quoteId).not.toBe(firstQuote);
    expect(db.quotes[firstQuote].status).toBe('open');
  });

  it('sends an own-account transfer and updates the app', async () => {
    const { user } = await reviewOwnTransfer();

    await user.click(confirmButton());

    const heading = await screen.findByRole('heading', { level: 2, name: 'Transfer sent' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByText(/^TRF-\d{8}-[A-Z0-9]{6}$/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'View transactions' }));
    expect(await screen.findByText('Transfer to Checking DOP **** 9874')).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('nav-desktop')).getByRole('link', { name: 'Dashboard' }),
    );
    expect(await screen.findByText('RD$143,730.00')).toBeInTheDocument();
  });

  it('sends one request when Confirm is double-clicked', async () => {
    const { user } = await reviewOwnTransfer();

    await user.dblClick(confirmButton());

    await screen.findByRole('heading', { level: 2, name: 'Transfer sent' });
    expect(confirmCalls).toHaveLength(1);
    expect(db.transfers).toHaveLength(1);
  });

  it('retries a failed confirmation with the same key', async () => {
    server.use(http.post('/api/transfers', () => HttpResponse.error(), { once: true }));
    const { user } = await reviewOwnTransfer();

    await user.click(confirmButton());

    expect(
      await screen.findByText(
        "We couldn't confirm your transfer. Check your transactions before trying again.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByRole('heading', { level: 2, name: 'Transfer sent' });
    expect(confirmCalls).toHaveLength(2);
    expect(confirmCalls[0].key).toBeTruthy();
    expect(confirmCalls[1].key).toBe(confirmCalls[0].key);
    expect(db.transfers).toHaveLength(1);
  });

  it('asks third parties for a code and locks after three mistakes', async () => {
    const { user } = await reviewThirdPartyTransfer();

    await user.click(confirmButton());

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Enter your verification code' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    expect(screen.getByText('Demo code: 123456')).toBeInTheDocument();

    await enterCode(user, '000000');
    expect(await screen.findByText('Incorrect code. 2 attempts left.')).toBeInTheDocument();

    await enterCode(user, '111111');
    expect(await screen.findByText('Incorrect code. 1 attempt left.')).toBeInTheDocument();

    await enterCode(user, '222222');
    expect(await screen.findByText('Too many attempts. Start a new transfer.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'New transfer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue('1000');
    expect(db.transfers).toHaveLength(0);
  });

  it('sends to a third party with the right code', async () => {
    const { user } = await reviewThirdPartyTransfer();
    await user.click(confirmButton());
    await screen.findByLabelText('Verification code');

    await enterCode(user, '123456');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Transfer sent' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
    expect(screen.getByText('Maria P.')).toBeInTheDocument();
  });

  it('saves a new beneficiary', async () => {
    const { user } = await reviewThirdPartyTransfer({ accountNumber: PEDRO, save: true });
    await user.click(confirmButton());
    await screen.findByLabelText('Verification code');
    await enterCode(user, '123456');
    await screen.findByRole('heading', { level: 2, name: 'Transfer sent' });

    await user.click(screen.getByRole('button', { name: 'Make another transfer' }));
    await user.click(await screen.findByRole('tab', { name: 'Someone else' }));

    const beneficiary = await screen.findByLabelText('Beneficiary');
    expect(
      await within(beneficiary).findByRole('option', { name: /Pedro G\./ }),
    ).toBeInTheDocument();
    expect(confirmCalls[confirmCalls.length - 1].body.saveBeneficiary).toBe(true);
  });

  it('offers a new quote when the quote expires', async () => {
    quoteExpiringIn(1_000);
    const { user } = await reviewOwnTransfer();

    const requote = await screen.findByRole(
      'button',
      { name: 'Get a new quote' },
      { timeout: 3_000 },
    );
    expect(screen.getByText('This quote has expired.')).toBeInTheDocument();

    await user.click(requote);

    expect(await screen.findByText('This quote expires in 5:00')).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it('explains an expired quote on the code step', async () => {
    quoteExpiringIn(1_000);
    const { user } = await reviewThirdPartyTransfer();
    await user.click(confirmButton());
    await screen.findByLabelText('Verification code');
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    await enterCode(user, '123456');

    expect(
      await screen.findByText('This quote has expired. Review the transfer again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get a new quote' })).toBeInTheDocument();
    expect(db.transfers).toHaveLength(0);
  });
});
