const https = require('https');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, data: JSON.parse(data) });
        } else {
          resolve({ ok: false, status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function updateNotionDatabase() {
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const DATABASE_ID = process.env.CHAPEL_NOTION_DB_ID || '89b34717a72a4f8d8eb779d5cc6d9412';
  
  if (!NOTION_API_KEY) {
    console.error('ERROR: NOTION_API_KEY environment variable is required');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  // Define new properties to add
  const newProperties = {
    // Baptism-specific fields
    "Baptism Candidate Name": {
      "rich_text": {}
    },
    "Baptism Date": {
      "date": {}
    },
    "Parents Names": {
      "rich_text": {}
    },
    "Witnesses": {
      "rich_text": {}
    },
    "Baptism Type": {
      "select": {
        "options": [
          { "name": "Infant", "color": "blue" },
          { "name": "Adult", "color": "green" },
          { "name": "Dedication", "color": "purple" }
        ]
      }
    },
    // General Use fields
    "Event Type": {
      "rich_text": {}
    },
    "Organization Name": {
      "rich_text": {}
    },
    "Event Description": {
      "rich_text": {}
    },
    "Expected Attendance": {
      "number": {
        "format": "number"
      }
    },
    "Setup Time": {
      "rich_text": {}
    },
    "Cleanup Time": {
      "rich_text": {}
    },
    "Event Fee": {
      "number": {
        "format": "dollar"
      }
    },
    // Additional missing fields
    "Contact Address": {
      "rich_text": {}
    },
    "Music Musicians": {
      "rich_text": {}
    },
    "Chair Details": {
      "rich_text": {}
    }
  };

  try {
    console.log('Updating Notion database schema...');
    
    // First, get the current database to see existing properties
    const getOptions = {
      hostname: 'api.notion.com',
      path: `/v1/databases/${DATABASE_ID}`,
      method: 'GET',
      headers: headers
    };

    const getResponse = await makeRequest(getOptions);

    if (!getResponse.ok) {
      throw new Error(`Failed to get database: ${getResponse.data}`);
    }

    const currentDb = getResponse.data;
    console.log('Current database retrieved successfully');
    
    // Update the Type select to include all options
    const typeProperty = currentDb.properties.Type;
    if (typeProperty && typeProperty.select) {
      // Add missing options
      const existingOptions = typeProperty.select.options || [];
      const optionNames = existingOptions.map(opt => opt.name.toLowerCase());
      
      if (!optionNames.includes('baptism')) {
        existingOptions.push({ "name": "Baptism", "color": "blue" });
      }
      if (!optionNames.includes('general use')) {
        existingOptions.push({ "name": "General Use", "color": "yellow" });
      }
      
      newProperties["Type"] = {
        "select": {
          "options": existingOptions
        }
      };
    }

    // Update database with new properties
    const updateBody = {
      properties: newProperties
    };

    const updateOptions = {
      hostname: 'api.notion.com',
      path: `/v1/databases/${DATABASE_ID}`,
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(JSON.stringify(updateBody))
      }
    };

    const updateResponse = await makeRequest(updateOptions, updateBody);

    if (!updateResponse.ok) {
      throw new Error(`Failed to update database: ${updateResponse.data}`);
    }

    const result = updateResponse.data;
    console.log('Notion database schema updated successfully!');
    
    // List all properties
    console.log('\nDatabase properties:');
    Object.keys(result.properties).sort().forEach(prop => {
      const propInfo = result.properties[prop];
      console.log(`- ${prop} (${propInfo.type})`);
    });

  } catch (error) {
    console.error('Error updating Notion database:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateNotionDatabase();
}

module.exports = { updateNotionDatabase };