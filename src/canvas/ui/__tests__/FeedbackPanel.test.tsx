import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackPanel } from '../FeedbackPanel';
import { lightTheme } from '../../../theme';

describe('FeedbackPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the feedback button in the menu', () => {
    render(<FeedbackPanel theme={lightTheme} />);
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.queryByTestId('feedback-form')).not.toBeInTheDocument();
  });

  it('transforms to the form when Feedback is clicked', () => {
    render(<FeedbackPanel theme={lightTheme} />);
    fireEvent.click(screen.getByText('Feedback'));
    expect(screen.getByTestId('feedback-form')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message')).toBeInTheDocument();
  });

  it('shrinks back to the menu via the back button', () => {
    render(<FeedbackPanel theme={lightTheme} />);
    fireEvent.click(screen.getByText('Feedback'));
    fireEvent.click(screen.getByText('Back to menu'));
    expect(screen.queryByTestId('feedback-form')).not.toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('submits the form to web3forms and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FeedbackPanel theme={lightTheme} />);
    fireEvent.click(screen.getByText('Feedback'));

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

    render(<FeedbackPanel theme={lightTheme} />);
    fireEvent.click(screen.getByText('Feedback'));

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
