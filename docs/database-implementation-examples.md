# Bay View Database Implementation Examples

## Real-World Query Examples

### 1. Daily Operations Dashboard

```sql
-- Today's chapel services with all details
SELECT 
    sa.service_date,
    sa.service_time,
    sa.application_type,
    p.first_name || ' ' || p.last_name AS contact_name,
    
    -- Service-specific details
    CASE 
        WHEN sa.application_type = 'wedding' THEN wd.couple_names
        WHEN sa.application_type = 'memorial' THEN md.deceased_name
        WHEN sa.application_type = 'baptism' THEN bd.baptized_person
        ELSE ge.event_description
    END AS service_for,
    
    -- Clergy
    STRING_AGG(clergy_person.first_name || ' ' || clergy_person.last_name, ', ') AS clergy_names,
    
    -- Equipment needed
    ARRAY_REMOVE(ARRAY[
        CASE WHEN se.stand_mic THEN 'Stand Mic' END,
        CASE WHEN se.wireless_mic THEN 'Wireless Mic' END,
        CASE WHEN se.communion THEN 'Communion' END,
        CASE WHEN se.roped_seating THEN 'Roped Seating' END
    ], NULL) AS equipment_needed,
    
    -- Status
    sa.status,
    sa.altar_guild_notified

FROM crouse_chapel.service_applications sa
JOIN core.persons p ON sa.contact_person_id = p.id
LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
LEFT JOIN crouse_chapel.memorial_details md ON sa.id = md.application_id
LEFT JOIN crouse_chapel.baptism_details bd ON sa.id = bd.application_id
LEFT JOIN crouse_chapel.general_use_details ge ON sa.id = ge.application_id
LEFT JOIN crouse_chapel.service_equipment se ON sa.id = se.application_id
LEFT JOIN crouse_chapel.service_clergy sc ON sa.id = sc.application_id
LEFT JOIN crouse_chapel.clergy c ON sc.clergy_id = c.id
LEFT JOIN core.persons clergy_person ON c.person_id = clergy_person.id
WHERE sa.service_date = CURRENT_DATE
  AND sa.status != 'cancelled'
GROUP BY sa.id, sa.service_date, sa.service_time, sa.application_type,
         p.first_name, p.last_name, wd.couple_names, md.deceased_name,
         bd.baptized_person, ge.event_description, se.stand_mic, se.wireless_mic,
         se.communion, se.roped_seating, sa.status, sa.altar_guild_notified
ORDER BY sa.service_time;
```

### 2. Member Family Tree with Activity

```sql
-- Complete family view with 3 generations and activities
WITH RECURSIVE family_tree AS (
    -- Start with a member
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        m.member_number,
        m.generation_number,
        0 as depth,
        ARRAY[p.id] as path,
        p.id as root_person_id
    FROM core.persons p
    JOIN core.members m ON p.id = m.person_id
    WHERE m.member_number = 'M-1234'
    
    UNION ALL
    
    -- Get all family members
    SELECT 
        p2.id,
        p2.first_name,
        p2.last_name,
        m2.member_number,
        m2.generation_number,
        ft.depth + 1,
        ft.path || p2.id,
        ft.root_person_id
    FROM family_tree ft
    JOIN core.family_relationships fr ON ft.id = fr.person_id
    JOIN core.persons p2 ON fr.related_person_id = p2.id
    LEFT JOIN core.members m2 ON p2.id = m2.person_id
    WHERE NOT p2.id = ANY(ft.path)
      AND ft.depth < 3  -- Limit to 3 generations
)
SELECT 
    ft.*,
    -- Current cottage
    c.cottage_number,
    
    -- Current year activities
    COUNT(DISTINCT e.program_id) AS education_enrollments,
    COUNT(DISTINCT t.id) AS event_tickets,
    SUM(trans.amount) FILTER (WHERE trans.transaction_type = 'donation') AS donations_this_year

FROM family_tree ft
LEFT JOIN property.cottage_leases cl ON ft.id = cl.member_id AND cl.is_current = true
LEFT JOIN property.cottages c ON cl.cottage_id = c.id
LEFT JOIN education.enrollments e ON ft.id = e.student_id 
    AND e.created_at >= DATE_TRUNC('year', CURRENT_DATE)
LEFT JOIN events.ticket_orders to ON ft.id = to.purchaser_id
    AND to.order_date >= DATE_TRUNC('year', CURRENT_DATE)
LEFT JOIN events.order_items oi ON to.id = oi.order_id
LEFT JOIN events.tickets t ON oi.ticket_id = t.id
LEFT JOIN finance.transactions trans ON ft.id = trans.person_id
    AND trans.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
    AND trans.payment_status = 'completed'
GROUP BY ft.id, ft.first_name, ft.last_name, ft.member_number, 
         ft.generation_number, ft.depth, ft.path, ft.root_person_id,
         c.cottage_number
ORDER BY ft.generation_number, ft.depth, ft.last_name, ft.first_name;
```

