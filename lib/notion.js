/**
 * Notion API configuration
 */
export const NOTION_CONFIG = {
  apiVersion: '2022-06-28',
  baseUrl: 'https://api.notion.com/v1'
};

/**
 * Create headers for Notion API requests
 * @returns {Object} Headers object
 */
export function getNotionHeaders() {
  if (!process.env.NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY environment variable is required');
  }
  
  return {
    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_CONFIG.apiVersion
  };
}

/**
 * Create a Notion page with error handling
 * @param {string} databaseId - The Notion database ID
 * @param {Object} properties - The page properties
 * @returns {Promise<Object>} Created page data
 */
export async function createNotionPage(databaseId, properties) {
  try {
    const response = await fetch(`${NOTION_CONFIG.baseUrl}/pages`, {
      method: 'POST',
      headers: getNotionHeaders(),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: properties
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating Notion page:', error);
    throw error;
  }
}

/**
 * Convert a value to Notion property format
 * @param {any} value - The value to convert
 * @param {string} type - The property type
 * @returns {Object} Notion property object
 */
export function toNotionProperty(value, type) {
  if (value === null || value === undefined) {
    return null;
  }
  
  switch (type) {
    case 'title':
      return {
        title: [{
          text: { content: String(value) }
        }]
      };
      
    case 'rich_text':
      return {
        rich_text: [{
          text: { content: String(value) }
        }]
      };
      
    case 'number':
      return {
        number: Number(value)
      };
      
    case 'checkbox':
      return {
        checkbox: Boolean(value)
      };
      
    case 'select':
      return {
        select: { name: String(value) }
      };
      
    case 'date':
      return {
        date: { start: value }
      };
      
    case 'email':
      return {
        email: String(value)
      };
      
    case 'phone_number':
      return {
        phone_number: String(value)
      };
      
    default:
      return {
        rich_text: [{
          text: { content: String(value) }
        }]
      };
  }
}