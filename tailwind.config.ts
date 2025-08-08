/* tailwind.config.ts  ─ clean, scalable & type-safe */
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],                                          // ⚑ toggle via .dark
  content: [
    './{app,components,pages,src}/**/*.{ts,tsx}',               // glob merge
  ],

  /* ––––– global design tokens ––––– */
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },

    extend: {
      /* fonts */
      fontFamily: {
        sans:      ['Inter', 'sans-serif'],
        arabic:    ['Noto Sans Arabic', 'sans-serif'],
        quran:     ['Amiri Quran', 'Scheherazade New', 'Noto Kufi Arabic', 'serif'],
        mushaf:    ['Noto Kufi Arabic', 'Amiri Quran', 'system-ui', 'sans-serif'],
        uthmanic:  ['Amiri Quran', 'Noto Naskh Arabic', 'serif'],
      },

      /* css-vars driven palette – change once in :root */
      colors: {
        border:        'hsl(var(--border))',
        input:         'hsl(var(--input))',
        ring:          'hsl(var(--ring))',
        background:    'hsl(var(--background))',
        foreground:    'hsl(var(--foreground))',

        primary:   { DEFAULT: 'hsl(var(--primary))',   foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive:{DEFAULT: 'hsl(var(--destructive))',foreground: 'hsl(var(--destructive-foreground))'},
        muted:     { DEFAULT: 'hsl(var(--muted))',     foreground: 'hsl(var(--muted-foreground))' },
        accent:    { DEFAULT: 'hsl(var(--accent))',    foreground: 'hsl(var(--accent-foreground))' },
        popover:   { DEFAULT: 'hsl(var(--popover))',   foreground: 'hsl(var(--popover-foreground))' },
        card:      { DEFAULT: 'hsl(var(--card))',      foreground: 'hsl(var(--card-foreground))' },

        /* sidebar & mushaf sub-palettes */
        sidebar: {
          DEFAULT:            'hsl(var(--sidebar-background))',
          foreground:         'hsl(var(--sidebar-foreground))',
          primary:            'hsl(var(--sidebar-primary))',
          'primary-foreground':'hsl(var(--sidebar-primary-foreground))',
          accent:             'hsl(var(--sidebar-accent))',
          'accent-foreground':'hsl(var(--sidebar-accent-foreground))',
          border:             'hsl(var(--sidebar-border))',
          ring:               'hsl(var(--sidebar-ring))',
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

      /* decorative helpers */
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

      /* accordions */
      keyframes: {
        accordionDown: {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        accordionUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordionDown 0.2s ease-out',
        'accordion-up':   'accordionUp 0.2s ease-out',
      },
    },
  },

  /* animate.css plugin for utility driven animations */
  plugins: [require('tailwindcss-animate')],
}

export default config
