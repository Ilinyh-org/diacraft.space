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
  };
  render(<ExportPanel {...props} />);
  return props;
}

describe('ExportPanel', () => {
  it('renders export and import sections (issue #63)', () => {
    setup();
    expect(screen.getByText('Export/Import')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    // both export and import JSON buttons are labeled "JSON"
    expect(screen.getAllByText('JSON')).toHaveLength(2);
    expect(screen.queryByText('Import JSON')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('triggers each export action', () => {
    const props = setup();
    fireEvent.click(screen.getByText('PNG'));
    fireEvent.click(screen.getByText('JPEG'));
    fireEvent.click(screen.getByText('SVG'));
    fireEvent.click(screen.getAllByText('JSON')[0]);
    fireEvent.click(screen.getByText('Import'));
    expect(props.onExportPng).toHaveBeenCalledTimes(1);
    expect(props.onExportJpeg).toHaveBeenCalledTimes(1);
    expect(props.onExportSvg).toHaveBeenCalledTimes(1);
    expect(props.onExportJson).toHaveBeenCalledTimes(1);
    expect(props.onImportJson).not.toHaveBeenCalled();
  });
});
