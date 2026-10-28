import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

const MARIA = '3001458820147';
const PEDRO = '3001458824410';
const LAURA = '3001458826632';

let quoteRequests = 0;

function countQuotes({ request }: { request: Request }) {
  if (request.method === 'POST' && new URL(request.url).pathname === '/api/transfers/quote') {
    quoteRequests += 1;
  }
}

async function renderTransfers() {
  quoteRequests = 0;
  server.events.on('request:start', countQuotes);
  await seedSession();
  const utils = renderApp('/transfers');
  await screen.findByLabelText('From');
  return utils;
}

const review = () => screen.getByRole('button', { name: 'Review transfer' });

describe('TransfersPage', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('starts on the first step', async () => {
    const { user } = await renderTransfers();

    expect(screen.getByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'New transfer' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Someone else' }));

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('labels the transfer fields', async () => {
    await renderTransfers();

    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My accounts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Someone else' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('shows the balance of each source account', async () => {
    await renderTransfers();

    expect(
      within(screen.getByLabelText('From')).getByRole('option', {
        name: 'Savings DOP **** 4521 · RD$145,230.50',
      }),
    ).toBeInTheDocument();
  });

  it('masks source balances when balances are hidden', async () => {
    localStorage.setItem('altura.hideBalances', 'true');
    await renderTransfers();

    const from = screen.getByLabelText('From');
    expect(
      within(from).getByRole('option', { name: 'Savings DOP **** 4521 · RD$ ••••••' }),
    ).toBeInTheDocument();
    expect(from).not.toHaveTextContent('145,230.50');
  });

  it('checks the form before asking for a quote', async () => {
    const { user } = await renderTransfers();

    await user.click(review());

    expect(screen.getByText('Choose an account to send to.')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Amount'), '1.234');
    await user.click(review());

    expect(screen.getByText('Use at most 2 decimals.')).toBeInTheDocument();
    expect(quoteRequests).toBe(0);
  });

  it('does not send to the source account', async () => {
    const { user } = await renderTransfers();

    await user.selectOptions(screen.getByLabelText('To account'), 'acc-dop-savings');
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(review());

    expect(screen.getByText('Choose a different account to send to.')).toBeInTheDocument();
    expect(quoteRequests).toBe(0);
  });

  it('estimates the amount received in another currency', async () => {
    const { user } = await renderTransfers();

    await user.selectOptions(screen.getByLabelText('To account'), 'acc-usd-savings');
    await user.type(screen.getByLabelText('Amount'), '100000');

    expect(await screen.findByText('They receive about US$1,628.66')).toBeInTheDocument();
  });

  it('lists saved beneficiaries and looks up a new account', async () => {
    const { user } = await renderTransfers();

    await user.click(screen.getByRole('tab', { name: 'Someone else' }));
    const beneficiary = await screen.findByLabelText('Beneficiary');
    expect(within(beneficiary).getByRole('option', { name: /Maria Perez/ })).toBeInTheDocument();

    await user.selectOptions(beneficiary, 'new');
    await user.type(screen.getByLabelText('Account number'), PEDRO);
    await user.tab();

    expect(await screen.findByText('Account holder: Pedro G.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Save as beneficiary' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Account number'));
    await user.type(screen.getByLabelText('Account number'), '123');
    await user.tab();

    expect(await screen.findByText("We couldn't find that account.")).toBeInTheDocument();
    expect(screen.queryByText('Account holder: Pedro G.')).not.toBeInTheDocument();
  });

  it('shows only the holder of the number currently typed', async () => {
    server.use(
      http.get('/api/accounts/lookup', async ({ request }) => {
        const number = new URL(request.url).searchParams.get('number');
        if (number === PEDRO) {
          await delay(300);
          return HttpResponse.json({
            accountNumber: PEDRO,
            holderName: 'Pedro G.',
            currency: 'DOP',
          });
        }
        return HttpResponse.json({ accountNumber: LAURA, holderName: 'Laura D.', currency: 'USD' });
      }),
    );
    const { user } = await renderTransfers();
    await user.click(screen.getByRole('tab', { name: 'Someone else' }));
    await user.selectOptions(await screen.findByLabelText('Beneficiary'), 'new');
    const number = screen.getByLabelText('Account number');

    await user.type(number, PEDRO);
    await user.tab();
    await user.clear(number);
    await user.type(number, LAURA);
    await user.tab();

    expect(await screen.findByText('Account holder: Laura D.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByText('Account holder: Laura D.')).toBeInTheDocument();
    expect(screen.queryByText('Account holder: Pedro G.')).not.toBeInTheDocument();
  });

  it('shows the daily limit left for third parties', async () => {
    const { user } = await renderTransfers();

    await user.click(screen.getByRole('tab', { name: 'Someone else' }));

    expect(await screen.findByText('Daily limit remaining: RD$250,000.00')).toBeInTheDocument();
  });

  it('shows a server error next to the amount', async () => {
    const { user } = await renderTransfers();

    await user.click(screen.getByRole('tab', { name: 'Someone else' }));
    await user.selectOptions(await screen.findByLabelText('Beneficiary'), 'ben-maria');
    await user.type(screen.getByLabelText('Amount'), '100000.01');
    await user.click(review());

    const message = await screen.findByText(
      'Transfers to other people are limited to RD$100,000.00 each.',
    );
    const amount = screen.getByLabelText('Amount');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount.getAttribute('aria-describedby')).toContain(message.id);
    expect(quoteRequests).toBe(1);
  });

  it('moves to the review step with a quote', async () => {
    const { user } = await renderTransfers();

    await user.selectOptions(screen.getByLabelText('To account'), 'acc-dop-checking');
    await user.type(screen.getByLabelText('Amount'), '1,500.50');
    await user.click(review());

    const heading = await screen.findByRole('heading', { level: 2, name: 'Review your transfer' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(quoteRequests).toBe(1);
  });

  it('sends third-party transfers to the beneficiary number', async () => {
    let body: unknown;
    server.events.on('request:start', async ({ request }) => {
      if (new URL(request.url).pathname === '/api/transfers/quote')
        body = await request.clone().json();
    });
    const { user } = await renderTransfers();

    await user.click(screen.getByRole('tab', { name: 'Someone else' }));
    await user.selectOptions(await screen.findByLabelText('Beneficiary'), 'ben-maria');
    await user.type(screen.getByLabelText('Amount'), '1000');
    await user.type(screen.getByLabelText('Description (optional)'), 'Rent');
    await user.click(review());

    await screen.findByRole('heading', { level: 2, name: 'Review your transfer' });
    expect(body).toEqual({
      fromAccountId: 'acc-dop-savings',
      to: { type: 'third-party', accountNumber: MARIA },
      amount: '1000',
      description: 'Rent',
    });
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
  });
});
