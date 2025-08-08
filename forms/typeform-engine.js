/**
 * Typeform-Inspired Form Engine for Bay View Association
 * A human-centered, conversational form system with smooth transitions
 */

class TypeformEngine {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId || 'typeform-container',
            apiEndpoint: config.apiEndpoint || '/api/submit',
            theme: config.theme || 'bayview',
            animations: config.animations !== false,
            keyboard: config.keyboard !== false,
            progress: config.progress !== false,
            autosave: config.autosave !== false,
            ...config
        };
        
        this.currentStep = 0;
        this.formData = {};
        this.history = [];
        this.validators = {};
        this.conditions = {};
        this.steps = [];
        
        this.init();
    }

    init() {
        this.container = document.getElementById(this.config.containerId);
        if (!this.container) {
            console.error(`Container #${this.config.containerId} not found`);
            return;
        }
        
        this.setupStructure();
        this.bindEvents();
        this.loadAutosave();
    }

    setupStructure() {
        this.container.innerHTML = `
            <div class="tf-wrapper">
                ${this.config.progress ? '<div class="tf-progress"><div class="tf-progress-bar"></div></div>' : ''}
                <div class="tf-header">
                    <button class="tf-back-btn" aria-label="Go back">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <div class="tf-step-indicator"></div>
                </div>
                <div class="tf-content">
                    <div class="tf-questions-container"></div>
                </div>
                <div class="tf-footer">
                    <button class="tf-continue-btn" type="button">
                        <span class="tf-btn-text">Continue</span>
                        <svg class="tf-btn-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M7 4L13 10L7 16" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        this.elements = {
            wrapper: this.container.querySelector('.tf-wrapper'),
            progressBar: this.container.querySelector('.tf-progress-bar'),
            backBtn: this.container.querySelector('.tf-back-btn'),
            stepIndicator: this.container.querySelector('.tf-step-indicator'),
            questionsContainer: this.container.querySelector('.tf-questions-container'),
            continueBtn: this.container.querySelector('.tf-continue-btn'),
            footer: this.container.querySelector('.tf-footer')
        };
    }

    bindEvents() {
        // Keyboard navigation
        if (this.config.keyboard) {
            document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        }
        
        // Continue button
        this.elements.continueBtn.addEventListener('click', () => this.next());
        
        // Back button
        this.elements.backBtn.addEventListener('click', () => this.previous());
        
        // Auto-focus on input change
        this.container.addEventListener('change', (e) => {
            if (e.target.matches('input[type="radio"], input[type="checkbox"]')) {
                this.handleQuickContinue(e.target);
            }
        });
        
        // Autosave
        if (this.config.autosave) {
            setInterval(() => this.saveProgress(), 5000);
        }
    }

    handleKeyboard(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const activeElement = document.activeElement;
            if (activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.next();
            }
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            // Navigate to previous option
            this.navigateOptions(-1);
        } else if (e.key === 'ArrowDown' || e.key === 'Tab') {
            // Navigate to next option
            this.navigateOptions(1);
        }
    }

    addStep(step) {
        const processedStep = {
            id: step.id || `step-${this.steps.length}`,
            type: step.type || 'text',
            question: step.question,
            description: step.description,
            placeholder: step.placeholder,
            options: step.options || [],
            validation: step.validation || {},
            condition: step.condition,
            required: step.required !== false,
            multiple: step.multiple || false,
            ...step
        };
        
        this.steps.push(processedStep);
        
        if (step.validation) {
            this.validators[processedStep.id] = step.validation;
        }
        
        if (step.condition) {
            this.conditions[processedStep.id] = step.condition;
        }
        
        return this;
    }

    renderStep(stepIndex) {
        const step = this.steps[stepIndex];
        if (!step) return;
        
        // Check conditions
        if (step.condition && !this.evaluateCondition(step.condition)) {
            this.next();
            return;
        }
        
        const questionHtml = this.renderQuestion(step);
        
        // Animate transition
        if (this.config.animations) {
            this.animateTransition(questionHtml);
        } else {
            this.elements.questionsContainer.innerHTML = questionHtml;
        }
        
        // Update progress
        this.updateProgress();
        
        // Update step indicator
        this.updateStepIndicator();
        
        // Focus first input
        setTimeout(() => {
            const firstInput = this.elements.questionsContainer.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        }, 300);
        
        // Update navigation
        this.updateNavigation();
    }

    renderQuestion(step) {
        const value = this.formData[step.id] || '';
        
        let inputHtml = '';
        switch (step.type) {
            case 'text':
            case 'email':
            case 'tel':
            case 'number':
            case 'date':
                inputHtml = `
                    <input 
                        type="${step.type}" 
                        id="${step.id}"
                        name="${step.id}"
                        value="${value}"
                        placeholder="${step.placeholder || ''}"
                        ${step.required ? 'required' : ''}
                        class="tf-input"
                        autocomplete="${step.autocomplete || 'off'}"
                    />
                `;
                break;
                
            case 'textarea':
                inputHtml = `
                    <textarea 
                        id="${step.id}"
                        name="${step.id}"
                        placeholder="${step.placeholder || ''}"
                        ${step.required ? 'required' : ''}
                        class="tf-textarea"
                        rows="${step.rows || 4}"
                    >${value}</textarea>
                `;
                break;
                
            case 'select':
            case 'radio':
                inputHtml = `
                    <div class="tf-options">
                        ${step.options.map((option, index) => {
                            const optionId = `${step.id}-${index}`;
                            const isChecked = value === option.value ? 'checked' : '';
                            return `
                                <label class="tf-option" for="${optionId}">
                                    <input 
                                        type="radio" 
                                        id="${optionId}"
                                        name="${step.id}"
                                        value="${option.value}"
                                        ${isChecked}
                                        class="tf-radio"
                                    />
                                    <div class="tf-option-content">
                                        <span class="tf-option-label">${option.label}</span>
                                        ${option.description ? `<span class="tf-option-description">${option.description}</span>` : ''}
                                    </div>
                                    <span class="tf-option-key">${String.fromCharCode(65 + index)}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                `;
                break;
                
            case 'checkbox':
                const checkedValues = Array.isArray(value) ? value : [];
                inputHtml = `
                    <div class="tf-options">
                        ${step.options.map((option, index) => {
                            const optionId = `${step.id}-${index}`;
                            const isChecked = checkedValues.includes(option.value) ? 'checked' : '';
                            return `
                                <label class="tf-option" for="${optionId}">
                                    <input 
                                        type="checkbox" 
                                        id="${optionId}"
                                        name="${step.id}"
                                        value="${option.value}"
                                        ${isChecked}
                                        class="tf-checkbox"
                                    />
                                    <div class="tf-option-content">
                                        <span class="tf-option-label">${option.label}</span>
                                        ${option.description ? `<span class="tf-option-description">${option.description}</span>` : ''}
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>
                `;
                break;
                
            case 'statement':
                inputHtml = `
                    <div class="tf-statement">
                        ${step.content || ''}
                    </div>
                `;
                break;
                
            case 'group':
                inputHtml = `
                    <div class="tf-group">
                        ${step.fields.map(field => this.renderQuestion(field)).join('')}
                    </div>
                `;
                break;
        }
        
        return `
            <div class="tf-question" data-step="${step.id}">
                <div class="tf-question-content">
                    ${step.question ? `<h2 class="tf-question-title">${this.interpolate(step.question)}</h2>` : ''}
                    ${step.description ? `<p class="tf-question-description">${this.interpolate(step.description)}</p>` : ''}
                    <div class="tf-input-wrapper">
                        ${inputHtml}
                    </div>
                    ${step.hint ? `<p class="tf-hint">${step.hint}</p>` : ''}
                </div>
            </div>
        `;
    }

    interpolate(text) {
        // Replace {{field}} with actual values
        return text.replace(/\{\{(\w+)\}\}/g, (match, field) => {
            return this.formData[field] || '';
        });
    }

    animateTransition(newContent) {
        const current = this.elements.questionsContainer.querySelector('.tf-question');
        
        if (current) {
            current.style.opacity = '0';
            current.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                this.elements.questionsContainer.innerHTML = newContent;
                const newQuestion = this.elements.questionsContainer.querySelector('.tf-question');
                if (newQuestion) {
                    newQuestion.style.opacity = '0';
                    newQuestion.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        newQuestion.style.opacity = '1';
                        newQuestion.style.transform = 'translateY(0)';
                    }, 50);
                }
            }, 200);
        } else {
            this.elements.questionsContainer.innerHTML = newContent;
            const newQuestion = this.elements.questionsContainer.querySelector('.tf-question');
            if (newQuestion) {
                setTimeout(() => {
                    newQuestion.style.opacity = '1';
                    newQuestion.style.transform = 'translateY(0)';
                }, 50);
            }
        }
    }

    next() {
        if (!this.validateCurrentStep()) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        this.saveCurrentStep();
        
        // Find next valid step
        let nextStep = this.currentStep + 1;
        while (nextStep < this.steps.length) {
            const step = this.steps[nextStep];
            if (!step.condition || this.evaluateCondition(step.condition)) {
                break;
            }
            nextStep++;
        }
        
        if (nextStep >= this.steps.length) {
            this.submit();
        } else {
            this.history.push(this.currentStep);
            this.currentStep = nextStep;
            this.renderStep(this.currentStep);
        }
    }

    previous() {
        if (this.history.length > 0) {
            this.saveCurrentStep();
            this.currentStep = this.history.pop();
            this.renderStep(this.currentStep);
        }
    }

    validateCurrentStep() {
        const step = this.steps[this.currentStep];
        if (!step || step.type === 'statement') return true;
        
        const inputs = this.elements.questionsContainer.querySelectorAll('input, textarea, select');
        let isValid = true;
        
        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                input.classList.add('tf-error');
                isValid = false;
            } else {
                input.classList.remove('tf-error');
            }
            
            // Custom validation
            const validator = this.validators[step.id];
            if (validator && validator.pattern) {
                const regex = new RegExp(validator.pattern);
                if (!regex.test(input.value)) {
                    input.classList.add('tf-error');
                    isValid = false;
                }
            }
        });
        
        return isValid;
    }

    saveCurrentStep() {
        const step = this.steps[this.currentStep];
        if (!step || step.type === 'statement') return;
        
        const inputs = this.elements.questionsContainer.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                if (!this.formData[input.name]) {
                    this.formData[input.name] = [];
                }
                if (input.checked && !this.formData[input.name].includes(input.value)) {
                    this.formData[input.name].push(input.value);
                } else if (!input.checked) {
                    this.formData[input.name] = this.formData[input.name].filter(v => v !== input.value);
                }
            } else if (input.type === 'radio') {
                if (input.checked) {
                    this.formData[input.name] = input.value;
                }
            } else {
                this.formData[input.name] = input.value;
            }
        });
        
        if (this.config.autosave) {
            this.saveProgress();
        }
    }

    evaluateCondition(condition) {
        if (typeof condition === 'function') {
            return condition(this.formData);
        }
        
        if (condition.field && condition.value) {
            const fieldValue = this.formData[condition.field];
            
            switch (condition.operator || '=') {
                case '=':
                case '==':
                    return fieldValue == condition.value;
                case '!=':
                    return fieldValue != condition.value;
                case '>':
                    return parseFloat(fieldValue) > parseFloat(condition.value);
                case '<':
                    return parseFloat(fieldValue) < parseFloat(condition.value);
                case 'includes':
                    return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
                case 'exists':
                    return fieldValue !== undefined && fieldValue !== '';
                default:
                    return true;
            }
        }
        
        return true;
    }

    updateProgress() {
        if (!this.config.progress) return;
        
        const visibleSteps = this.steps.filter(s => 
            !s.condition || this.evaluateCondition(s.condition)
        ).length;
        
        const progress = ((this.currentStep + 1) / visibleSteps) * 100;
        this.elements.progressBar.style.width = `${progress}%`;
    }

    updateStepIndicator() {
        const visibleSteps = this.steps.filter(s => 
            !s.condition || this.evaluateCondition(s.condition)
        ).length;
        
        this.elements.stepIndicator.textContent = `${this.currentStep + 1} of ${visibleSteps}`;
    }

    updateNavigation() {
        // Show/hide back button
        this.elements.backBtn.style.display = this.history.length > 0 ? 'flex' : 'none';
        
        // Update continue button
        const isLastStep = this.currentStep >= this.steps.length - 1;
        this.elements.continueBtn.querySelector('.tf-btn-text').textContent = 
            isLastStep ? 'Submit' : 'Continue';
        
        // Handle statement type
        const currentStep = this.steps[this.currentStep];
        if (currentStep && currentStep.type === 'statement') {
            this.elements.continueBtn.querySelector('.tf-btn-text').textContent = 
                currentStep.buttonText || 'Continue';
        }
    }

    handleQuickContinue(input) {
        const step = this.steps[this.currentStep];
        if (step && step.quickContinue !== false && input.type === 'radio') {
            setTimeout(() => this.next(), 300);
        }
    }

    navigateOptions(direction) {
        const options = Array.from(
            this.elements.questionsContainer.querySelectorAll('.tf-option input')
        );
        const currentIndex = options.findIndex(opt => opt === document.activeElement);
        
        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = options.length - 1;
        if (nextIndex >= options.length) nextIndex = 0;
        
        if (options[nextIndex]) {
            options[nextIndex].focus();
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'tf-error-message';
        errorDiv.textContent = message;
        
        this.elements.questionsContainer.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    saveProgress() {
        if (!this.config.autosave) return;
        
        const saveData = {
            currentStep: this.currentStep,
            formData: this.formData,
            history: this.history,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(`typeform-${this.config.formId || 'default'}`, JSON.stringify(saveData));
    }

    loadAutosave() {
        if (!this.config.autosave) return;
        
        const saved = localStorage.getItem(`typeform-${this.config.formId || 'default'}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Check if saved data is recent (within 24 hours)
                const savedTime = new Date(data.timestamp);
                const now = new Date();
                const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    this.formData = data.formData || {};
                    this.history = data.history || [];
                    
                    // Ask user if they want to continue
                    if (data.currentStep > 0) {
                        this.showContinuePrompt(data.currentStep);
                    }
                }
            } catch (e) {
                console.error('Failed to load autosave:', e);
            }
        }
    }

    showContinuePrompt(savedStep) {
        const prompt = document.createElement('div');
        prompt.className = 'tf-continue-prompt';
        prompt.innerHTML = `
            <div class="tf-prompt-content">
                <h3>Welcome back!</h3>
                <p>Would you like to continue where you left off?</p>
                <div class="tf-prompt-buttons">
                    <button class="tf-prompt-btn tf-prompt-continue">Continue</button>
                    <button class="tf-prompt-btn tf-prompt-restart">Start Over</button>
                </div>
            </div>
        `;
        
        this.container.appendChild(prompt);
        
        prompt.querySelector('.tf-prompt-continue').addEventListener('click', () => {
            this.currentStep = savedStep;
            this.renderStep(this.currentStep);
            prompt.remove();
        });
        
        prompt.querySelector('.tf-prompt-restart').addEventListener('click', () => {
            this.reset();
            this.renderStep(0);
            prompt.remove();
        });
    }

    reset() {
        this.currentStep = 0;
        this.formData = {};
        this.history = [];
        localStorage.removeItem(`typeform-${this.config.formId || 'default'}`);
    }

    async submit() {
        this.saveCurrentStep();
        
        // Show loading state
        this.showLoading();
        
        try {
            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.formData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showSuccess(result.message || 'Form submitted successfully!');
                this.reset();
                
                if (this.config.onSuccess) {
                    this.config.onSuccess(result);
                }
            } else {
                throw new Error(result.error || 'Submission failed');
            }
        } catch (error) {
            this.showError(error.message || 'An error occurred. Please try again.');
            
            if (this.config.onError) {
                this.config.onError(error);
            }
        }
    }

    showLoading() {
        this.elements.questionsContainer.innerHTML = `
            <div class="tf-loading">
                <div class="tf-spinner"></div>
                <p>Submitting your information...</p>
            </div>
        `;
    }

    showSuccess(message) {
        this.elements.questionsContainer.innerHTML = `
            <div class="tf-success">
                <svg class="tf-success-icon" width="72" height="72" viewBox="0 0 72 72" fill="none">
                    <circle cx="36" cy="36" r="35" stroke="#28a745" stroke-width="2"/>
                    <path d="M20 36L30 46L52 24" stroke="#28a745" stroke-width="3" stroke-linecap="round"/>
                </svg>
                <h2>Thank You!</h2>
                <p>${message}</p>
                ${this.config.successActions ? `
                    <div class="tf-success-actions">
                        ${this.config.successActions}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.elements.footer.style.display = 'none';
    }

    start() {
        if (this.steps.length > 0) {
            this.renderStep(0);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypeformEngine;
}