### 3. Smart Double-Booking Prevention

```sql
-- Check all potential conflicts before booking
WITH proposed_booking AS (
    SELECT 
        '2024-07-15'::date as booking_date,
        '14:00'::time as start_time,
        '16:00'::time as end_time,
        'Crouse Chapel' as venue
),
conflicts AS (
    -- Check chapel services
    SELECT 
        'Chapel Service' as conflict_type,
        sa.service_time as start_time,
        sa.service_time + INTERVAL '2 hours' as end_time,
        sa.application_type || ' for ' || 
        COALESCE(wd.couple_names, md.deceased_name, bd.baptized_person, ge.event_description) as description
    FROM crouse_chapel.service_applications sa
    LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
    LEFT JOIN crouse_chapel.memorial_details md ON sa.id = md.application_id
    LEFT JOIN crouse_chapel.baptism_details bd ON sa.id = bd.application_id
    LEFT JOIN crouse_chapel.general_use_details ge ON sa.id = ge.application_id
    CROSS JOIN proposed_booking pb
    WHERE sa.service_date = pb.booking_date
      AND sa.status != 'cancelled'
      AND (sa.service_time, sa.service_time + INTERVAL '2 hours') OVERLAPS (pb.start_time, pb.end_time)
    
    UNION ALL
    
    -- Check facility reservations
    SELECT 
        'Facility Reservation' as conflict_type,
        fr.start_time,
        fr.end_time,
        fr.event_name || ' (' || p.first_name || ' ' || p.last_name || ')' as description
    FROM facilities.reservations fr
    JOIN facilities.spaces fs ON fr.space_id = fs.id
    JOIN core.persons p ON fr.reserved_by = p.id
    CROSS JOIN proposed_booking pb
    WHERE fs.facility_name = pb.venue
      AND fr.reservation_date = pb.booking_date
      AND fr.status != 'cancelled'
      AND (fr.start_time, fr.end_time) OVERLAPS (pb.start_time, pb.end_time)
    
    UNION ALL
    
    -- Check performances
    SELECT 
        'Performance' as conflict_type,
        perf.performance_time - INTERVAL '1 hour' as start_time, -- Include setup time
        perf.performance_time + INTERVAL '3 hours' as end_time,
        prod.production_name as description
    FROM events.performances perf
    JOIN events.productions prod ON perf.production_id = prod.id
    JOIN events.venues v ON perf.venue_id = v.id
    CROSS JOIN proposed_booking pb
    WHERE v.venue_name = pb.venue
      AND perf.performance_date = pb.booking_date
      AND perf.status != 'cancelled'
      AND (perf.performance_time - INTERVAL '1 hour', 
           perf.performance_time + INTERVAL '3 hours') OVERLAPS (pb.start_time, pb.end_time)
)
SELECT * FROM conflicts
ORDER BY start_time;
```

### 4. Financial Health Dashboard

