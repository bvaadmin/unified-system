/**
 * Beta Testing Banner for Memorial Garden Form
 * This can be included on the main form to invite users to try the beta
 */

(function() {
    // Check if user has dismissed beta notice
    const betaDismissed = localStorage.getItem('memorialGardenBetaDismissed');
    const betaDismissDate = localStorage.getItem('memorialGardenBetaDismissDate');
    
    // Don't show if dismissed in last 7 days
    if (betaDismissed && betaDismissDate) {
        const daysSinceDismiss = (Date.now() - new Date(betaDismissDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismiss < 7) {
            return;
        }
    }
    
    // Create beta banner
    const banner = document.createElement('div');
    banner.id = 'betaBanner';
    banner.innerHTML = `
        <style>
            #betaBanner {
                position: fixed;
                bottom: 20px;
                right: 20px;
                max-width: 350px;
                background: white;
                border: 2px solid #ffa500;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                animation: slideIn 0.5s ease-out;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            #betaBanner h4 {
                margin: 0 0 10px 0;
                color: #2c5aa0;
                font-size: 1.1em;
            }
            
            #betaBanner p {
                margin: 0 0 15px 0;
                font-size: 0.95em;
                color: #666;
                line-height: 1.5;
            }
            
            #betaBanner .beta-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            #betaBanner .try-beta {
                background: #ffa500;
                color: white;
                padding: 8px 20px;
                border-radius: 5px;
                text-decoration: none;
                font-weight: 600;
                transition: background 0.3s ease;
            }
            
            #betaBanner .try-beta:hover {
                background: #ff8c00;
            }
            
            #betaBanner .dismiss {
                color: #999;
                cursor: pointer;
                text-decoration: none;
                font-size: 0.9em;
            }
            
            #betaBanner .dismiss:hover {
                color: #666;
            }
            
            #betaBanner .close {
                position: absolute;
                top: 10px;
                right: 10px;
                color: #999;
                cursor: pointer;
                font-size: 1.2em;
                line-height: 1;
                padding: 5px;
            }
            
            #betaBanner .close:hover {
                color: #666;
            }
            
            @media (max-width: 768px) {
                #betaBanner {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }
        </style>
        
        <span class="close" onclick="dismissBetaBanner(true)">&times;</span>
        <h4>🚀 Try Our New Form Experience</h4>
        <p>We're testing a simpler way to complete your Memorial Garden application. It adapts to your specific situation and saves your progress.</p>
        <div class="beta-actions">
            <a href="beta/" class="try-beta" onclick="trackBetaClick()">Try Beta Version</a>
            <a href="#" class="dismiss" onclick="dismissBetaBanner(false); return false;">Maybe later</a>
        </div>
    `;
    
    // Add to page after short delay
    setTimeout(() => {
        document.body.appendChild(banner);
    }, 3000);
})();

function dismissBetaBanner(permanent) {
    const banner = document.getElementById('betaBanner');
    if (banner) {
        banner.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => banner.remove(), 300);
    }
    
    if (permanent) {
        localStorage.setItem('memorialGardenBetaDismissed', 'true');
        localStorage.setItem('memorialGardenBetaDismissDate', new Date().toISOString());
    }
    
    // Track dismissal
    if (typeof gtag !== 'undefined') {
        gtag('event', 'beta_banner_dismissed', {
            'event_category': 'memorial_garden_beta',
            'permanent': permanent
        });
    }
}

function trackBetaClick() {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'beta_banner_clicked', {
            'event_category': 'memorial_garden_beta'
        });
    }
}

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);