import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('app shell smoke', () => {
  it('renders the header brand', () => {
    render(<App />);
    expect(screen.getByText('GNT Reader')).toBeInTheDocument();
  });
});
