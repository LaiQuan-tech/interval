-- 品牌改名:小時光 Little Moments → 好日子 Good Days
-- 只更新 company_profile 中含舊名的欄位(name/email/address);tagline/hours/phone 不含舊名,保留原值。
-- 重佈建(provision.mjs 重跑或新環境)時,20260719000001_littlemoments.sql 仍會先種下舊名,
-- 靠這支後續 migration 蓋掉,維持與正式環境一致。
update public.settings
set value = value
  || jsonb_build_object(
    'name', '好日子 Good Days',
    'email', 'salon@goodays.tw',
    'address', '台北市大安區　好日子書店'
  )
where key = 'company_profile';
