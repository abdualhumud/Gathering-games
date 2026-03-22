// ══════════════════════════════════════════════════════════════════════════
// Huroof Game — Theme Configuration
// Each theme defines two team colors plus accent and background.
// Teams beyond 2 pick from DEFAULT_TEAM_COLORS in HuroofPage.jsx.
// ══════════════════════════════════════════════════════════════════════════

/**
 * makeTeam(hexColor) — builds dim / border / glow variants from a hex color.
 */
function makeTeam(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    main:   hex,
    dim:    `rgba(${r},${g},${b},0.15)`,
    border: `rgba(${r},${g},${b},0.30)`,
    glow:   `rgba(${r},${g},${b},0.40)`,
  };
}

// ── Preset Themes ─────────────────────────────────────────────────────────────

const HUROOF_THEMES = {
  classic: {
    id: 'classic', name: 'كلاسيكي',
    teamA:  makeTeam('#22c55e'),
    teamB:  makeTeam('#f97316'),
    accent: '#fbbf24', accentDim: 'rgba(251,191,36,0.15)',
    bg: '#0d0d1a', surface: '#181830',
    labelA: 'الأخضر', labelB: 'البرتقالي',
  },
  ocean: {
    id: 'ocean', name: 'محيط',
    teamA:  makeTeam('#3b82f6'),
    teamB:  makeTeam('#14b8a6'),
    accent: '#67e8f9', accentDim: 'rgba(103,232,249,0.15)',
    bg: '#0a1628', surface: '#132240',
    labelA: 'الأزرق', labelB: 'التركواز',
  },
  fire: {
    id: 'fire', name: 'ناري',
    teamA:  makeTeam('#ef4444'),
    teamB:  makeTeam('#eab308'),
    accent: '#fb923c', accentDim: 'rgba(251,146,60,0.15)',
    bg: '#1a0a0a', surface: '#2a1515',
    labelA: 'الأحمر', labelB: 'الذهبي',
  },
  royal: {
    id: 'royal', name: 'ملكي',
    teamA:  makeTeam('#a855f7'),
    teamB:  makeTeam('#fbbf24'),
    accent: '#c084fc', accentDim: 'rgba(192,132,252,0.15)',
    bg: '#120a20', surface: '#1e1535',
    labelA: 'البنفسجي', labelB: 'الذهبي',
  },
  neon: {
    id: 'neon', name: 'نيون',
    teamA:  makeTeam('#06b6d4'),
    teamB:  makeTeam('#ec4899'),
    accent: '#a3e635', accentDim: 'rgba(163,230,53,0.15)',
    bg: '#0a0a14', surface: '#141428',
    labelA: 'السماوي', labelB: 'الوردي',
  },
  desert: {
    id: 'desert', name: 'صحراء',
    teamA:  makeTeam('#d97706'),
    teamB:  makeTeam('#0891b2'),
    accent: '#f59e0b', accentDim: 'rgba(245,158,11,0.15)',
    bg: '#1a1006', surface: '#261a08',
    labelA: 'الذهبي', labelB: 'الأزرق',
  },
  midnight: {
    id: 'midnight', name: 'منتصف الليل',
    teamA:  makeTeam('#818cf8'),
    teamB:  makeTeam('#34d399'),
    accent: '#f0abfc', accentDim: 'rgba(240,171,252,0.15)',
    bg: '#030712', surface: '#111827',
    labelA: 'البنفسجي', labelB: 'الأخضر',
  },
  rose: {
    id: 'rose', name: 'وردي',
    teamA:  makeTeam('#f43f5e'),
    teamB:  makeTeam('#8b5cf6'),
    accent: '#fb7185', accentDim: 'rgba(251,113,133,0.15)',
    bg: '#1a0814', surface: '#2a101e',
    labelA: 'الوردي', labelB: 'البنفسجي',
  },
};

export default HUROOF_THEMES;

// ── Storage helpers ───────────────────────────────────────────────────────────

const THEME_KEY = 'huroof-theme-v2';

/** Return the saved theme object, falling back to classic. */
export function getSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return HUROOF_THEMES.classic;
    // Stored as preset ID string
    if (HUROOF_THEMES[raw]) return HUROOF_THEMES[raw];
    // Stored as custom JSON object
    const obj = JSON.parse(raw);
    if (obj && obj.teamA) return obj;
  } catch (_) { /* ignore */ }
  return HUROOF_THEMES.classic;
}

/** Persist a theme (either a preset ID string, or a custom theme object). */
export function saveTheme(themeOrId) {
  try {
    if (typeof themeOrId === 'string') {
      localStorage.setItem(THEME_KEY, themeOrId);
    } else {
      localStorage.setItem(THEME_KEY, JSON.stringify(themeOrId));
    }
  } catch (_) { /* ignore */ }
}

/**
 * buildCustomTheme(teamAHex, teamBHex, [accentHex])
 * Creates a theme object from raw hex color codes.
 * @param {string} teamAHex  - e.g. "#ff0055"
 * @param {string} teamBHex  - e.g. "#0055ff"
 * @param {string} [accentHex] - optional accent color, defaults to gold
 */
export function buildCustomTheme(teamAHex, teamBHex, accentHex = '#fbbf24') {
  const ar = parseInt(accentHex.slice(1,3),16);
  const ag = parseInt(accentHex.slice(3,5),16);
  const ab = parseInt(accentHex.slice(5,7),16);
  return {
    id:      'custom',
    name:    'مخصص',
    teamA:   makeTeam(teamAHex),
    teamB:   makeTeam(teamBHex),
    accent:  accentHex,
    accentDim: `rgba(${ar},${ag},${ab},0.15)`,
    bg:      '#0d0d1a',
    surface: '#181830',
    labelA:  'الفريق أ',
    labelB:  'الفريق ب',
  };
}

/**
 * applyThemeCSS(theme)
 * Writes all theme CSS custom properties to :root.
 */
export function applyThemeCSS(theme) {
  if (!theme) return;
  const root = document.documentElement;
  const set = (prop, val) => val && root.style.setProperty(prop, val);
  set('--huroof-team-a',        theme.teamA?.main);
  set('--huroof-team-a-dim',    theme.teamA?.dim);
  set('--huroof-team-a-border', theme.teamA?.border);
  set('--huroof-team-a-glow',   theme.teamA?.glow);
  set('--huroof-team-b',        theme.teamB?.main);
  set('--huroof-team-b-dim',    theme.teamB?.dim);
  set('--huroof-team-b-border', theme.teamB?.border);
  set('--huroof-team-b-glow',   theme.teamB?.glow);
  set('--huroof-accent',        theme.accent);
  set('--huroof-accent-dim',    theme.accentDim);
  set('--huroof-bg',            theme.bg);
  set('--huroof-surface',       theme.surface);
}