```sql
-- Comprehensive financial overview by member segment
WITH member_segments AS (
    SELECT 
        m.id as member_id,
        p.id as person_id,
        p.first_name || ' ' || p.last_name as name,
        m.member_number,
        CASE 
            WHEN cl.cottage_id IS NOT NULL THEN 'Cottager'
            WHEN m.membership_type = 'life' THEN 'Life Member'
            WHEN DATE_PART('year', AGE(m.membership_start_date)) > 25 THEN 'Long-term Member'
            ELSE 'Regular Member'
        END as member_segment,
        cl.cottage_id,
        c.cottage_number
    FROM core.members m
    JOIN core.persons p ON m.person_id = p.id
    LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
    LEFT JOIN property.cottages c ON cl.cottage_id = c.id
    WHERE m.status = 'active'
),
financial_summary AS (
    SELECT 
        ms.member_segment,
        ms.member_id,
        ms.person_id,
        ms.name,
        ms.cottage_number,
        
        -- Revenue by type
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'membership_dues') as membership_revenue,
        SUM(t.amount) FILTER (WHERE t.transaction_type IN ('cottage_lease', 'cottage_fee')) as cottage_revenue,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'education_tuition') as education_revenue,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'ticket_purchase') as event_revenue,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation') as donations,
        
        -- Engagement metrics
        COUNT(DISTINCT e.program_id) as programs_enrolled,
        COUNT(DISTINCT eto.id) as events_attended,
        
        -- Account status
        COALESCE(ab.membership_balance, 0) as current_balance,
        COALESCE(ab.account_credit, 0) as available_credit
        
    FROM member_segments ms
    LEFT JOIN finance.transactions t ON ms.person_id = t.person_id 
        AND t.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
        AND t.payment_status = 'completed'
    LEFT JOIN education.enrollments e ON ms.person_id = e.student_id
        AND e.created_at >= DATE_TRUNC('year', CURRENT_DATE)
    LEFT JOIN events.ticket_orders eto ON ms.person_id = eto.purchaser_id
        AND eto.order_date >= DATE_TRUNC('year', CURRENT_DATE)
    LEFT JOIN finance.account_balances ab ON ms.person_id = ab.person_id
    GROUP BY ms.member_segment, ms.member_id, ms.person_id, ms.name, 
             ms.cottage_number, ab.membership_balance, ab.account_credit
)
SELECT 
    member_segment,
    COUNT(DISTINCT member_id) as member_count,
    
    -- Average revenues
    AVG(COALESCE(membership_revenue, 0))::numeric(10,2) as avg_membership_revenue,
    AVG(COALESCE(cottage_revenue, 0))::numeric(10,2) as avg_cottage_revenue,
    AVG(COALESCE(education_revenue, 0))::numeric(10,2) as avg_education_revenue,
    AVG(COALESCE(event_revenue, 0))::numeric(10,2) as avg_event_revenue,
    AVG(COALESCE(donations, 0))::numeric(10,2) as avg_donations,
    
    -- Total revenues
    SUM(COALESCE(membership_revenue, 0))::numeric(10,2) as total_membership_revenue,
    SUM(COALESCE(cottage_revenue, 0))::numeric(10,2) as total_cottage_revenue,
    SUM(COALESCE(education_revenue, 0))::numeric(10,2) as total_education_revenue,
    SUM(COALESCE(event_revenue, 0))::numeric(10,2) as total_event_revenue,
    SUM(COALESCE(donations, 0))::numeric(10,2) as total_donations,
    
    -- Engagement
    AVG(programs_enrolled)::numeric(3,1) as avg_programs_per_member,
    AVG(events_attended)::numeric(3,1) as avg_events_per_member,
    
    -- Account health
    SUM(current_balance)::numeric(10,2) as total_outstanding_balance,
    COUNT(*) FILTER (WHERE current_balance > 0) as members_with_balance_due

FROM financial_summary
GROUP BY member_segment
ORDER BY total_membership_revenue + total_cottage_revenue + total_education_revenue + 
         total_event_revenue + total_donations DESC;
```

### 5. Integrated Communication Targeting

