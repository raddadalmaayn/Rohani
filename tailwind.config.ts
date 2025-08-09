/* tailwind.config.ts — clean, scalable, type-safe */
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config = {
  darkMode: ['class'],
  content: [
    './{app,components,pages,src}/**/*.{ts,tsx}',
    './**/*.mdx',
  ],
  safelist: [
    // if you toggle these via JS, keep them from being purged
    'font-uthmanic', 'font-arabic', 'font-quran', 'font-mushaf',
  ],

  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },

    extend: {
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        arabic:   ['Noto Naskh Arabic', 'system-ui', 'serif'],
        quran:    ['Amiri Quran', 'Scheherazade New', 'Noto Kufi Arabic', 'serif'],
        mushaf:   ['Noto Kufi Arabic', 'Amiri Quran', 'system-ui', 'sans-serif'],
        // Map to your local font-face for the Uthmānī script
        uthmanic: ['"KFGQPC Uthmanic Script Hafs"', 'Scheherazade New', 'Amiri Quran', 'serif'],
      },

      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',

        primary:     { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))' },
        popover:     { DEFAULT: 'hsl(var(--popover))',     foreground: 'hsl(var(--popover-foreground))' },
        card:        { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))' },

        sidebar: {
          DEFAULT:              'hsl(var(--sidebar-background))',
          foreground:           'hsl(var(--sidebar-foreground))',
          primary:              'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent:               'hsl(var(--sidebar-accent))',
          'accent-foreground':  'hsl(var(--sidebar-accent-foreground))',
          border:               'hsl(var(--sidebar-border))',
          ring:                 'hsl(var(--sidebar-ring))',
        },

        mushaf: {
          page:   'hsl(var(--mushaf-page))',
          text:   'hsl(var(--mushaf-text))',
          header: 'hsl(var(--mushaf-header))',
          badge: {
            stroke: 'hsl(var(--mushaf-badge-stroke))',
            fill:   'hsl(var(--mushaf-badge-fill))',
          },
          sajdah: 'hsl(var(--mushaf-sajdah))',
        },
      },

      backgroundImage: {
        'gradient-spiritual': 'var(--gradient-spiritual)',
        'gradient-calm':      'var(--gradient-calm)',
      },
      boxShadow: {
        spiritual: 'var(--shadow-spiritual)',
        gentle:    'var(--shadow-gentle)',
      },
      transitionProperty: {
        mindful: 'var(--transition-mindful)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },

  plugins: [
    require('tailwindcss-animate'),
    // Small utility for proper Arabic/Uthmānī ligatures when needed
    plugin(({ addUtilities }) => {
      addUtilities({
        '.liga-uthmanic': {
          fontVariantLigatures: 'contextual common discretionary historical',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      })
    }),
  ],
} satisfies Config

export default config
