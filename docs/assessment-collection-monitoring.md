# Assessment Collection Monitoring System
**Bay View Association - T-BACKLOG-003**

## Overview

This document outlines the comprehensive monitoring system for cottage assessment collection, designed for Bay View Association's 150-year-old Chautauqua community. The system provides real-time visibility into payment status, collection metrics, and automated alerts for the seasonal assessment cycle.

## Business Requirements

### Assessment Collection Context
- **Annual Assessment Cycle**: Cottage assessments issued each spring (March-April)
- **Payment Deadline**: Typically July 1st for current year assessments
- **Cottage-based Billing**: Each cottage receives individual assessment
- **Leaseholder Responsibility**: Current leaseholder responsible for payment
- **Historical Tracking**: Multi-year payment history and trends

### Key Performance Indicators
- **Collection Rate**: Percentage of assessments paid by deadline
- **Outstanding Balance**: Total amount of unpaid assessments
- **Payment Velocity**: Rate of payments over time
- **Delinquency Rate**: Percentage of cottages with overdue payments
- **Cash Flow Projections**: Predicted collection timeline

## Technical Architecture

### Database Schema Enhancement

```sql
-- Assessment monitoring views and functions
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Real-time assessment collection status
CREATE VIEW monitoring.assessment_collection_status AS
SELECT 
    a.assessment_year,
    COUNT(*) as total_assessments,
    COUNT(*) FILTER (WHERE a.payment_status = 'paid') as paid_count,
    COUNT(*) FILTER (WHERE a.payment_status = 'partial') as partial_count,
    COUNT(*) FILTER (WHERE a.payment_status = 'unpaid') as unpaid_count,
    COUNT(*) FILTER (WHERE a.due_date < CURRENT_DATE AND a.payment_status != 'paid') as overdue_count,
    SUM(a.assessment_amount) as total_assessed,
    SUM(CASE WHEN a.payment_status = 'paid' THEN a.assessment_amount ELSE 0 END) as total_collected,
    SUM(CASE WHEN a.payment_status != 'paid' THEN a.assessment_amount ELSE 0 END) as total_outstanding,
    ROUND(
        (COUNT(*) FILTER (WHERE a.payment_status = 'paid') * 100.0 / COUNT(*)), 2
    ) as collection_rate_percent,
    ROUND(
        (SUM(CASE WHEN a.payment_status = 'paid' THEN a.assessment_amount ELSE 0 END) * 100.0 / SUM(a.assessment_amount)), 2
    ) as collection_amount_percent
FROM finance.cottage_assessments a
GROUP BY a.assessment_year
ORDER BY a.assessment_year DESC;

-- Cottage-level payment tracking
CREATE VIEW monitoring.cottage_payment_status AS
SELECT 
    p.cottage_id,
    p.block,
    p.lot,
    p.current_leaseholder_id,
    pe.first_name || ' ' || pe.last_name as leaseholder_name,
    pe.email as leaseholder_email,
    pe.phone as leaseholder_phone,
    a.assessment_year,
    a.assessment_amount,
    a.due_date,
    a.payment_status,
    a.payment_date,
    a.payment_amount,
    CASE 
        WHEN a.due_date < CURRENT_DATE AND a.payment_status != 'paid' THEN 'overdue'
        WHEN a.due_date - INTERVAL '30 days' < CURRENT_DATE AND a.payment_status != 'paid' THEN 'due_soon'
        WHEN a.payment_status = 'paid' THEN 'current'
        ELSE 'normal'
    END as status_category,
    CURRENT_DATE - a.due_date as days_overdue
FROM property.locations p
JOIN finance.cottage_assessments a ON p.cottage_id = a.cottage_id
LEFT JOIN core.persons pe ON p.current_leaseholder_id = pe.id
WHERE a.assessment_year = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY p.cottage_id;

-- Payment velocity tracking
CREATE VIEW monitoring.payment_velocity AS
SELECT 
    a.assessment_year,
    DATE_TRUNC('week', t.transaction_date) as payment_week,
    COUNT(*) as payments_count,
    SUM(t.amount) as payments_amount,
    SUM(COUNT(*)) OVER (
        PARTITION BY a.assessment_year 
        ORDER BY DATE_TRUNC('week', t.transaction_date)
    ) as cumulative_payments,
    SUM(SUM(t.amount)) OVER (
        PARTITION BY a.assessment_year 
        ORDER BY DATE_TRUNC('week', t.transaction_date)
    ) as cumulative_amount
FROM finance.cottage_assessments a
JOIN finance.transactions t ON a.id = t.assessment_id
WHERE t.transaction_type = 'payment'
GROUP BY a.assessment_year, DATE_TRUNC('week', t.transaction_date)
ORDER BY a.assessment_year DESC, payment_week;

-- Historical collection trends
CREATE VIEW monitoring.collection_trends AS
SELECT 
    assessment_year,
    collection_rate_percent,
    collection_amount_percent,
    total_outstanding,
    LAG(collection_rate_percent) OVER (ORDER BY assessment_year) as prev_year_rate,
    collection_rate_percent - LAG(collection_rate_percent) OVER (ORDER BY assessment_year) as rate_change
FROM monitoring.assessment_collection_status
ORDER BY assessment_year DESC;

-- Alert conditions table
CREATE TABLE monitoring.alert_conditions (
    id SERIAL PRIMARY KEY,
    condition_name VARCHAR(100) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- collection_rate, overdue_count, payment_velocity
    threshold_value DECIMAL(10,2) NOT NULL,
    comparison_operator VARCHAR(10) NOT NULL, -- <, >, =, <=, >=
    alert_level VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
    enabled BOOLEAN DEFAULT true,
    notification_recipients TEXT[], -- Array of email addresses
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alert history log
CREATE TABLE monitoring.alert_history (
    id SERIAL PRIMARY KEY,
    condition_id INTEGER REFERENCES monitoring.alert_conditions(id),
    alert_triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    alert_level VARCHAR(20),
    alert_message TEXT,
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by INTEGER REFERENCES core.persons(id),
    resolution_notes TEXT
);
```