```sql
-- Find members for targeted campaign based on multiple criteria
WITH target_audience AS (
    SELECT DISTINCT
        p.id as person_id,
        p.first_name,
        p.last_name,
        p.primary_email,
        m.member_number,
        
        -- Segmentation flags
        CASE WHEN cl.cottage_id IS NOT NULL THEN true ELSE false END as is_cottager,
        CASE WHEN COUNT(e.id) > 0 THEN true ELSE false END as is_education_participant,
        CASE WHEN COUNT(eto.id) > 0 THEN true ELSE false END as is_event_attendee,
        CASE WHEN SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation') > 1000 
             THEN true ELSE false END as is_major_donor,
        
        -- Contact preferences
        cp.email_opted_in,
        cp.event_announcements,
        
        -- Best contact info
        COALESCE(
            cm_summer.contact_value,
            cm_primary.contact_value,
            p.primary_email
        ) as best_email
        
    FROM core.persons p
    JOIN core.members m ON p.id = m.person_id
    LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
    LEFT JOIN education.enrollments e ON p.id = e.student_id 
        AND e.created_at >= CURRENT_DATE - INTERVAL '2 years'
    LEFT JOIN events.ticket_orders eto ON p.id = eto.purchaser_id
        AND eto.order_date >= CURRENT_DATE - INTERVAL '1 year'
    LEFT JOIN finance.transactions t ON p.id = t.person_id
        AND t.transaction_date >= CURRENT_DATE - INTERVAL '2 years'
        AND t.payment_status = 'completed'
    LEFT JOIN communications.preferences cp ON p.id = cp.person_id
    LEFT JOIN core.contact_methods cm_primary ON p.id = cm_primary.person_id 
        AND cm_primary.contact_type = 'email' 
        AND cm_primary.is_primary = true
    LEFT JOIN core.contact_methods cm_summer ON p.id = cm_summer.person_id 
        AND cm_summer.contact_type = 'email' 
        AND cm_summer.label = 'summer'
        AND EXTRACT(MONTH FROM CURRENT_DATE) BETWEEN cm_summer.seasonal_start_month 
                                                  AND cm_summer.seasonal_end_month
    
    WHERE m.status = 'active'
      AND (cp.email_opted_in IS NULL OR cp.email_opted_in = true)
    
    GROUP BY p.id, p.first_name, p.last_name, p.primary_email, m.member_number,
             cl.cottage_id, cp.email_opted_in, cp.event_announcements,
             cm_summer.contact_value, cm_primary.contact_value
)
-- Example: Target cottagers who attend events but haven't enrolled in education
SELECT 
    person_id,
    first_name || ' ' || last_name as full_name,
    best_email,
    member_number
FROM target_audience
WHERE is_cottager = true
  AND is_event_attendee = true
  AND is_education_participant = false
  AND email_opted_in != false
ORDER BY last_name, first_name;
```

### 6. Operational Efficiency Report

```sql
-- Facility utilization and revenue optimization
WITH facility_metrics AS (
    SELECT 
        fs.id as space_id,
        fs.facility_name,
        fs.space_name,
        fs.max_capacity,
        
        -- Calculate available hours
        EXTRACT(EPOCH FROM (fs.daily_end_time - fs.daily_start_time)) / 3600 as daily_hours,
        
        -- Get bookings for current month
        COUNT(fr.id) as total_bookings,
        SUM(EXTRACT(EPOCH FROM (fr.end_time - fr.start_time)) / 3600) as booked_hours,
        
        -- Revenue
        SUM(fr.total_cost) as revenue,
        
        -- Usage patterns
        MODE() WITHIN GROUP (ORDER BY EXTRACT(DOW FROM fr.reservation_date)) as most_popular_day,
        MODE() WITHIN GROUP (ORDER BY fr.event_type) as most_common_use
        
    FROM facilities.spaces fs
    LEFT JOIN facilities.reservations fr ON fs.id = fr.space_id
        AND fr.reservation_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND fr.reservation_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND fr.status = 'confirmed'
    GROUP BY fs.id, fs.facility_name, fs.space_name, fs.max_capacity,
             fs.daily_end_time, fs.daily_start_time
),
utilization_summary AS (
    SELECT 
        fm.*,
        -- Calculate utilization rate (assuming 30 days per month)
        CASE 
            WHEN fm.daily_hours > 0 THEN 
                (fm.booked_hours / (fm.daily_hours * 30)) * 100
            ELSE 0 
        END as utilization_percentage,
        
        -- Revenue per hour
        CASE 
            WHEN fm.booked_hours > 0 THEN fm.revenue / fm.booked_hours
            ELSE 0
        END as revenue_per_hour
    FROM facility_metrics fm
)
SELECT 
    facility_name,
    space_name,
    max_capacity,
    total_bookings,
    ROUND(utilization_percentage, 1) || '%' as utilization_rate,
    COALESCE(revenue, 0)::numeric(10,2) as monthly_revenue,
    COALESCE(revenue_per_hour, 0)::numeric(10,2) as avg_revenue_per_hour,
    CASE most_popular_day
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END as busiest_day,
    COALESCE(most_common_use, 'No bookings') as primary_use
FROM utilization_summary
ORDER BY utilization_percentage DESC;
```

