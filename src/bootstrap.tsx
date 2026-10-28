import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { MockStartupError } from './components/MockStartupError';

interface StartAppOptions {
  startMocking: () => Promise<unknown>;
  reload?: () => void;
}

export async function startApp(
  container: HTMLElement,
  { startMocking, reload = () => window.location.reload() }: StartAppOptions,
): Promise<Root> {
  const root = createRoot(container);

  try {
    await startMocking();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error('[Altura Bank] The mock API could not start.', error);
    root.render(<MockStartupError onRetry={reload} />);
  }

  return root;
}
