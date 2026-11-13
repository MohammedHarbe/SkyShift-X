import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router';
import { isApiError } from '@/api';
import { config } from '@/config/env';
import { Shell } from './Shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Retry only genuine network blips against a live backend. Never mask contract or HTTP errors.
      retry: (failures, error) => config.apiMode === 'live' && isApiError(error) && error.kind === 'network' && failures < 1,
    },
  },
});

export default function App() {
  const Router = config.router === 'browser' ? BrowserRouter : HashRouter;
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Shell />
      </Router>
    </QueryClientProvider>
  );
}
