# Memorial Garden Adaptive Forms System

This directory contains the new adaptive interview-based system for Memorial Garden applications, designed to accommodate different user journeys and information availability scenarios.

## Design Philosophy

Instead of a one-size-fits-all form, this system adapts based on:
- Who is filling out the form (self, spouse, child, friend)
- Their relationship to the deceased
- Information availability
- Emotional state and urgency
- Need for collaboration

## Core Components

### 1. Entry Portal (`index.html`)
The intelligent entry point that determines the user's journey.

### 2. Interview Paths
- **Express Path**: For users with complete information
- **Guided Path**: For users needing assistance
- **Assisted Path**: For users in distress or with minimal information
- **Collaborative Path**: For families working together

### 3. State Management (`js/information-state.js`)
Tracks what information we have vs. what we need, and who might have missing information.

### 4. Journey Router (`js/journey-router.js`)
Dynamically determines which questions to ask based on user context.

### 5. Shared Components
- Member verification
- Payment calculator
- Address autocomplete
- Save & resume functionality
- Family collaboration tools

## User Journeys Supported

1. **"I'm Planning for Myself"** - Future planning with full information
2. **"My Spouse Just Died"** - Immediate need with emotional support
3. **"I'm the Adult Child Handling This"** - Partial information, may need family help
4. **"I'm Helping My Friend/Neighbor"** - Limited authority and information
5. **"We're Planning Together"** - Couple planning jointly
6. **"I'm Verifying Grandma's Prepayment"** - Historical verification

## Technical Architecture

```
memorial-garden-adaptive/
├── index.html                 # Entry portal
├── css/
│   ├── base.css              # Shared styles
│   ├── journey.css           # Journey-specific styles
│   └── responsive.css        # Mobile adaptations
├── js/
│   ├── app.js                # Main application
│   ├── journey-router.js     # Path determination
│   ├── information-state.js  # State tracking
│   ├── interview-engine.js   # Question flow logic
│   └── components/           # Reusable components
├── paths/
│   ├── express.html          # Traditional form
│   ├── guided.html           # Conversational flow
│   ├── assisted.html         # Minimal fields
│   └── collaborative.html    # Family sharing
└── api/
    └── handlers/             # Backend integration
```

## Key Innovations

1. **Adaptive Questioning**: Only asks relevant questions based on previous answers
2. **Information State Tracking**: Knows what's missing and who might have it
3. **Emotional Intelligence**: Language and pace adapt to user's situation
4. **Progressive Disclosure**: Complex sections only appear when needed
5. **Collaboration Tools**: Family members can contribute different pieces
6. **Save & Resume**: Recognizes that gathering information takes time

## Implementation Status

- [ ] Entry portal design
- [ ] Journey determination logic
- [ ] Express path (traditional form)
- [ ] Guided path implementation
- [ ] Assisted path with callback
- [ ] Collaborative family tools
- [ ] State persistence
- [ ] API integration
- [ ] Testing with real scenarios
- [ ] Accessibility review
- [ ] Mobile optimization