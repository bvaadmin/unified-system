import { withPooledConnection } from '../../lib/db.js';
import { applyCors } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Apply CORS
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { month, year } = req.query;
  const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
  const targetYear = year ? parseInt(year) : new Date().getFullYear();

  try {
    const result = await withPooledConnection(async (pgClient) => {
      // Get all approved services for the month
      const servicesQuery = `
        SELECT 
          sa.id,
          sa.service_date,
          sa.service_time,
          sa.application_type,
          sa.contact_name,
          wd.couple_names,
          md.deceased_name,
          bd.baptism_candidate_name,
          gd.event_type
        FROM crouse_chapel.service_applications sa
        LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
        LEFT JOIN crouse_chapel.memorial_details md ON sa.id = md.application_id  
        LEFT JOIN crouse_chapel.baptism_details bd ON sa.id = bd.application_id
        LEFT JOIN crouse_chapel.general_use_details gd ON sa.id = gd.application_id
        WHERE EXTRACT(MONTH FROM sa.service_date) = $1 
        AND EXTRACT(YEAR FROM sa.service_date) = $2
        AND sa.status = 'approved'
        ORDER BY sa.service_date, sa.service_time
      `;
      
      const servicesResult = await pgClient.query(servicesQuery, [targetMonth, targetYear]);
      
      // Get blackout dates for the month
      const blackoutQuery = `
        SELECT date, reason
        FROM crouse_chapel.blackout_dates
        WHERE EXTRACT(MONTH FROM date) = $1 
        AND EXTRACT(YEAR FROM date) = $2
        ORDER BY date
      `;
      
      const blackoutResult = await pgClient.query(blackoutQuery, [targetMonth, targetYear]);
      
      // Format events for calendar display
      const events = servicesResult.rows.map(service => {
        let title = service.contact_name;
        
        if (service.application_type === 'wedding' && service.couple_names) {
          title = `Wedding: ${service.couple_names}`;
        } else if (service.application_type === 'memorial' && service.deceased_name) {
          title = `Memorial: ${service.deceased_name}`;
        } else if (service.application_type === 'baptism' && service.baptism_candidate_name) {
          title = `Baptism: ${service.baptism_candidate_name}`;
        } else if (service.application_type === 'general_use' && service.event_type) {
          title = `${service.event_type}: ${service.contact_name}`;
        }
        
        return {
          id: service.id,
          title,
          date: service.service_date,
          time: service.service_time,
          type: service.application_type
        };
      });
      
      return {
        month: targetMonth,
        year: targetYear,
        events,
        blackout_dates: blackoutResult.rows
      };
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Calendar error:', error);
    return res.status(500).json({ 
      error: 'Failed to get calendar data',
      message: error.message 
    });
  }
}
