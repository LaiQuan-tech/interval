-- chat-uploads 轉為私密:客戶家中照片不應可被任意人以公開網址存取。
-- 讀取一律改走短期簽名網址(伺服器端以 service role 產生)。
update storage.buckets set public = false where id = 'chat-uploads';
