-- 小時光:為作品與旅程種子資料掛上實體圖檔(存於 web/public/artworks|journeys/<slug>.jpg)
-- 由 AI 影像模型生成,隨 repo 版控;檔名一律對應 product_type + slug。
-- 冪等:只在 images 尚未設定時填入,不覆蓋管理員後台手動設定過的圖。
update products
set images = jsonb_build_array(
  jsonb_build_object('url', '/' || product_type || 's/' || slug || '.jpg', 'alt', name)
)
where product_type in ('artwork', 'journey')
  and (images is null or images = '[]'::jsonb);
