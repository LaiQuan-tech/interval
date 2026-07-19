"use client";

import { useState } from "react";
import { saveSetting } from "@/app/admin/actions";

const SECTIONS = [
  {
    key: "company_profile",
    title: "公司資訊",
    hint: '例:{"name": "interval", "tagline": "賣到全世界", "email": "hi@example.com", "phone": "02-1234-5678", "bank_info": "銀行:812 台新\\n帳號:1234567890\\n戶名:interval", "about": "公司簡介(AI 客服會參考)"}',
  },
  {
    key: "rate_card",
    title: "AI 報價費率卡",
    hint: '例:{"note": "大量採購費率", "items": [{"name": "商品A 批發", "unit_price": 450, "unit": "件", "min_quantity": 50, "note": "50件起"}]}。AI 只會用這裡的品項與價格產生報價草稿。',
  },
  {
    key: "quote_config",
    title: "報價參數",
    hint: '例:{"valid_days": 14, "tax_rate": 0.05, "followup_days": 3}(有效天數 / 稅率 / 追蹤提醒天數)',
  },
] as const;

export default function SettingsForm(props: {
  companyProfile: string;
  rateCard: string;
  quoteConfig: string;
}) {
  const initial: Record<string, string> = {
    company_profile: props.companyProfile,
    rate_card: props.rateCard,
    quote_config: props.quoteConfig,
  };
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<Record<string, string>>({});

  async function save(key: string) {
    setStatus((s) => ({ ...s, [key]: "儲存中…" }));
    try {
      await saveSetting(key, values[key]);
      setStatus((s) => ({ ...s, [key]: "已儲存 ✓" }));
    } catch (err) {
      setStatus((s) => ({
        ...s,
        [key]: err instanceof Error ? err.message : "儲存失敗",
      }));
    }
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <section key={section.key} className="iv-card">
          <h3 className="font-bold">{section.title}</h3>
          <p className="mt-1 break-all text-xs leading-relaxed text-ink-soft">
            {section.hint}
          </p>
          <textarea
            rows={8}
            spellCheck={false}
            className="iv-input mt-3 min-h-40 font-mono text-xs"
            value={values[section.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [section.key]: e.target.value }))
            }
          />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => save(section.key)} className="iv-btn-primary !min-h-10">
              儲存
            </button>
            {status[section.key] && (
              <span className="text-sm text-ink-soft">{status[section.key]}</span>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
