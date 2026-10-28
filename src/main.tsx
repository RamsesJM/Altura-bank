import { startApp } from './bootstrap';
import './index.css';

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

void startApp(document.getElementById('root')!, { startMocking: enableMocking });
