import { Layout } from "@/components/layout";
import { Logo } from "@/components/Logo";

const FEATURES = [
  {
    title: "تبادل ذكي للأدوية",
    desc: "اعرض أدويتك الفائضة واطلب ما تحتاجه من صيدليات أخرى في الأردن خلال دقائق.",
    icon: (
      <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    ),
  },
  {
    title: "تقليل هدر الأدوية",
    desc: "بدلاً من إتلاف الأدوية القاربة على انتهاء الصلاحية، شاركها مع صيدليات تحتاجها.",
    icon: (
      <path d="M3 6l3 12a2 2 0 002 1h8a2 2 0 002-1l3-12M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    ),
  },
  {
    title: "ذكاء اصطناعي محلي",
    desc: "توصيات وتحليلات مبنية على بيانات السوق الأردني الفعلية لمساعدتك في اتخاذ قرارات أفضل.",
    icon: (
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    ),
  },
  {
    title: "خدمة جميع المحافظات",
    desc: "نخدم صيدليات في عمان، إربد، الزرقاء، العقبة، السلط، المفرق، وجميع محافظات المملكة.",
    icon: (
      <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
];

export default function AboutPage() {
  return (
    <Layout title="عن المنصة">
      <div className="max-w-4xl space-y-6">
        <section className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-8 text-white">
          <div className="flex items-start gap-4 mb-4">
            <Logo size={56} />
            <div>
              <h2 className="text-2xl font-bold mb-1">DoseWise</h2>
              <p className="text-emerald-100 text-sm">منصة تبادل الأدوية بين الصيدليات الأردنية</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-emerald-50">
            DoseWise هي منصة B2B متخصصة تربط صيدليات المملكة الأردنية الهاشمية ببعضها البعض، لتسهيل
            تبادل الأدوية بين الصيدليات بشكل آمن وسريع. نهدف إلى تقليل هدر الأدوية وضمان توفر الأدوية
            الأساسية للمرضى في كل محافظة.
          </p>
        </section>

        <section className="bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">رسالتنا</h3>
          <p className="text-sm text-slate-600 leading-7">
            نسعى إلى بناء منظومة صحية أكثر كفاءة في الأردن من خلال تمكين الصيدليات من مشاركة مواردها،
            تقليل الفاقد من الأدوية، وضمان وصول الأدوية الأساسية لكل مريض في الوقت المناسب وبالسعر
            المناسب. كل دينار يُوفَّر في صيدليتك هو خدمة لمجتمعك.
          </p>
        </section>

        <section className="bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">لماذا DoseWise؟</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex gap-3 items-start p-4 bg-slate-50 rounded-xl">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {f.icon}
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-600 leading-6">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">منصة أردنية 100%</h3>
          <p className="text-sm text-slate-600 leading-7">
            تم تصميم DoseWise خصيصاً للسوق الأردني — بالأسعار بالدينار الأردني (JOD)، باللغة العربية،
            وبتغطية كاملة لمحافظات المملكة. نلتزم بأنظمة وزارة الصحة الأردنية ونقابة الصيادلة.
          </p>
        </section>
      </div>
    </Layout>
  );
}
