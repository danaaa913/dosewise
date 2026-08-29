import { useState } from "react";
import { Layout } from "@/components/layout";

const INFO = [
  {
    label: "العنوان",
    value: "شارع وصفي التل، الشميساني، عمان، الأردن",
    icon: (
      <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
  {
    label: "البريد الإلكتروني",
    value: "support@dosewise.com",
    icon: (
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
  },
  {
    label: "الهاتف",
    value: "+962 6 555 1234",
    icon: (
      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    ),
  },
  {
    label: "ساعات العمل",
    value: "الأحد – الخميس، 9 صباحاً – 6 مساءً",
    icon: (
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.setTimeout(() => setSent(false), 8000);
  };

  return (
    <Layout title="تواصل معنا">
      <div className="max-w-5xl">
        <p className="text-sm text-slate-500 mb-6">
          نحب أن نسمع منك! سواء كان لديك سؤال أو اقتراح أو طلب دعم، فريقنا في عمان جاهز لمساعدتك.
        </p>

        {sent && (
          <div
            role="status"
            className="mb-5 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-sm text-emerald-800 flex items-center gap-3"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">تم استلام رسالتك بنجاح. سنتواصل معك قريباً.</span>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {INFO.map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {item.icon}
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                  <p className="text-sm font-medium text-slate-700">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">أرسل لنا رسالة</h3>

            <div>
              <label htmlFor="contact-name" className="block text-xs font-medium text-slate-600 mb-1">الاسم</label>
              <input
                id="contact-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-xs font-medium text-slate-600 mb-1">البريد الإلكتروني</label>
              <input
                id="contact-email"
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-600 mb-1">الموضوع</label>
              <input
                id="contact-subject"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-xs font-medium text-slate-600 mb-1">الرسالة</label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              إرسال الرسالة
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
