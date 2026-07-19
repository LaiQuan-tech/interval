import Placeholder from "@/components/Placeholder";
import BookingForm from "@/components/BookingForm";
import { getCompanyProfile } from "@/lib/settings";

export const metadata = { title: "預約參訪" };

export default async function BookingPage() {
  const company = await getCompanyProfile();

  return (
    <div className="lm-container py-16 sm:py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="lm-eyebrow text-[20px]">Book a private visit</div>
          <h1 className="mt-3.5 mb-4.5 font-serif text-[27px] font-normal tracking-[0.04em] text-ink sm:text-[48px]">
            預約參訪
          </h1>
          <p className="mb-10 max-w-110 text-[15.5px] leading-[2.05] text-ink-soft">
            歡迎親臨小時光書店門市，在靜謐的空間中鑑賞畫作、洽談租賃買斷或規劃您的私人旅程。我們將為您保留專屬時段。
          </p>
          <Placeholder label="Bookstore interior — 門市空間" className="mb-8 h-70" />
          <div className="flex flex-col gap-4.5 text-[14px] leading-[1.7] text-nav">
            <div>
              <span className="lm-caption text-[12px]">Address</span>
              <br />
              {company.address ?? "台北市大安區　小時光書店"}
            </div>
            <div>
              <span className="lm-caption text-[12px]">Hours</span>
              <br />
              {company.hours ?? "週二至週日 11:00 – 20:00"}
            </div>
            <div>
              <span className="lm-caption text-[12px]">Enquiry</span>
              <br />
              {company.phone ? `${company.phone} · ` : ""}
              {company.email || "salon@littlemoments.tw"}
            </div>
          </div>
        </div>

        <div className="bg-panel p-6.5 sm:p-13">
          <h3 className="mb-7.5 font-serif text-[24px] font-medium text-ink">預約表單</h3>
          <BookingForm />
        </div>
      </div>
    </div>
  );
}
