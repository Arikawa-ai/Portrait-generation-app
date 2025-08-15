-- portrait_db テーブル作成
CREATE TABLE portrait_db (
    picture_id SERIAL PRIMARY KEY,
    picture_url TEXT,
    status VARCHAR(20) DEFAULT '未作成' CHECK (status IN ('未作成', '作成済')),
    json_data JSONB,
    portrait_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_portrait_db_updated_at 
    BEFORE UPDATE ON portrait_db 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- インデックス作成（検索性能向上）
CREATE INDEX idx_portrait_db_status ON portrait_db(status);
CREATE INDEX idx_portrait_db_updated_at ON portrait_db(updated_at DESC);

-- RLS (Row Level Security) を有効化
ALTER TABLE portrait_db ENABLE ROW LEVEL SECURITY;

-- ポリシー設定：誰でも閲覧可能
CREATE POLICY "Portrait data is viewable by everyone" 
    ON portrait_db FOR SELECT 
    USING (true);

-- ポリシー設定：認証済みユーザーのみ作成・更新・削除可能
CREATE POLICY "Authenticated users can insert portrait data" 
    ON portrait_db FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update portrait data" 
    ON portrait_db FOR UPDATE 
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete portrait data" 
    ON portrait_db FOR DELETE 
    USING (auth.uid() IS NOT NULL);

-- サンプルデータ挿入（オプション）
-- INSERT INTO portrait_db (picture_url, status, json_data, portrait_url) 
-- VALUES 
--     ('https://example.com/photo1.png', '未作成', '{"parts": {}}', NULL),
--     ('https://example.com/photo2.png', '作成済', '{"parts": {"hair": "hair_001"}}', 'https://example.com/portrait1.png');