### 7. Historical Preservation Tracking

```sql
-- Track multi-generational cottage ownership and member legacy
WITH cottage_history AS (
    SELECT 
        c.id as cottage_id,
        c.cottage_number,
        c.cottage_name,
        c.year_built,
        cl.id as lease_id,
        cl.start_date,
        cl.end_date,
        cl.lease_type,
        m.member_number,
        m.generation_number,
        p.first_name || ' ' || p.last_name as leaseholder_name,
        
        -- Calculate tenure
        CASE 
            WHEN cl.end_date IS NULL THEN 
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, cl.start_date))
            ELSE 
                EXTRACT(YEAR FROM AGE(cl.end_date, cl.start_date))
        END as years_held
        
    FROM property.cottages c
    JOIN property.cottage_leases cl ON c.id = cl.cottage_id
    JOIN core.members m ON cl.member_id = m.id
    JOIN core.persons p ON m.person_id = p.id
    ORDER BY c.cottage_number, cl.start_date
),
cottage_lineage AS (
    SELECT 
        cottage_id,
        cottage_number,
        cottage_name,
        year_built,
        CURRENT_DATE - year_built::INTEGER * INTERVAL '1 year' as age,
        
        -- Ownership statistics
        COUNT(DISTINCT lease_id) as total_leases,
        COUNT(DISTINCT member_number) as unique_leaseholders,
        STRING_AGG(
            leaseholder_name || ' (' || 
            COALESCE(start_date::TEXT, 'unknown') || ' - ' || 
            COALESCE(end_date::TEXT, 'present') || ')',
            E'\\n' ORDER BY start_date
        ) as ownership_history,
        
        -- Generation tracking
        MIN(generation_number) as earliest_generation,
        MAX(generation_number) as latest_generation,
        
        -- Current status
        MAX(CASE WHEN end_date IS NULL THEN leaseholder_name END) as current_leaseholder,
        MAX(CASE WHEN end_date IS NULL THEN years_held END) as current_tenure_years
        
    FROM cottage_history
    GROUP BY cottage_id, cottage_number, cottage_name, year_built
)
SELECT 
    cottage_number,
    cottage_name,
    EXTRACT(YEAR FROM age) || ' years' as cottage_age,
    total_leases || ' leases' as ownership_changes,
    unique_leaseholders || ' families' as unique_families,
    CASE 
        WHEN latest_generation - earliest_generation >= 3 THEN 'Multi-generational (4+)'
        WHEN latest_generation - earliest_generation = 2 THEN 'Three generations'
        WHEN latest_generation - earliest_generation = 1 THEN 'Two generations'
        ELSE 'Single generation'
    END as generational_status,
    current_leaseholder,
    current_tenure_years || ' years' as current_tenure,
    ownership_history
FROM cottage_lineage
WHERE latest_generation - earliest_generation >= 2  -- Focus on multi-generational
ORDER BY latest_generation - earliest_generation DESC, cottage_number;
```

## Performance Optimization Examples

### 1. Optimized Search with Full-Text and Fuzzy Matching

