const fs = require('fs').promises;
const path = require('path');

// Configuration
const PRODUCTION_API_BASE = 'https://bvaadmin.vercel.app';
const GITHUB_PAGES_URL = 'https://bvaadmin.github.io';

async function updateFormUrls() {
  console.log('Updating form URLs for production deployment...\n');
  
  const formsDir = path.join(__dirname, '..', 'forms');
  const chapelForms = [
    'chapel-wedding.html',
    'chapel-memorial.html',
    'chapel-baptism.html',
    'chapel-general-use.html'
  ];
  
  for (const formFile of chapelForms) {
    const filePath = path.join(formsDir, formFile);
    
    try {
      console.log(`Processing ${formFile}...`);
      let content = await fs.readFile(filePath, 'utf8');
      
      // Count replacements
      let replacements = 0;
      
      // Replace relative API URLs with production URLs
      content = content.replace(
        /fetch\(['"]\/api\/chapel\/submit-service['"]/g,
        (match) => {
          replacements++;
          return `fetch('${PRODUCTION_API_BASE}/api/chapel/submit-service'`;
        }
      );
      
      // Also update any other relative API calls
      content = content.replace(
        /fetch\(['"]\/api\//g,
        (match) => {
          replacements++;
          return `fetch('${PRODUCTION_API_BASE}/api/`;
        }
      );
      
      if (replacements > 0) {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`  ✅ Updated ${replacements} API URL(s)`);
      } else {
        console.log(`  ℹ️  No updates needed`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing ${formFile}:`, error.message);
    }
  }
  
  // Update memorial garden form if needed
  const memorialForm = path.join(formsDir, 'memorial-garden.html');
  try {
    console.log('\nProcessing memorial-garden.html...');
    let content = await fs.readFile(memorialForm, 'utf8');
    
    // Check if it's using the old API URL
    if (content.includes('bay-view-memorial-api.vercel.app')) {
      content = content.replace(
        /const API_URL = 'https:\/\/bay-view-memorial-api\.vercel\.app\/api\/submit-memorial-garden'/g,
        `const API_URL = '${PRODUCTION_API_BASE}/api/memorial/submit-garden'`
      );
      await fs.writeFile(memorialForm, content, 'utf8');
      console.log('  ✅ Updated to new unified API endpoint');
    } else {
      console.log('  ℹ️  Already using correct endpoint');
    }
  } catch (error) {
    console.error('  ❌ Error processing memorial-garden.html:', error.message);
  }
  
  // Update CORS configuration reminder
  console.log('\n📋 CORS Configuration Reminder:');
  console.log('Make sure these origins are allowed in your API CORS settings:');
  console.log(`  - ${GITHUB_PAGES_URL}`);
  console.log('  - https://bvaadmin.github.io');
  console.log('  - http://localhost:3000 (for local development)');
  console.log('  - http://127.0.0.1:5500 (for VS Code Live Server)');
  
  console.log('\n✨ Form URL update complete!');
}

// Add option to revert URLs for local development
async function revertToLocalUrls() {
  console.log('Reverting form URLs to local development...\n');
  
  const formsDir = path.join(__dirname, '..', 'forms');
  const chapelForms = [
    'chapel-wedding.html',
    'chapel-memorial.html',
    'chapel-baptism.html',
    'chapel-general-use.html'
  ];
  
  for (const formFile of chapelForms) {
    const filePath = path.join(formsDir, formFile);
    
    try {
      console.log(`Processing ${formFile}...`);
      let content = await fs.readFile(filePath, 'utf8');
      
      // Replace production URLs with relative URLs
      content = content.replace(
        new RegExp(`fetch\\(['"]${PRODUCTION_API_BASE}/api/`, 'g'),
        `fetch('/api/`
      );
      
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`  ✅ Reverted to local URLs`);
      
    } catch (error) {
      console.error(`  ❌ Error processing ${formFile}:`, error.message);
    }
  }
  
  console.log('\n✨ URLs reverted for local development!');
}

// Check command line arguments
const command = process.argv[2];

if (command === 'revert') {
  revertToLocalUrls();
} else {
  updateFormUrls();
}

// Export for use in other scripts
module.exports = { updateFormUrls, revertToLocalUrls };