### Monitoring Functions

```sql
-- Function to check alert conditions
CREATE OR REPLACE FUNCTION monitoring.check_alert_conditions()
RETURNS TABLE(
    condition_name VARCHAR(100),
    alert_level VARCHAR(20),
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    alert_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH current_metrics AS (
        SELECT 
            'collection_rate' as metric_name,
            collection_rate_percent as metric_value
        FROM monitoring.assessment_collection_status 
        WHERE assessment_year = EXTRACT(YEAR FROM CURRENT_DATE)
        
        UNION ALL
        
        SELECT 
            'overdue_count' as metric_name,
            overdue_count::DECIMAL as metric_value
        FROM monitoring.assessment_collection_status 
        WHERE assessment_year = EXTRACT(YEAR FROM CURRENT_DATE)
        
        UNION ALL
        
        SELECT 
            'outstanding_amount' as metric_name,
            total_outstanding as metric_value
        FROM monitoring.assessment_collection_status 
        WHERE assessment_year = EXTRACT(YEAR FROM CURRENT_DATE)
    )
    SELECT 
        ac.condition_name,
        ac.alert_level,
        cm.metric_value,
        ac.threshold_value,
        CASE 
            WHEN ac.comparison_operator = '<' AND cm.metric_value < ac.threshold_value THEN
                ac.condition_name || ' is below threshold: ' || cm.metric_value || ' < ' || ac.threshold_value
            WHEN ac.comparison_operator = '>' AND cm.metric_value > ac.threshold_value THEN
                ac.condition_name || ' is above threshold: ' || cm.metric_value || ' > ' || ac.threshold_value
            WHEN ac.comparison_operator = '<=' AND cm.metric_value <= ac.threshold_value THEN
                ac.condition_name || ' is at or below threshold: ' || cm.metric_value || ' <= ' || ac.threshold_value
            WHEN ac.comparison_operator = '>=' AND cm.metric_value >= ac.threshold_value THEN
                ac.condition_name || ' is at or above threshold: ' || cm.metric_value || ' >= ' || ac.threshold_value
            ELSE NULL
        END as alert_message
    FROM monitoring.alert_conditions ac
    JOIN current_metrics cm ON ac.condition_type = cm.metric_name
    WHERE ac.enabled = true
    AND (
        (ac.comparison_operator = '<' AND cm.metric_value < ac.threshold_value) OR
        (ac.comparison_operator = '>' AND cm.metric_value > ac.threshold_value) OR
        (ac.comparison_operator = '<=' AND cm.metric_value <= ac.threshold_value) OR
        (ac.comparison_operator = '>=' AND cm.metric_value >= ac.threshold_value) OR
        (ac.comparison_operator = '=' AND cm.metric_value = ac.threshold_value)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to generate collection report
CREATE OR REPLACE FUNCTION monitoring.generate_collection_report(target_year INTEGER DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    report_year INTEGER;
    result JSON;
BEGIN
    report_year := COALESCE(target_year, EXTRACT(YEAR FROM CURRENT_DATE));
    
    SELECT json_build_object(
        'report_year', report_year,
        'report_generated_at', CURRENT_TIMESTAMP,
        'summary', (
            SELECT json_build_object(
                'total_assessments', total_assessments,
                'total_assessed_amount', total_assessed,
                'total_collected_amount', total_collected,
                'total_outstanding_amount', total_outstanding,
                'collection_rate_percent', collection_rate_percent,
                'collection_amount_percent', collection_amount_percent,
                'paid_count', paid_count,
                'partial_count', partial_count,
                'unpaid_count', unpaid_count,
                'overdue_count', overdue_count
            )
            FROM monitoring.assessment_collection_status
            WHERE assessment_year = report_year
        ),
        'status_breakdown', (
            SELECT json_agg(
                json_build_object(
                    'status_category', status_category,
                    'cottage_count', cottage_count,
                    'total_amount', total_amount
                )
            )
            FROM (
                SELECT 
                    status_category,
                    COUNT(*) as cottage_count,
                    SUM(assessment_amount) as total_amount
                FROM monitoring.cottage_payment_status
                WHERE assessment_year = report_year
                GROUP BY status_category
            ) breakdown
        ),
        'overdue_cottages', (
            SELECT json_agg(
                json_build_object(
                    'cottage_id', cottage_id,
                    'leaseholder_name', leaseholder_name,
                    'assessment_amount', assessment_amount,
                    'days_overdue', days_overdue,
                    'contact_email', leaseholder_email
                )
            )
            FROM monitoring.cottage_payment_status
            WHERE assessment_year = report_year
            AND status_category = 'overdue'
            ORDER BY days_overdue DESC
        ),
        'active_alerts', (
            SELECT json_agg(
                json_build_object(
                    'condition_name', condition_name,
                    'alert_level', alert_level,
                    'current_value', current_value,
                    'threshold_value', threshold_value,
                    'alert_message', alert_message
                )
            )
            FROM monitoring.check_alert_conditions()
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
```

