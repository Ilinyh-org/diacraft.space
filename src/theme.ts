export type ThemeName = 'light' | 'dark';

export type Theme = {
  name: ThemeName;
  canvasBg: string;
  gridLine: string;
  blockFill: string;
  blockStroke: string;
  blockText: string;
  selection: string;
  arrow: string;
  arrowSelected: string;
  runHighlight: string;
  panelBg: string;
  panelShadow: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
  buttonTextDisabled: string;
  buttonBgDisabled: string;
  deleteButton: string;
  editButton: string;
  addButton: string;
  inputBg: string;
  inputText: string;
  divider: string;
};

export const lightTheme: Theme = {
  name: 'light',
  canvasBg: '#fafafa',
  gridLine: '#e5e5e5',
  blockFill: '#ffffff',
  blockStroke: '#333333',
  blockText: '#333333',
  selection: '#2f80ed',
  arrow: '#333333',
  arrowSelected: '#2f80ed',
  runHighlight: '#27ae60',
  panelBg: '#ffffff',
  panelShadow: 'rgba(0,0,0,0.1)',
  buttonBg: '#f5f5f5',
  buttonBorder: '#cccccc',
  buttonText: '#333333',
  buttonTextDisabled: '#bbbbbb',
  buttonBgDisabled: '#fafafa',
  deleteButton: '#eb5757',
  editButton: '#2f80ed',
  addButton: '#27ae60',
  inputBg: '#ffffff',
  inputText: '#333333',
  divider: '#eeeeee',
};

export const darkTheme: Theme = {
  name: 'dark',
  canvasBg: '#1a1a1a',
  gridLine: '#2a2a2a',
  blockFill: '#2d2d2d',
  blockStroke: '#888888',
  blockText: '#e0e0e0',
  selection: '#4a9eff',
  arrow: '#999999',
  arrowSelected: '#4a9eff',
  runHighlight: '#2ecc71',
  panelBg: '#252525',
  panelShadow: 'rgba(0,0,0,0.5)',
  buttonBg: '#333333',
  buttonBorder: '#4a4a4a',
  buttonText: '#e0e0e0',
  buttonTextDisabled: '#555555',
  buttonBgDisabled: '#2a2a2a',
  deleteButton: '#eb5757',
  editButton: '#4a9eff',
  addButton: '#27ae60',
  inputBg: '#2a2a2a',
  inputText: '#e0e0e0',
  divider: '#3a3a3a',
};

const KEY = 'block-diagram-theme-v1';

export function loadThemeName(): ThemeName {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    // ignore
  }
  return 'light';
}

export function saveThemeName(name: ThemeName) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // ignore
  }
}

export function getTheme(name: ThemeName): Theme {
  return name === 'dark' ? darkTheme : lightTheme;
}
