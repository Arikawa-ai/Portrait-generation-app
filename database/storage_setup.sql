-- ストレージバケット作成（画像ファイル保存用）

-- 写真用バケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pictures',
    'pictures',
    true,
    5242880, -- 5MB制限
    ARRAY['image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- 似顔絵用バケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'portraits',
    'portraits',
    true,
    5242880, -- 5MB制限
    ARRAY['image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- JSONファイル用バケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'json-data',
    'json-data',
    true,
    1048576, -- 1MB制限
    ARRAY['application/json']
) ON CONFLICT (id) DO NOTHING;

-- ストレージポリシー設定
-- 誰でも閲覧可能
CREATE POLICY "Public can view pictures" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'pictures');

CREATE POLICY "Public can view portraits" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'portraits');

CREATE POLICY "Public can view json" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'json-data');

-- 認証済みユーザーのみアップロード可能
CREATE POLICY "Authenticated users can upload pictures" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'pictures' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload portraits" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'portraits' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload json" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'json-data' AND auth.uid() IS NOT NULL);

-- 認証済みユーザーのみ削除可能
CREATE POLICY "Authenticated users can delete pictures" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'pictures' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete portraits" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'portraits' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete json" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'json-data' AND auth.uid() IS NOT NULL);