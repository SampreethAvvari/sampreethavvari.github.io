create extension if not exists vector;

-- Replace old storage with chatbot table
DROP TABLE IF EXISTS chatbot CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE chatbot (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  metadata jsonb,
  embedding vector(768)
);

CREATE OR REPLACE FUNCTION match_chatbot(
  query_embedding vector(768),
  match_count int default 5
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chatbot.id,
    chatbot.content,
    chatbot.metadata,
    1 - (chatbot.embedding <=> query_embedding) AS similarity
  FROM chatbot
  ORDER BY chatbot.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