```sql
-- Create enhanced search function
CREATE OR REPLACE FUNCTION search_persons(search_term TEXT)
RETURNS TABLE (
    person_id INTEGER,
    full_name TEXT,
    member_number TEXT,
    email TEXT,
    cottage_number TEXT,
    match_type TEXT,
    relevance_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH search_results AS (
        -- Full-text search
        SELECT 
            p.id,
            p.first_name || ' ' || p.last_name as full_name,
            m.member_number,
            p.primary_email,
            c.cottage_number,
            'full_text' as match_type,
            ts_rank(p.full_name_search, plainto_tsquery('english', search_term)) as score
        FROM core.persons p
        LEFT JOIN core.members m ON p.id = m.person_id
        LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
        LEFT JOIN property.cottages c ON cl.cottage_id = c.id
        WHERE p.full_name_search @@ plainto_tsquery('english', search_term)
        
        UNION ALL
        
        -- Fuzzy matching
        SELECT 
            p.id,
            p.first_name || ' ' || p.last_name,
            m.member_number,
            p.primary_email,
            c.cottage_number,
            'fuzzy' as match_type,
            similarity(p.first_name || ' ' || p.last_name, search_term) as score
        FROM core.persons p
        LEFT JOIN core.members m ON p.id = m.person_id
        LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
        LEFT JOIN property.cottages c ON cl.cottage_id = c.id
        WHERE similarity(p.first_name || ' ' || p.last_name, search_term) > 0.3
        
        UNION ALL
        
        -- Member number search
        SELECT 
            p.id,
            p.first_name || ' ' || p.last_name,
            m.member_number,
            p.primary_email,
            c.cottage_number,
            'member_number' as match_type,
            1.0 as score
        FROM core.persons p
        JOIN core.members m ON p.id = m.person_id
        LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
        LEFT JOIN property.cottages c ON cl.cottage_id = c.id
        WHERE m.member_number ILIKE '%' || search_term || '%'
    )
    SELECT DISTINCT ON (id)
        id as person_id,
        full_name,
        member_number,
        primary_email as email,
        cottage_number,
        match_type,
        score as relevance_score
    FROM search_results
    ORDER BY id, score DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM search_persons('Smith') ORDER BY relevance_score DESC;
```

### 2. Automated Conflict Resolution

```sql
-- Function to automatically suggest alternative times
CREATE OR REPLACE FUNCTION suggest_alternative_times(
    requested_date DATE,
    requested_start TIME,
    requested_duration INTERVAL,
    venue_name TEXT
)
RETURNS TABLE (
    suggested_date DATE,
    suggested_start TIME,
    suggested_end TIME,
    availability_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH time_slots AS (
        SELECT 
            d.date,
            t.time as start_time,
            t.time + requested_duration as end_time
        FROM generate_series(
            requested_date - INTERVAL '3 days',
            requested_date + INTERVAL '3 days',
            INTERVAL '1 day'
        ) d(date)
        CROSS JOIN generate_series(
            TIME '08:00',
            TIME '20:00',
            INTERVAL '30 minutes'
        ) t(time)
        WHERE EXTRACT(DOW FROM d.date) BETWEEN 1 AND 6  -- Monday to Saturday
    ),
    availability_check AS (
        SELECT 
            ts.date,
            ts.start_time,
            ts.end_time,
            -- Check conflicts
            NOT EXISTS (
                SELECT 1 FROM crouse_chapel.service_applications sa
                WHERE sa.service_date = ts.date
                  AND sa.status != 'cancelled'
                  AND (sa.service_time, sa.service_time + INTERVAL '2 hours') 
                      OVERLAPS (ts.start_time, ts.end_time)
            ) AND NOT EXISTS (
                SELECT 1 FROM facilities.reservations fr
                JOIN facilities.spaces fs ON fr.space_id = fs.id
                WHERE fs.facility_name = venue_name
                  AND fr.reservation_date = ts.date
                  AND fr.status != 'cancelled'
                  AND (fr.start_time, fr.end_time) OVERLAPS (ts.start_time, ts.end_time)
            ) as is_available,
            -- Calculate preference score
            CASE 
                WHEN ts.date = requested_date THEN 10
                WHEN ABS(ts.date - requested_date) = 1 THEN 8
                WHEN ABS(ts.date - requested_date) = 2 THEN 6
                ELSE 4
            END +
            CASE 
                WHEN ts.start_time = requested_start THEN 5
                WHEN ABS(EXTRACT(EPOCH FROM (ts.start_time - requested_start))/3600) <= 1 THEN 3
                ELSE 1
            END as preference_score
        FROM time_slots ts
    )
    SELECT 
        date as suggested_date,
        start_time as suggested_start,
        end_time as suggested_end,
        preference_score as availability_score
    FROM availability_check
    WHERE is_available = true
    ORDER BY preference_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
```

### 3. Automated Financial Reconciliation

