-- Add language column to tour_schedules table for multi-language support
ALTER TABLE tour_schedules ADD COLUMN language VARCHAR(50) DEFAULT 'English';

-- Add index on (tour_id, language) for efficient querying
CREATE INDEX idx_tour_schedules_language ON tour_schedules(tour_id, language);

-- Add constraint to ensure language is not null
ALTER TABLE tour_schedules ALTER COLUMN language SET NOT NULL;
