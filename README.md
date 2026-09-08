# Survey Quality Hub | منصة جودة الاستبيانات

نسخة تطوير واختبار خاصة. لا يوجد نشر تلقائي، ولا يتضمن هذا المستودع ملفات الاستبيانات الأصلية أو ردود المشاركين.

## الاستخدام

ارفعي ملف Excel من «تحليل جديد». يحلل الموقع ورقة `RawData`، ثم يحفظ الملف والنتائج في الخادم. من «لوحة النتائج» اختاري البرنامج ثم المستوى والمقرر، وراجعي الأسئلة والمقارنات والإجابات المفتوحة وجودة البيانات. من «التصدير» نزّلي PowerPoint أو Word باللغة والنطاق المختارين.

لا يلزم تسجيل دخول. ملفات كل متصفح محفوظة في مساحة مستقلة باستخدام ملف ارتباط آمن؛ حذف ملف الارتباط يفقد الوصول إلى هذه المساحة. البيانات لا تُحفظ في `localStorage`؛ تستخدم قاعدة D1 وملفات R2، ومحاكيهما الدائم أثناء الاختبار المحلي.

## تشغيل نسخة الاختبار

المتطلبات: Node.js 24 وpnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

افتحي العنوان المحلي الذي يظهر بعد التشغيل، عادةً `http://localhost:3000`.

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/integration-test.mjs
node scripts/additional-integration.mjs
```

يمكن تعيين `CES_FIXTURE` و`HISTORICAL_FIXTURE` إلى مساري الملفين الأصليين للاختبارات الإضافية على الجهاز. تُحفظ مخرجات الاختبار في `work/` المستبعدة من Git. لا تضعي مسارات خاصة أو بيانات فعلية في الاختبارات المنشورة.

## قواعد التحليل

- CES: Q1–Q16 مقياسية 1–5؛ Q17–Q19 مفتوحة مهما كان شكل الإجابة. لا تُخترع Q20–Q23.
- المتوسط والإيجابية موزونان بعدد الإجابات الصحيحة. الإيجابية في CES للدرجات 4 و5.
- القيم النصية، الفارغة وغير المنتهية وخارج المقياس مستبعدة مع عدادات جودة. يُحسب المقام لكل سؤال مستقلًا.
- يُحسب Expected مرة لكل مجموعة برنامج/عام/فصل/مقرر، ولا يُجمع لكل استجابة أو شعبة. عند تعارضه أو انقسام المجموعة بين المستويات يعرض «غير متاح» للنطاق الذي لا يملك مقامًا مستقلًا.
- StudentYear يبقى كما في المصدر؛ لا يتحول تلقائيًا من السنوات 1–5 إلى المستويات 2–10.
- تصنيف المتوسط وتصنيف الإيجابية منفصلان. أولوية المقرر تعتمد على إيجابية Q15 دون 60%. تنبيه العينة الصغيرة عند أقل من 10.
- Mean وCumulative وGrad للمطابقة ضمن دقة المصدر، وليست استجابات جديدة.
- يمنع تكرار الملف ذاته بالتجزئة، وتُرفض المقارنة المجمعة إذا اختلف التعريف أو تداخلت مجموعات المقررات.
- الأنواع الأخرى تُكتشف من المحتوى؛ المقياس والأسئلة غير الواضحة تحتاج تأكيدًا. الأسئلة التصنيفية لا تُحتسب درجات.
- البيانات التاريخية تبقى قيمًا مجمعة موثقة بخلايا المصدر، دون اختراع مقامات أو متوسط عام.

## التقارير

PowerPoint يستخدم الشرائح والماستر والألوان والزخارف الأصلية من القالب المرفق بعد حذف النصوص التجريبية. عدد الشرائح يتغير حسب البيانات. Word تقرير قابل للتحرير بهوية لونية متناسقة؛ لم يُقدَّم قالب Word مستقل.

تصدير CES يتبع لكل مقرر: Course Summary ثم Previous Action Plan إذا قُدّمت بمصدر، ثم Implementation، ثم Proposed Action Plan، ثم CES Mean Values مع رسم، ثم CES Cumulative Values مع رسم، ثم Improvement/Priority عند الحاجة. بعد جميع المقررات تأتي Strengths وAreas for Improvement وPriority Courses وProposed Improvement Plan وEnd of Report.

الرسوم عناصر PowerPoint أصلية وليست صورًا، ولكل رسم مصنف Excel مضمّن بالقيم غير المقرّبة وعدد الإجابات الصحيحة. الجداول والنصوص قابلة للتحرير. القيم غير المتاحة تبقى فراغات في الرسم والمصنف ولا تصبح أصفارًا. Cumulative في هذا التقرير هو نسبة الإجابات الإيجابية وليس مجموعًا تراكميًا.

تُنشأ خطة مقترحة من نتائج كل استبيان مؤكد. في CES تغطي جميع الأسئلة الضعيفة؛ وعند غيابها تقترح تعزيز أقل النتائج المقبولة أو المحافظة على الأداء. لا يُختلق تنفيذ سابق أو مسؤول أو موعد معتمد. تعرض صفحة التصدير عدد الشرائح والرسوم والمقررات وأولوية التحسين ومطابقة البيانات وحالة مراجعة التصميم. مراجعة المصدر والتصميم لا تعني اعتماد الخطة من المستخدم.

التعليقات تُحلل وصفيًا في الواجهة بتكرار الإجابات والكلمات، دون إرسالها إلى خدمة ذكاء اصطناعي خارجية أو ادعاء تحليل المشاعر. تقرير Word يعرض أكثر الإجابات تكرارًا ويصرّح بذلك؛ PowerPoint يتبع البنية الموضحة أعلاه.

## الحفظ والحدود

- D1 لبيانات الملفات، وR2 للأصول ونتائج التحليل. جميع طلبات القراءة والتصدير تتحقق من ملكية مساحة المتصفح.
- ملفات ارتباط HttpOnly وSameSite=Strict؛ في HTTPS يستخدم اسم `__Host-` مع Secure.
- 20 ملفًا في الدفعة، 16 MB لكل ملف، 50,000 استجابة، 256 عمودًا، وحد للتوسع المضغوط. الدفعة تُعالج بالتتابع.
- ملفات المصدر خاصة وليست ضمن المسار العام أو Git؛ لا تُسجل الردود في سجلات الأخطاء.
- إعادة الفتح على جهاز آخر لا تستعيد المساحة تلقائيًا. صلاحيات المشاركة بين الأجهزة ليست ضمن هذه النسخة.

## بوابة النشر

فرع `development` للمراجعة. سير GitHub Actions يختبر ويبني فقط ولا ينشر. تُفعّل الاستضافة الفعلية ومواردها بعد موافقة مالكة المشروع، ثم تُعاد اختبارات الحفظ والعزل والتصدير في بيئة الاستضافة قبل إتاحة الموقع.

## English

A private bilingual survey analysis application with server-side anonymous workspaces, Excel ingestion, weighted metrics, hierarchical CES analysis, quality reconciliation, historical source-value registers, and editable PPTX/DOCX exports. No automatic deployment is configured. Source spreadsheets and personal responses are excluded from version control.

The Excel parser uses the [official SheetJS 0.20.3 distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). The checked-in report theme is a sanitized extraction of the user-supplied PowerPoint template; it is already ready for builds. `scripts/prepare-theme.mjs` is only needed when replacing that theme.

The native chart template was authored with the presentation artifact runtime and sanitized before check-in. Builds use `lib/report-chart-theme.json` directly. Its optional preparation script requires the private authoring bundle, not survey data. `scripts/ces-export-test.mjs` verifies both language exports against a local `CES_FIXTURE`, including every native chart cache and embedded workbook. No private fixture is uploaded to CI.