```sql
-- Daily reconciliation and alert generation
CREATE OR REPLACE FUNCTION daily_financial_reconciliation()
RETURNS TABLE (
    alert_type TEXT,
    alert_level TEXT,
    person_id INTEGER,
    member_number TEXT,
    description TEXT,
    amount DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    -- Overdue accounts
    SELECT 
        'overdue_invoice' as alert_type,
        'high' as alert_level,
        p.id as person_id,
        m.member_number,
        'Invoice #' || i.invoice_number || ' overdue by ' || 
        (CURRENT_DATE - i.due_date) || ' days' as description,
        i.total_amount - COALESCE(paid.amount, 0) as amount
    FROM finance.invoices i
    JOIN core.persons p ON i.person_id = p.id
    LEFT JOIN core.members m ON p.id = m.person_id
    LEFT JOIN LATERAL (
        SELECT SUM(t.amount) as amount
        FROM finance.transactions t
        WHERE t.person_id = i.person_id
          AND t.reference_type = 'invoice'
          AND t.reference_id = i.id
          AND t.payment_status = 'completed'
    ) paid ON true
    WHERE i.due_date < CURRENT_DATE
      AND i.status NOT IN ('paid', 'cancelled')
      AND i.total_amount > COALESCE(paid.amount, 0)
    
    UNION ALL
    
    -- Large credit balances
    SELECT 
        'credit_balance' as alert_type,
        'medium' as alert_level,
        ab.person_id,
        m.member_number,
        'Account has credit balance' as description,
        ab.account_credit
    FROM finance.account_balances ab
    JOIN core.members m ON ab.person_id = m.person_id
    WHERE ab.account_credit > 500
    
    UNION ALL
    
    -- Unusual transactions
    SELECT 
        'unusual_transaction' as alert_type,
        'low' as alert_level,
        t.person_id,
        m.member_number,
        'Transaction amount exceeds typical by ' || 
        ROUND(((t.amount - avg_amount) / avg_amount * 100)::numeric, 0) || '%' as description,
        t.amount
    FROM finance.transactions t
    JOIN core.members m ON t.person_id = m.person_id
    JOIN LATERAL (
        SELECT AVG(t2.amount) as avg_amount
        FROM finance.transactions t2
        WHERE t2.person_id = t.person_id
          AND t2.transaction_type = t.transaction_type
          AND t2.transaction_date > CURRENT_DATE - INTERVAL '1 year'
          AND t2.transaction_date < t.transaction_date
    ) hist ON true
    WHERE t.transaction_date = CURRENT_DATE
      AND t.amount > hist.avg_amount * 3
      AND hist.avg_amount > 0
    
    ORDER BY 
        CASE alert_level 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            ELSE 3 
        END,
        amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('daily-reconciliation', '0 6 * * *', 'SELECT * FROM daily_financial_reconciliation();');
```

## Integration with External Systems

### 1. Notion Sync Function

```sql
-- Bidirectional sync with Notion
CREATE OR REPLACE FUNCTION sync_with_notion()
RETURNS void AS $$
DECLARE
    v_record RECORD;
    v_notion_response JSONB;
BEGIN
    -- Find records that need syncing
    FOR v_record IN 
        SELECT 
            sa.id,
            sa.notion_id,
            sa.updated_at,
            sa.application_type,
            p.first_name || ' ' || p.last_name as contact_name,
            -- ... other fields
        FROM crouse_chapel.service_applications sa
        JOIN core.persons p ON sa.contact_person_id = p.id
        WHERE sa.notion_sync_status = 'pending'
           OR sa.updated_at > sa.notion_last_sync
        LIMIT 100
    LOOP
        -- Call Notion API (pseudo-code)
        -- v_notion_response := notion_api_update(v_record);
        
        -- Update sync status
        UPDATE crouse_chapel.service_applications
        SET notion_sync_status = 'completed',
            notion_last_sync = CURRENT_TIMESTAMP
        WHERE id = v_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

This comprehensive implementation demonstrates how PostgreSQL's powerful relational features enable Bay View Association to run complex operations that would be impossible with Notion's flat structure. The examples show real-world queries for daily operations, member management, financial tracking, and system integration.