-- Enable RLS on conversations and messages tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Add unique constraint for conversation uniqueness
ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_unique_participants;

ALTER TABLE conversations 
ADD CONSTRAINT conversations_unique_participants 
UNIQUE (tourist_id, guide_id, tour_id);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'messages' AND column_name = 'content') THEN
    ALTER TABLE messages ADD COLUMN content TEXT;
    UPDATE messages SET content = body WHERE content IS NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'messages' AND column_name = 'read_at') THEN
    ALTER TABLE messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
    UPDATE messages SET read_at = created_at WHERE is_read = true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'conversations' AND column_name = 'updated_at') THEN
    ALTER TABLE conversations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_tourist 
ON conversations(tourist_id);

CREATE INDEX IF NOT EXISTS idx_conversations_guide 
ON conversations(guide_id);

CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON messages(conversation_id, sender_id, read_at) 
WHERE read_at IS NULL;

-- RLS Policies for conversations table
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
CREATE POLICY "Users can view their own conversations" 
ON conversations FOR SELECT 
USING (
  auth.uid() = tourist_id OR auth.uid() = guide_id
);

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" 
ON conversations FOR INSERT 
WITH CHECK (
  auth.uid() = tourist_id OR auth.uid() = guide_id
);

DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
CREATE POLICY "Users can update their conversations" 
ON conversations FOR UPDATE 
USING (
  auth.uid() = tourist_id OR auth.uid() = guide_id
);

-- RLS Policies for messages table
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" 
ON messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (conversations.tourist_id = auth.uid() OR conversations.guide_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
CREATE POLICY "Users can send messages in their conversations" 
ON messages FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (conversations.tourist_id = auth.uid() OR conversations.guide_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;
CREATE POLICY "Users can mark messages as read" 
ON messages FOR UPDATE 
USING (
  sender_id != auth.uid() 
  AND EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (conversations.tourist_id = auth.uid() OR conversations.guide_id = auth.uid())
  )
);
