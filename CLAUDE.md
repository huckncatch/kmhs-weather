# CLAUDE.md - KMHS Weather Dashboard

## Global Instructions

**IMPORTANT: Before proceeding with any task in this project, always read the global CLAUDE.md file at `~/.config/claude/CLAUDE.md` first.**

This project-specific CLAUDE.md extends and occasionally overrides the global instructions. When conflicts arise, project-specific guidance takes precedence.

## Project Overview

**KMHS Weather Dashboard** is a personal weather station web application that aggregates and displays data from your Ambient Weather WS2000 weather station.

### Purpose

Create a customized weather dashboard with a look and feel similar to existing weather platforms, tailored to your specific preferences and needs.

### Data Sources

This application integrates data from multiple sources:

1. **Ambient Weather** - Primary weather station data (temperature, humidity, wind, pressure, etc.)
   - Your personal Ambient Weather WS2000 weather station account

2. **PWS Weather (pwsweather.com)** - Shared weather station data
   - Weather station data shared with PWS Weather network

3. **Weather Underground (Wunderground)** - Shared weather station data
   - Weather station data shared with Wunderground network

4. **CoCoRaHS (Community Collaborative Rain, Hail and Snow Network)** - Manual rainfall observations
   - **Primary source for rainfall data** - CoCoRaHS manual observations are more accurate than the weather station's rain gauge
   - Daily manual rainfall observations

### Key Features

- Real-time weather data display from your personal weather station
- Accurate rainfall reporting using CoCoRaHS manual observations instead of automated rain gauge
- Customized UI/UX combining the best aspects of Ambient Weather, PWS Weather, and Wunderground interfaces
- Historical data visualization and trends

### Current Status

**In Development** - Project is in the initial setup and planning phase.
