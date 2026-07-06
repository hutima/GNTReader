import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';

// The shell smoke needs no data — stub fetch so happy-dom never opens a real
// connection (its teardown abort is noisy).
beforeAll(() => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }) as Response);
});

describe('app shell smoke', () => {
  it('renders the header navigation and display-mode control', () => {
    render(<App />);
    // Default position is John 1 (bundled fixture).
    expect(screen.getByRole('button', { name: /John 1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Original' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gloss' })).toBeInTheDocument();
  });
});