## API Endpoints

### Dashboard Data Endpoints

```javascript
// GET /api/monitoring/assessment-status
// Returns current year assessment collection status
export async function getAssessmentStatus(req, res) {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();
  
  try {
    const result = await withPooledConnection(async (pgClient) => {
      const statusQuery = `
        SELECT * FROM monitoring.assessment_collection_status
        WHERE assessment_year = $1
      `;
      
      const statusResult = await pgClient.query(statusQuery, [targetYear]);
      
      if (statusResult.rows.length === 0) {
        return {
          year: targetYear,
          status: 'no_data',
          message: `No assessment data found for ${targetYear}`
        };
      }
      
      const status = statusResult.rows[0];
      
      // Get payment velocity data
      const velocityQuery = `
        SELECT payment_week, payments_count, payments_amount, 
               cumulative_payments, cumulative_amount
        FROM monitoring.payment_velocity
        WHERE assessment_year = $1
        ORDER BY payment_week
      `;
      
      const velocityResult = await pgClient.query(velocityQuery, [targetYear]);
      
      return {
        year: targetYear,
        summary: {
          total_assessments: parseInt(status.total_assessments),
          collection_rate: parseFloat(status.collection_rate_percent),
          amount_collected: parseFloat(status.total_collected),
          amount_outstanding: parseFloat(status.total_outstanding),
          overdue_count: parseInt(status.overdue_count)
        },
        payment_velocity: velocityResult.rows,
        last_updated: new Date().toISOString()
      };
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Assessment status error:', error);
    res.status(500).json({ error: 'Failed to get assessment status' });
  }
}

// GET /api/monitoring/cottage-status
// Returns cottage-level payment status
export async function getCottageStatus(req, res) {
  const { year, status, cottage_id } = req.query;
  const targetYear = year || new Date().getFullYear();
  
  try {
    const result = await withPooledConnection(async (pgClient) => {
      let whereConditions = ['assessment_year = $1'];
      let queryParams = [targetYear];
      
      if (status) {
        whereConditions.push('status_category = $' + (queryParams.length + 1));
        queryParams.push(status);
      }
      
      if (cottage_id) {
        whereConditions.push('cottage_id = $' + (queryParams.length + 1));
        queryParams.push(cottage_id);
      }
      
      const cottageQuery = `
        SELECT cottage_id, block, lot, leaseholder_name, leaseholder_email,
               assessment_amount, due_date, payment_status, payment_date,
               status_category, days_overdue
        FROM monitoring.cottage_payment_status
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY cottage_id
      `;
      
      const cottageResult = await pgClient.query(cottageQuery, queryParams);
      
      return {
        year: targetYear,
        cottages: cottageResult.rows,
        filters_applied: { status, cottage_id },
        total_count: cottageResult.rows.length
      };
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Cottage status error:', error);
    res.status(500).json({ error: 'Failed to get cottage status' });
  }
}

// GET /api/monitoring/alerts
// Returns active alerts and alert history
export async function getAlerts(req, res) {
  const { include_history, limit } = req.query;
  
  try {
    const result = await withPooledConnection(async (pgClient) => {
      // Get active alerts
      const activeAlerts = await pgClient.query(
        'SELECT * FROM monitoring.check_alert_conditions()'
      );
      
      let alertHistory = [];
      if (include_history === 'true') {
        const historyQuery = `
          SELECT ah.*, ac.condition_name, pe.first_name || ' ' || pe.last_name as acknowledged_by_name
          FROM monitoring.alert_history ah
          JOIN monitoring.alert_conditions ac ON ah.condition_id = ac.id
          LEFT JOIN core.persons pe ON ah.acknowledged_by = pe.id
          ORDER BY ah.alert_triggered_at DESC
          ${limit ? 'LIMIT $1' : ''}
        `;
        
        const historyParams = limit ? [parseInt(limit)] : [];
        const historyResult = await pgClient.query(historyQuery, historyParams);
        alertHistory = historyResult.rows;
      }
      
      return {
        active_alerts: activeAlerts.rows,
        alert_history: alertHistory,
        alert_count: activeAlerts.rows.length,
        critical_count: activeAlerts.rows.filter(a => a.alert_level === 'critical').length
      };
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
}

// POST /api/monitoring/generate-report
// Generates comprehensive collection report
export async function generateReport(req, res) {
  const { year, format } = req.body;
  const targetYear = year || new Date().getFullYear();
  
  try {
    const result = await withPooledConnection(async (pgClient) => {
      const reportQuery = 'SELECT monitoring.generate_collection_report($1) as report';
      const reportResult = await pgClient.query(reportQuery, [targetYear]);
      
      const report = reportResult.rows[0].report;
      
      if (format === 'csv') {
        // Convert to CSV format for download
        const csvData = convertReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="assessment-report-${targetYear}.csv"`);
        return res.send(csvData);
      }
      
      return res.status(200).json({
        report,
        generated_at: new Date().toISOString(),
        format: 'json'
      });
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}
```

### Alert Management Endpoints

```javascript
// POST /api/monitoring/alerts/configure
// Configure alert conditions
export async function configureAlert(req, res) {
  const { condition_name, condition_type, threshold_value, comparison_operator, alert_level, recipients } = req.body;
  
  try {
    const result = await withPooledConnection(async (pgClient) => {
      const insertQuery = `
        INSERT INTO monitoring.alert_conditions 
        (condition_name, condition_type, threshold_value, comparison_operator, alert_level, notification_recipients)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const insertResult = await pgClient.query(insertQuery, [
        condition_name, condition_type, threshold_value, 
        comparison_operator, alert_level, recipients
      ]);
      
      return insertResult.rows[0];
    });
    
    res.status(201).json({
      success: true,
      alert_condition: result,
      message: 'Alert condition configured successfully'
    });
  } catch (error) {
    console.error('Alert configuration error:', error);
    res.status(500).json({ error: 'Failed to configure alert' });
  }
}

// POST /api/monitoring/alerts/:id/acknowledge
// Acknowledge an alert
export async function acknowledgeAlert(req, res) {
  const { id } = req.params;
  const { acknowledged_by, resolution_notes } = req.body;
  
  try {
    const result = await withPooledConnection(async (pgClient) => {
      const updateQuery = `
        UPDATE monitoring.alert_history
        SET acknowledged_at = CURRENT_TIMESTAMP,
            acknowledged_by = $1,
            resolution_notes = $2
        WHERE id = $3
        RETURNING *
      `;
      
      const updateResult = await pgClient.query(updateQuery, [acknowledged_by, resolution_notes, id]);
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      
      return updateResult.rows[0];
    });
    
    res.status(200).json({
      success: true,
      alert: result,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Alert acknowledgment error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
}
```

## Dashboard Components

### Real-time Metrics Dashboard

```javascript
// React component for assessment monitoring dashboard
import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AssessmentMonitoringDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchAlerts();
    
    // Set up real-time updates every 5 minutes
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchAlerts();
    }, 300000);
    
    return () => clearInterval(interval);
  }, [selectedYear]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/monitoring/assessment-status?year=${selectedYear}`);
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/monitoring/alerts');
      const data = await response.json();
      setAlerts(data.active_alerts || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading assessment data...</div>;
  }

  return (
    <div className="assessment-monitoring-dashboard">
      <header className="dashboard-header">
        <h1>Assessment Collection Monitoring</h1>
        <div className="year-selector">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="alert-banner">
          <h3>Active Alerts ({alerts.length})</h3>
          {alerts.map((alert, index) => (
            <div key={index} className={`alert alert-${alert.alert_level}`}>
              <strong>{alert.condition_name}:</strong> {alert.alert_message}
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Collection Rate</h3>
          <div className="metric-value">
            {dashboardData?.summary?.collection_rate?.toFixed(1)}%
          </div>
          <div className="metric-subtitle">
            {dashboardData?.summary?.total_assessments} total assessments
          </div>
        </div>
        
        <div className="metric-card">
          <h3>Amount Collected</h3>
          <div className="metric-value">
            ${dashboardData?.summary?.amount_collected?.toLocaleString()}
          </div>
          <div className="metric-subtitle">
            Outstanding: ${dashboardData?.summary?.amount_outstanding?.toLocaleString()}
          </div>
        </div>
        
        <div className="metric-card">
          <h3>Overdue Cottages</h3>
          <div className="metric-value overdue">
            {dashboardData?.summary?.overdue_count}
          </div>
          <div className="metric-subtitle">
            Require immediate attention
          </div>
        </div>
        
        <div className="metric-card">
          <h3>Last Updated</h3>
          <div className="metric-value small">
            {new Date(dashboardData?.last_updated).toLocaleTimeString()}
          </div>
          <div className="metric-subtitle">
            {new Date(dashboardData?.last_updated).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Payment Velocity Chart */}
      <div className="chart-container">
        <h3>Payment Velocity - Cumulative Collections</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dashboardData?.payment_velocity || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="payment_week" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Line 
              yAxisId="left" 
              type="monotone" 
              dataKey="cumulative_payments" 
              stroke="#3498db" 
              name="Cottages Paid"
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="cumulative_amount" 
              stroke="#2ecc71" 
              name="Amount Collected ($)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="action-button"
          onClick={() => window.open(`/api/monitoring/generate-report?year=${selectedYear}&format=csv`)}
        >
          Download CSV Report
        </button>
        
        <button 
          className="action-button"
          onClick={() => window.open(`/cottage-status?year=${selectedYear}&status=overdue`)}
        >
          View Overdue Cottages
        </button>
        
        <button 
          className="action-button"
          onClick={fetchDashboardData}
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default AssessmentMonitoringDashboard;
```

## Automated Alert System

### Email Notification System

```javascript
// Alert notification service
import nodemailer from 'nodemailer';

class AlertNotificationService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  async checkAndSendAlerts() {
    try {
      const alerts = await this.getActiveAlerts();
      
      for (const alert of alerts) {
        await this.sendAlertNotification(alert);
        await this.logAlertHistory(alert);
      }
    } catch (error) {
      console.error('Alert notification error:', error);
    }
  }

  async getActiveAlerts() {
    return await withPooledConnection(async (pgClient) => {
      const alertsResult = await pgClient.query(
        'SELECT * FROM monitoring.check_alert_conditions()'
      );
      return alertsResult.rows;
    });
  }

  async sendAlertNotification(alert) {
    const recipients = await this.getAlertRecipients(alert.condition_name);
    
    const emailTemplate = this.buildAlertEmail(alert);
    
    for (const recipient of recipients) {
      await this.transporter.sendMail({
        from: 'alerts@bayviewassociation.org',
        to: recipient,
        subject: `Bay View Alert: ${alert.condition_name}`,
        html: emailTemplate,
        priority: alert.alert_level === 'critical' ? 'high' : 'normal'
      });
    }
  }

  buildAlertEmail(alert) {
    return `
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${this.getAlertColor(alert.alert_level)}; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: white; margin: 0;">⚠️ ${alert.alert_level.toUpperCase()} Alert</h2>
          </div>
          
          <h3>Assessment Collection Alert</h3>
          <p><strong>Condition:</strong> ${alert.condition_name}</p>
          <p><strong>Current Value:</strong> ${alert.current_value}</p>
          <p><strong>Threshold:</strong> ${alert.threshold_value}</p>
          <p><strong>Message:</strong> ${alert.alert_message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          
          <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
            <h4>Recommended Actions:</h4>
            <ul>
              <li>Review the Assessment Monitoring Dashboard</li>
              <li>Check cottage-level payment status</li>
              <li>Consider outreach to overdue accounts</li>
              <li>Acknowledge this alert once reviewed</li>
            </ul>
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
            <a href="${process.env.DASHBOARD_URL}/monitoring" 
               style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Dashboard
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAlertColor(level) {
    switch (level) {
      case 'critical': return '#e74c3c';
      case 'warning': return '#f39c12';
      case 'info': return '#3498db';
      default: return '#95a5a6';
    }
  }

  async getAlertRecipients(conditionName) {
    return await withPooledConnection(async (pgClient) => {
      const recipientsResult = await pgClient.query(
        'SELECT notification_recipients FROM monitoring.alert_conditions WHERE condition_name = $1',
        [conditionName]
      );
      
      return recipientsResult.rows[0]?.notification_recipients || [];
    });
  }

  async logAlertHistory(alert) {
    await withPooledConnection(async (pgClient) => {
      await pgClient.query(
        `INSERT INTO monitoring.alert_history 
         (condition_id, alert_level, alert_message, current_value, threshold_value)
         SELECT id, $1, $2, $3, $4
         FROM monitoring.alert_conditions 
         WHERE condition_name = $5`,
        [alert.alert_level, alert.alert_message, alert.current_value, alert.threshold_value, alert.condition_name]
      );
    });
  }
}

// Scheduled alert checking (run every hour)
export async function scheduledAlertCheck() {
  const alertService = new AlertNotificationService();
  await alertService.checkAndSendAlerts();
}
```

## Implementation Plan

### Phase 1: Core Monitoring (Week 1-2)
- Database schema setup and views
- Basic API endpoints for status retrieval
- Simple dashboard with key metrics
- Alert condition framework

### Phase 2: Dashboard Enhancement (Week 3)
- Interactive charts and visualizations
- Cottage-level status views
- Historical trend analysis
- CSV export functionality

### Phase 3: Alert System (Week 4)
- Email notification system
- Alert configuration interface
- Alert acknowledgment workflow
- Escalation procedures

### Phase 4: Advanced Features (Week 5-6)
- Predictive analytics
- Cash flow projections
- Integration with payment processing
- Mobile-responsive optimization

## Success Metrics

### Technical Metrics
- **Dashboard Load Time**: <2 seconds for all views
- **Data Accuracy**: 100% consistency with financial records
- **Alert Reliability**: <1 minute delay from threshold breach to notification
- **System Uptime**: 99.9% availability during business hours

### Business Impact
- **Collection Visibility**: Real-time status for all 800+ cottages
- **Response Time**: 50% faster response to collection issues
- **Cash Flow Predictability**: Accurate forecasting within 5%
- **Administrative Efficiency**: 75% reduction in manual status checking

---

*This monitoring system provides Bay View Association with comprehensive visibility into cottage assessment collection, enabling proactive management of the community's primary revenue stream while maintaining the traditions of the 150-year-old Chautauqua community.*
