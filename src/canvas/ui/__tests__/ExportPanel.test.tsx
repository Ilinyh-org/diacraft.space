import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportPanel } from '../ExportPanel';
import { lightTheme } from '../../../theme';

function setup() {
  const props = {
    theme: lightTheme,
    onExportPng: vi.fn(),
    onExportJpeg: vi.fn(),
    onExportSvg: vi.fn(),
    onExportJson: vi.fn(),
    onImportJson: vi.fn(),
    onClear: vi.fn(),
  };
  render(<ExportPanel {...props} />);
  return props;
}

describe('ExportPanel', () => {
  it('renders export and clear buttons', () => {
    setup();
    for (const label of ['PNG', 'JPEG', 'SVG', 'JSON', 'Import JSON', 'Clear']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('triggers each export action', () => {
    const props = setup();
    fireEvent.click(screen.getByText('PNG'));
    fireEvent.click(screen.getByText('JPEG'));
    fireEvent.click(screen.getByText('SVG'));
    fireEvent.click(screen.getByText('JSON'));
    expect(props.onExportPng).toHaveBeenCalledTimes(1);
    expect(props.onExportJpeg).toHaveBeenCalledTimes(1);
    expect(props.onExportSvg).toHaveBeenCalledTimes(1);
    expect(props.onExportJson).toHaveBeenCalledTimes(1);
    expect(props.onImportJson).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it('triggers clear', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Clear'));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
