import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackPanel } from '../FeedbackPanel';
import { lightTheme } from '../../../theme';

describe('FeedbackPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with a fixed width that fits the screen and starts fully on-screen', () => {
    render(<FeedbackPanel theme={lightTheme} language="en" />);
    const panel = document.querySelector('.draggable-panel') as HTMLElement;
    expect(panel).not.toBeNull();
    // Panel has an explicit width and never exceeds the viewport.
    expect(panel.style.width).not.toBe('');
    expect(panel.style.maxWidth).toBe('calc(100vw - 16px)');
    // Initial position must keep the whole panel visible.
    const left = parseInt(panel.style.left, 10);
    expect(left).toBeGreaterThanOrEqual(10);
    expect(left + parseInt(panel.style.width, 10)).toBeLessThanOrEqual(
      window.innerWidth
    );
  });

  it('always shows the form immediately (no compressed view)', () => {
    render(<FeedbackPanel theme={lightTheme} language="en" />);
    expect(screen.getByTestId('feedback-form')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message')).toBeInTheDocument();
    expect(screen.queryByText('Back to menu')).not.toBeInTheDocument();
  });

  it('submits the form to web3forms and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FeedbackPanel theme={lightTheme} language="en" />);

    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Message'), {
      target: { value: 'Hello' },
    });
    fireEvent.submit(screen.getByTestId('feedback-form'));

    await waitFor(() => {
      expect(screen.getByText(/Success!/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.web3forms.com/submit',
      expect.objectContaining({ method: 'POST' })
    );
    const call = fetchMock.mock.calls[0];
    const formData = call[1].body as FormData;
    expect(formData.get('name')).toBe('Test');
    expect(formData.get('access_key')).toBeTruthy();
  });

  it('shows an error when the submission fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      })
    );

    render(<FeedbackPanel theme={lightTheme} language="en" />);

    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Message'), {
      target: { value: 'Hello' },
    });
    fireEvent.submit(screen.getByTestId('feedback-form'));

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
