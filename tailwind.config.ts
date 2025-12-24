import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			'space': ['Space Grotesk', 'system-ui', 'sans-serif'],
  			'inter': ['Inter', 'system-ui', 'sans-serif'],
  			'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
  			'sans': ['Inter', 'system-ui', 'sans-serif'],
  			'display': ['Space Grotesk', 'system-ui', 'sans-serif']
  		},
  		fontSize: {
  			// Typography scale from PRD
  			'metric-hero': ['48px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
  			'metric-hero-mobile': ['36px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
  			'section-title': ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '400' }],
  			'card-header': ['16px', { lineHeight: '1.4', fontWeight: '500' }],
  			'body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
  			'metadata': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
  			'audit': ['13px', { lineHeight: '1.5', fontWeight: '400' }]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// Brand colors
  			brand: {
  				teal: '#2D7A7A',
  				coral: '#E07A5F',
  				sage: '#81B29A',
  				charcoal: '#1A1A1A',
  				'off-white': '#FAFAF8',
  				border: '#D4D4D4',
  				orange: '#F4A261',
  				'deep-blue': '#264653',
  				yellow: '#E9C46A'
  			},
  			// Status colors for easy access
  			status: {
  				open: 'hsl(var(--status-open))',
  				'in-progress': 'hsl(var(--status-in-progress))',
  				overdue: 'hsl(var(--status-overdue))',
  				resolved: 'hsl(var(--status-resolved))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			// Soft, diffused shadows from PRD
  			'card': '0 2px 8px rgba(0, 0, 0, 0.06)',
  			'card-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
  			'card-active': '0 1px 4px rgba(0, 0, 0, 0.08)',
  			'glass': '0 8px 32px rgba(0, 0, 0, 0.08)'
  		},
  		spacing: {
  			// Whitespace from PRD
  			'18': '4.5rem',
  			'22': '5.5rem'
  		},
  		gap: {
  			// Bento grid gap from PRD
  			'bento': '24px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			// Entrance choreography from PRD
  			'fade-in-up': {
  				'0%': { opacity: '0', transform: 'translateY(8px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' }
  			},
  			// Status change animation
  			'resolve-exit': {
  				'0%': { opacity: '1', transform: 'scale(1)' },
  				'100%': { opacity: '0', transform: 'scale(0.95)' }
  			},
  			// Modal slide up for mobile
  			'slide-up': {
  				'0%': { transform: 'translateY(100%)' },
  				'100%': { transform: 'translateY(0)' }
  			},
  			// Subtle pulse for notifications
  			'pulse-subtle': {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '0.7' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
  			'resolve-exit': 'resolve-exit 0.3s ease-out forwards',
  			'slide-up': 'slide-up 0.2s ease-out',
  			'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite'
  		},
  		transitionDuration: {
  			'250': '250ms'
  		},
  		backdropBlur: {
  			'xs': '2px'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
