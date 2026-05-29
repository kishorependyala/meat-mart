import { render, screen, waitFor } from '@testing-library/react';

import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => [],
    } as Response)
  );
});

test('renders Halal Meat Market header', async () => {
  render(<App />);
  expect(screen.getByText(/halal meat market/i)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
});
