import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { DraggablePanel } from '../../ui/DraggablePanel';
import type { Theme } from '../../theme';
import { t, type LanguageCode } from './i18n';

const WEB3FORMS_ACCESS_KEY = '58d46050-932f-49ac-bfdc-b07822fe6adc';

type FeedbackStatus = 'idle' | 'sending' | 'success' | 'error';

const FEEDBACK_PANEL_WIDTH = 220;

export function FeedbackPanel({ theme, language }: { theme: Theme; language: LanguageCode }) {
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

  return (
    <DraggablePanel
      theme={theme}
      initialPosition={{
        x: Math.max(10, window.innerWidth - FEEDBACK_PANEL_WIDTH - 10),
        y: window.innerHeight - 150,
      }}
      width={FEEDBACK_PANEL_WIDTH}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            textAlign: 'center',
            color: theme.buttonTextDisabled,
            marginBottom: 4,
          }}
        >
          {t(language, 'feedback.title')}
        </div>
        <form onSubmit={handleSubmit} data-testid="feedback-form">
          <input
            type="text"
            name="name"
            placeholder={t(language, 'feedback.name')}
            required
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          <input
            type="email"
            name="email"
            placeholder={t(language, 'feedback.email')}
            required
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          <textarea
            name="message"
            placeholder={t(language, 'feedback.message')}
            required
            rows={4}
            style={{ ...inputStyle, marginBottom: 4, resize: 'vertical' }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{ ...buttonStyle, width: '100%', marginBottom: 4 }}
          >
            {status === 'sending'
              ? t(language, 'feedback.sending')
              : t(language, 'feedback.submit')}
          </button>
        </form>
        {status === 'success' && (
          <div style={{ fontSize: 11, color: theme.buttonText }}>
            {t(language, 'feedback.success')}
          </div>
        )}
        {status === 'error' && (
          <div style={{ fontSize: 11, color: theme.deleteButton }}>
            {t(language, 'feedback.error')}
          </div>
        )}
        </div>
    </DraggablePanel>
  );
}
