import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { DraggablePanel } from '../../ui/DraggablePanel';
import type { Theme } from '../../theme';

const WEB3FORMS_ACCESS_KEY = '58d46050-932f-49ac-bfdc-b07822fe6adc';

type FeedbackStatus = 'idle' | 'sending' | 'success' | 'error';

export function FeedbackPanel({ theme }: { theme: Theme }) {
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>('idle');

  const buttonStyle: CSSProperties = {
    padding: '6px 10px',
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: 'pointer',
    fontSize: 12,
    textAlign: 'center',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: theme.buttonBg,
    color: theme.buttonText,
    fontSize: 12,
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append('access_key', WEB3FORMS_ACCESS_KEY);

    setStatus('sending');
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStatus('success');
        form.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const shrinkToMenu = () => {
    setShowForm(false);
    setStatus('idle');
  };

  return (
    <DraggablePanel
      theme={theme}
      initialPosition={{
        x: Math.max(10, window.innerWidth - 90),
        y: window.innerHeight - 150,
      }}
    >
      {showForm ? (
        <div>
          <div
            style={{
              fontSize: 11,
              textAlign: 'center',
              color: theme.buttonTextDisabled,
              marginBottom: 4,
            }}
          >
            Feedback
          </div>
          <form onSubmit={handleSubmit} data-testid="feedback-form">
            <input
              type="text"
              name="name"
              placeholder="Name"
              required
              style={{ ...inputStyle, marginBottom: 4 }}
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              required
              style={{ ...inputStyle, marginBottom: 4 }}
            />
            <textarea
              name="message"
              placeholder="Message"
              required
              rows={4}
              style={{ ...inputStyle, marginBottom: 4, resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{ ...buttonStyle, width: '100%', marginBottom: 4 }}
            >
              {status === 'sending' ? 'Sending…' : 'Submit'}
            </button>
          </form>
          {status === 'success' && (
            <div style={{ fontSize: 11, color: theme.buttonText }}>
              Success! Your message has been sent.
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontSize: 11, color: theme.deleteButton }}>
              Error: something went wrong. Please try again.
            </div>
          )}
          <div style={{ height: 1, background: theme.divider, margin: '4px 0' }} />
          <button onClick={shrinkToMenu} style={{ ...buttonStyle, width: '100%' }}>
            Back to menu
          </button>
        </div>
      ) : (
        <div>
          <div
            style={{
              fontSize: 11,
              textAlign: 'center',
              color: theme.buttonTextDisabled,
              marginBottom: 2,
            }}
          >
            Menu
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{ ...buttonStyle, width: '100%' }}
          >
            Feedback
          </button>
        </div>
      )}
    </DraggablePanel>
  );
}
