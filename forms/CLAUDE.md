# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Bay View Association Memorial Garden application forms - a static HTML website with form submission capabilities.

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript (no frameworks)
- API: External Vercel serverless function endpoint
- Hosting: GitHub Pages (auto-deployed via GitHub Actions)
- No build tools or package managers required

## Key Files
- `memorial-garden.html` - Production form (1229 lines)
- `memorial-garden-test.html` - Test form with configurable API endpoint (440 lines)
- `.github/workflows/static.yml` - GitHub Pages deployment workflow

## API Integration
Production endpoint: `https://bay-view-memorial-api.vercel.app/api/submit-memorial-garden`
- Forms submit JSON data via POST request
- Test form allows custom API endpoint configuration

## Development Workflow
1. **Testing**: Use `memorial-garden-test.html` locally
2. **Deployment**: Push to main branch triggers automatic GitHub Pages deployment
3. **No build/lint commands** - pure static files

## Form Structure
Both forms collect:
- Personal information (name, address, phone, email)
- Memorial details (honoree, inscription)
- Payment information
- Form includes validation and responsive design

## Important Notes
- All styling is inline CSS within HTML files
- JavaScript is embedded in HTML files (no separate JS files)
- No dependencies or npm packages
- Empty `inprogress/` directory for work in progress