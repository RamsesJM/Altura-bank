import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

describe('TransfersPage', () => {
  it('starts on the first step', async () => {
    await seedSession();
    renderApp('/transfers');

    expect(await screen.findByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'New transfer' })).toBeInTheDocument();
  });
});
