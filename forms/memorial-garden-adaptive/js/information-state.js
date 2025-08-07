/**
 * Information State Management
 * Tracks what information we have, what we need, and who might have it
 */

class InformationState {
    constructor() {
        this.state = {
            journey: sessionStorage.getItem('memorialGardenJourney') || 'unknown',
            submitter: {
                role: null, // self, spouse, child, friend, executor
                hasAuthority: null,
                emotionalState: null, // composed, overwhelmed, urgent
                name: null,
                contact: null
            },
            required: {
                // Minimum required fields
                deceased: {
                    name: { value: null, confidence: 0, source: null },
                    placement_type: { value: null, confidence: 0, source: null }
                },
                membership: {
                    is_member: { value: null, confidence: 0, source: null },
                    member_name: { value: null, confidence: 0, source: null, required_if_non_member: true }
                },
                contact: {
                    name: { value: null, confidence: 0, source: null },
                    phone: { value: null, confidence: 0, source: null },
                    email: { value: null, confidence: 0, source: null }
                },
                payment: {
                    amount: { value: null, confidence: 0, source: null },
                    method: { value: null, confidence: 0, source: null }
                },
                acknowledgment: {
                    policies_accepted: { value: false, confidence: 0, source: null }
                }
            },
            optional: {
                // Nice to have but not blocking
                personal_history: {
                    birth_date: { value: null, confidence: 0, source: null },
                    death_date: { value: null, confidence: 0, source: null },
                    birth_place: { value: null, confidence: 0, source: null },
                    parents: { value: null, confidence: 0, source: null },
                    bay_view_history: { value: null, confidence: 0, source: null }
                },
                service_preferences: {
                    date: { value: null, confidence: 0, source: null },
                    celebrant: { value: null, confidence: 0, source: null },
                    special_requests: { value: null, confidence: 0, source: null }
                }
            },
            metadata: {
                started_at: new Date().toISOString(),
                last_saved: null,
                completion_percentage: 0,
                blockers: [],
                helpers: [] // People who might have missing info
            }
        };
        
        this.load();
    }
    
    /**
     * Set a field value with confidence and source
     */
    setValue(category, section, field, value, confidence = 100, source = 'user') {
        if (this.state[category] && this.state[category][section] && this.state[category][section][field]) {
            this.state[category][section][field] = {
                value: value,
                confidence: confidence,
                source: source,
                updated_at: new Date().toISOString()
            };
            this.save();
            this.updateCompletionPercentage();
        }
    }
    
    /**
     * Get a field value
     */
    getValue(category, section, field) {
        if (this.state[category] && this.state[category][section] && this.state[category][section][field]) {
            return this.state[category][section][field].value;
        }
        return null;
    }
    
    /**
     * Check if we have all required information
     */
    isComplete() {
        return this.getMissingRequired().length === 0;
    }
    
    /**
     * Get list of missing required fields
     */
    getMissingRequired() {
        const missing = [];
        
        for (const [section, fields] of Object.entries(this.state.required)) {
            for (const [field, data] of Object.entries(fields)) {
                // Check conditional requirements
                if (field === 'member_name' && this.getValue('required', 'membership', 'is_member') === true) {
                    continue; // Not required if they are a member
                }
                
                if (data.value === null || data.value === '') {
                    missing.push({
                        section: section,
                        field: field,
                        display_name: this.getFieldDisplayName(section, field)
                    });
                }
            }
        }
        
        return missing;
    }
    
    /**
     * Suggest who might have missing information
     */
    suggestHelpers(field) {
        const helpers = {
            'bay_view_history': ['long-time members', 'Bay View office', 'family members who spent summers here'],
            'birth_date': ['family members', 'obituary', 'family records'],
            'death_date': ['death certificate', 'funeral home', 'family members'],
            'member_name': ['Bay View membership office', 'member directory', 'neighbors'],
            'parents': ['obituary', 'family members', 'genealogy records']
        };
        
        return helpers[field] || ['family members'];
    }
    
    /**
     * Get human-readable field name
     */
    getFieldDisplayName(section, field) {
        const names = {
            deceased: {
                name: "Name of deceased",
                placement_type: "Type of placement"
            },
            membership: {
                is_member: "Bay View membership status",
                member_name: "Bay View member sponsor"
            },
            contact: {
                name: "Your name",
                phone: "Phone number",
                email: "Email address"
            },
            payment: {
                amount: "Payment amount",
                method: "Payment method"
            },
            acknowledgment: {
                policies_accepted: "Memorial Garden policies"
            }
        };
        
        return names[section]?.[field] || field;
    }
    
    /**
     * Calculate completion percentage
     */
    updateCompletionPercentage() {
        const required = this.getMissingRequired();
        const totalRequired = Object.values(this.state.required)
            .reduce((sum, section) => sum + Object.keys(section).length, 0);
        
        this.state.metadata.completion_percentage = Math.round(
            ((totalRequired - required.length) / totalRequired) * 100
        );
    }
    
    /**
     * Save state to localStorage
     */
    save() {
        this.state.metadata.last_saved = new Date().toISOString();
        localStorage.setItem('memorialGardenState', JSON.stringify(this.state));
    }
    
    /**
     * Load state from localStorage
     */
    load() {
        const saved = localStorage.getItem('memorialGardenState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with current state to preserve structure
                this.state = { ...this.state, ...parsed };
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
    }
    
    /**
     * Clear all saved state
     */
    clear() {
        localStorage.removeItem('memorialGardenState');
        sessionStorage.removeItem('memorialGardenJourney');
        sessionStorage.removeItem('informationReadiness');
    }
    
    /**
     * Export state for sharing or backup
     */
    export() {
        return {
            state: this.state,
            exported_at: new Date().toISOString(),
            share_code: this.generateShareCode()
        };
    }
    
    /**
     * Import shared state
     */
    import(sharedState) {
        if (sharedState && sharedState.state) {
            this.state = { ...this.state, ...sharedState.state };
            this.save();
            return true;
        }
        return false;
    }
    
    /**
     * Generate unique share code for collaboration
     */
    generateShareCode() {
        return 'MG-' + Date.now().toString(36).toUpperCase();
    }
    
    /**
     * Set submitter information
     */
    setSubmitter(role, name, contact, hasAuthority = true) {
        this.state.submitter = {
            role: role,
            name: name,
            contact: contact,
            hasAuthority: hasAuthority,
            identified_at: new Date().toISOString()
        };
        this.save();
    }
    
    /**
     * Add a potential helper
     */
    addHelper(name, relationship, mightKnow = []) {
        this.state.metadata.helpers.push({
            name: name,
            relationship: relationship,
            might_know: mightKnow,
            added_at: new Date().toISOString()
        });
        this.save();
    }
    
    /**
     * Get next best action based on current state
     */
    getNextAction() {
        const missing = this.getMissingRequired();
        
        if (missing.length === 0) {
            return { action: 'review', message: 'All required information collected. Ready to review and submit.' };
        }
        
        // Prioritize based on importance
        const priority = ['deceased.name', 'membership.is_member', 'contact.name', 'contact.phone'];
        
        for (const p of priority) {
            const [section, field] = p.split('.');
            const found = missing.find(m => m.section === section && m.field === field);
            if (found) {
                return {
                    action: 'collect',
                    field: found,
                    helpers: this.suggestHelpers(field),
                    message: `We need to collect: ${found.display_name}`
                };
            }
        }
        
        return {
            action: 'collect',
            field: missing[0],
            helpers: this.suggestHelpers(missing[0].field)
        };
    }
}

// Export for use in other modules
window.InformationState = InformationState;