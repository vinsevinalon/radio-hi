# CLAUDE.md

# RESPONSIVE VIEWPORT IMPORTANT SIZES
## MOBILE IOS
- iPhone SE: 375x667 (portrait and landscape)
- iPhone 12 Pro Max: 428x926 (portrait and landscape)
- iPhone 15 Pro Max: 428x926 (portrait and landscape)
- iPhone 16 Pro Max: 428x926 (portrait and landscape)

## MOBILE ANDROID
- Samsung Galaxy S24 Ultra: 360x760 (portrait and landscape)
- Samsung Galaxy S24: 360x760 (portrait and landscape)  
- Samsung Galaxy S24 Plus: 360x760 (portrait and landscape)
- Samsung Galaxy S24 FE: 360x760 (portrait and landscape)
- Samsung Galaxy S24 FE Plus: 360x760 (portrait and landscape)
- Samsung Galaxy S24 FE Plus: 360x760 (portrait and landscape)

## DESKTOP
- 1920x1080
- 1280x1024
- 1600x1200

1. Structure & Naming
	•	One responsibility per section. Split multi-purpose layouts into separate sections.
	•	Consistent filenames:
	•	Sections → sections/feature-hero.liquid
	•	Snippets → snippets/feature-hero-media.liquid
	•	Scoped classes: .feature-hero.section-{{ section.id }} to avoid collisions.![alt text](https://file%2B.vscode-resource.vscode-cdn.net/Users/vinsevinalon/Library/Application%20Support/CleanShot/media/media_UGSMH2hq2o/CleanShot%202025-09-11%20at%2023.18.32.png?version%3D1757603925752)
	•	BEM convention: .feature-hero__heading, .feature-hero--dark.
	•	Blocks for extensibility: Favor blocks over hard-coded slots.

⸻

2. Liquid Style
	•	File order:
	1.	Comment header
	2.	Variable prep (assign, capture)
	3.	Markup
	4.	Section CSS
	5.	Section JS
	6.	{% schema %}
	•	Efficiency:
	•	Minimize all_products lookups
	•	Cache repeated filters in variables
	•	Readability: Avoid deep nesting; use guard clauses.
	•	Isolation: Always pass variables explicitly into snippets.

⸻

3. HTML & Accessibility
	•	Semantic tags: Proper heading levels and landmark roles.
	•	Keyboard-friendly: Ensure focus states and navigation.
	•	Alt text: Pull from metafields or settings with fallbacks.
	•	Localization-ready: Use t filter or localization objects.

⸻

4. CSS Approach
	•	Design tokens via CSS vars: Define colors, spacing, radius at root.
	•	Responsive design: Use container queries, clamp() for typography.
	•	Scoped CSS: Nest under .section-{{ section.id }}.
	•	Use logical props: margin-inline, padding-block.
	•	Inline CSS only for small tweaks; larger styles belong in assets.

⸻

5. Images & Media
	•	Responsive <img>: Use image_url, image_tag, widths, sizes.
	•	Lazy loading: Always use loading="lazy".
	•	Aspect ratio: Set with aspect-ratio or wrapper to prevent CLS.
	•	Modern formats: Shopify will serve WebP/AVIF where possible.
	•	Avoid background images when content is semantic.

⸻

6. JavaScript
	•	Vanilla only: No jQuery.
	•	Defer all scripts: Mount on DOMContentLoaded and shopify:section:load.
	•	Scoped init: Use dataset.mounted guard to prevent double mounts.
	•	Event namespacing: e.g. featureHero:onIntersect.
	•	Efficient UX: Prefer IntersectionObserver to scroll listeners.

⸻

7. Settings Schema
	•	Small, focused settings: Use clear labels and defaults.
	•	Presets: Provide strong defaults so merchants start with a usable section.
	•	Blocks: For repeatables (slides, features), set sensible limits.

⸻

8. Tooling & QA
	•	Formatters: Prettier + Liquid plugin, stylelint, eslint.
	•	Demo playground: Build a test template for edge cases.
	•	Performance checks: Lighthouse + CLS inspection.
	•	Content stress tests: Long titles, empty states, missing media.

⸻

9. Production Scaffold Example

See sections/feature-hero.liquid for a complete scaffold implementing these best practices.

⸻

Quick Checklist
	•	Single responsibility, clear naming
	•	Scoped wrapper .section-{{ section.id }}
	•	Semantic headings + accessible alt text
	•	Responsive, lazy images with aspect ratio
	•	Minimal Liquid lookups, cached assigns
	•	Idempotent, scoped JavaScript
	•	Design tokens via CSS variables
	•	Presets + empty state handling


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 310 Nutrition Shopify Theme Development Guide

## Commands

### Development
```bash
pnpm install                    # Install dependencies
pnpm run dev                    # Start concurrent development (Shopify + Vite)
pnpm run dev:vite              # Start Vite development server only
pnpm run dev:shopify           # Start Shopify theme development only
```

### Building & Deployment
```bash
pnpm run build                 # Build and deploy to Shopify
pnpm run build:vite           # Build frontend assets only
pnpm run deploy:shopify       # Deploy theme to Shopify store
```

# RESPONSIVE VIEWPORT IMPORTANT SIZES
## MOBILE IOS
- iPhone SE: 375x667 (portrait and landscape)
- iPhone 12 Pro Max: 428x926 (portrait and landscape)
- iPhone 15 Pro Max: 428x926 (portrait and landscape)
- iPhone 16 Pro Max: 428x926 (portrait and landscape)

## MOBILE ANDROID
- Samsung Galaxy S24 Ultra: 360x760 (portrait and landscape)
- Samsung Galaxy S24: 360x760 (portrait and landscape)
- Samsung Galaxy S24 Plus: 360x760 (portrait and landscape)
- Samsung Galaxy S24 FE: 360x760 (portrait and landscape)

## DESKTOP
- 1920x1080
- 1280x1024
- 1600x1200

1. Structure & Naming
	•	One responsibility per section. Split multi-purpose layouts into separate sections.
	•	Consistent filenames:
	•	Sections → sections/feature-hero.liquid
	•	Snippets → snippets/feature-hero-media.liquid
	•	Scoped classes: .feature-hero.section-{{ section.id }} to avoid collisions.
	•	BEM convention: .feature-hero__heading, .feature-hero--dark.
	•	Blocks for extensibility: Favor blocks over hard-coded slots.

⸻

2. Liquid Style
	•	File order:
	1.	Comment header
	2.	Variable prep (assign, capture)
	3.	Markup
	4.	Section CSS
	5.	Section JS
	6.	{% schema %}
	•	Efficiency:
	•	Minimize all_products lookups
	•	Cache repeated filters in variables
	•	Readability: Avoid deep nesting; use guard clauses.
	•	Isolation: Always pass variables explicitly into snippets.

⸻

3. HTML & Accessibility
	•	Semantic tags: Proper heading levels and landmark roles.
	•	Keyboard-friendly: Ensure focus states and navigation.
	•	Alt text: Pull from metafields or settings with fallbacks.
	•	Localization-ready: Use t filter or localization objects.

⸻

4. CSS Approach
	•	Design tokens via CSS vars: Define colors, spacing, radius at root.
	•	Responsive design: Use container queries, clamp() for typography.
	•	Scoped CSS: Nest under .section-{{ section.id }}.
	•	Use logical props: margin-inline, padding-block.
	•	Inline CSS only for small tweaks; larger styles belong in assets.

⸻

5. Images & Media
	•	Responsive <img>: Use image_url, image_tag, widths, sizes.
	•	Lazy loading: Always use loading="lazy".
	•	Aspect ratio: Set with aspect-ratio or wrapper to prevent CLS.
	•	Modern formats: Shopify will serve WebP/AVIF where possible.
	•	Avoid background images when content is semantic.

⸻

6. JavaScript
	•	Vanilla only: No jQuery.
	•	Defer all scripts: Mount on DOMContentLoaded and shopify:section:load.
	•	Scoped init: Use dataset.mounted guard to prevent double mounts.
	•	Event namespacing: e.g. featureHero:onIntersect.
	•	Efficient UX: Prefer IntersectionObserver to scroll listeners.

⸻

7. Settings Schema
	•	Small, focused settings: Use clear labels and defaults.
	•	Presets: Provide strong defaults so merchants start with a usable section.
	•	Blocks: For repeatables (slides, features), set sensible limits.

⸻

8. Tooling & QA
	•	Formatters: Prettier + Liquid plugin, stylelint, eslint.
	•	Demo playground: Build a test template for edge cases.
	•	Performance checks: Lighthouse + CLS inspection.
	•	Content stress tests: Long titles, empty states, missing media.

⸻

## Architecture & Structure

### Core Directories
- **`sections/`** - Shopify theme sections (985+ files) - main building blocks of pages
- **`templates/`** - Page templates that define structure using sections 
- **`snippets/`** - Reusable Liquid components included in sections/templates
- **`layout/`** - Base layout files (theme.liquid is main layout)
- **`assets/`** - Static files (CSS, JS, images, fonts)
- **`frontend/`** - Vite entry points and modern JS/CSS source files
- **`config/`** - Theme settings and configuration
- **`locales/`** - Translation files for internationalization

### Build System
- **Vite** processes modern JS/CSS from `frontend/entrypoints/`
- **vite-plugin-shopify** integrates Vite with Shopify's asset pipeline
- **Tailwind CSS** processes utility classes from Liquid templates and frontend files

### Theme Environments
Multiple development environments configured in `config.yml`:
- `development` (theme_id: 124523806838)
- `live` (theme_id: 122340704374)
- Individual developer themes: `regina-dev`, `jonas-dev`, `nadine-dev`, `german-dev`

⸻

Quick Checklist
	•	Single responsibility, clear naming
	•	Scoped wrapper .section-{{ section.id }}
	•	Semantic headings + accessible alt text
	•	Responsive, lazy images with aspect ratio
	•	Minimal Liquid lookups, cached assigns
	•	Idempotent, scoped JavaScript
	•	Design tokens via CSS variables
	•	Presets + empty state handling
