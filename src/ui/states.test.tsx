import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRegions } from '@/api';
import { setTransportForTests } from '@/api/transport';
import { createMockFetch } from '@/mocks/router';
import { QueryBoundary } from './states';

function Regions() {
  const regions = useRegions();
  return (
    <QueryBoundary query={regions} loadingLabel="Loading regions…">
      {(list, meta) => (
        <ul>
          {list.map((r) => (
            <li key={r.id}>
              {r.name} {meta.simulated ? '(simulated)' : ''}
            </li>
          ))}
        </ul>
      )}
    </QueryBoundary>
  );
}

const renderWithClient = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Regions />
    </QueryClientProvider>,
  );

afterEach(() => setTransportForTests(null));

describe('data states', () => {
  it('shows loading, then labelled data from the API', async () => {
    setTransportForTests({ fetch: createMockFetch(), baseUrl: 'http://mock.test' });
    renderWithClient();
    expect(screen.getByRole('status')).toHaveTextContent('Loading regions…');
    expect(await screen.findByText(/Simulated Field A \(simulated\)/)).toBeInTheDocument();
  });

  it('shows an error and NO substitute data when the live backend is unreachable', async () => {
    setTransportForTests({ fetch: () => Promise.reject(new TypeError('Failed to fetch')), baseUrl: 'http://live.test' });
    renderWithClient();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the data service');
    expect(screen.getByRole('alert')).toHaveTextContent('No substitute data is shown');
    expect(screen.queryByText(/Simulated Field/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows a contract error when the backend replies with the wrong shape', async () => {
    setTransportForTests({ fetch: async () => new Response(JSON.stringify({ regions: [] }), { status: 200 }), baseUrl: 'http://live.test' });
    renderWithClient();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected response from the data service');
  });
});
