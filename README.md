# Survey Quality Hub | منصة جودة الاستبيانات

منصة ثنائية اللغة لتحليل استبيانات الجودة وإعداد التقارير. لا يتضمن هذا المستودع ملفات الاستبيانات الأصلية أو ردود المشاركين، ولا يتم تخزين ملفات Excel الأصلية بشكل دائم على الخادم.

## الاستخدام

ارفعي ملف Excel من «تحليل جديد». يعالج الموقع الملف مؤقتًا في الذاكرة ويحلل ورقة `RawData` أو البيانات التاريخية المدعومة، ثم يحفظ **نتيجة التحليل فقط** في قاعدة Cloudflare D1.

لا يتم حفظ نسخة من ملف Excel الأصلي في D1 أو في Object Storage. بعد انتهاء المعالجة لا يعتمد النظام على الاحتفاظ بالملف الأصلي على الخادم.

من «لوحة النتائج» اختاري البرنامج ثم المستوى والمقرر، وراجعي الأسئلة والمقارنات والإجابات المفتوحة وجودة البيانات. ومن «التصدير» يمكنك تنزيل PowerPoint أو Word باللغة والنطاق المختارين.

لا يلزم تسجيل دخول. ترتبط نتائج كل مساحة عمل بالمتصفح باستخدام ملف ارتباط آمن. حذف ملف الارتباط قد يؤدي إلى فقدان الوصول إلى النتائج المرتبطة بتلك المساحة.

لا تُحفظ بيانات مساحة العمل في `localStorage`. تستخدم المنصة Cloudflare D1 لحفظ بيانات التقارير ونتائج التحليل فقط.

إذا احتاج تقرير إلى إعادة التحليل بعد تأكيد نوع الاستبيان أو المقياس أو أنواع الأسئلة، يجب توفير ملف Excel نفسه مرة أخرى إذا لم يعد موجودًا مؤقتًا في ذاكرة المتصفح. يتحقق النظام من تطابق الملف قبل إعادة التحليل.

## تشغيل نسخة الاختبار

المتطلبات: Node.js 24 وpnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

افتحي العنوان المحلي الذي يظهر بعد التشغيل، عادةً:

```text
http://localhost:3000
```

لتشغيل فحوصات المشروع:

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/integration-test.mjs
node scripts/additional-integration.mjs
```

يمكن تعيين `CES_FIXTURE` و`HISTORICAL_FIXTURE` إلى مساري الملفين الأصليين للاختبارات الإضافية على الجهاز.

تُحفظ مخرجات الاختبار في `work/` المستبعدة من Git. لا تضعي مسارات خاصة أو بيانات فعلية في الاختبارات المنشورة.

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

PowerPoint يستخدم الشرائح والماستر والألوان والزخارف الأصلية من القالب المرفق بعد حذف النصوص التجريبية. عدد الشرائح يتغير حسب البيانات.

Word تقرير قابل للتحرير بهوية لونية متناسقة؛ لم يُقدَّم قالب Word مستقل.

تصدير CES يتبع لكل مقرر:

Course Summary ثم Previous Action Plan إذا قُدّمت بمصدر، ثم Implementation، ثم Proposed Action Plan، ثم CES Mean Values مع رسم، ثم CES Cumulative Values مع رسم، ثم Improvement/Priority عند الحاجة.

بعد جميع المقررات تأتي Strengths وAreas for Improvement وPriority Courses وProposed Improvement Plan وEnd of Report.

الرسوم عناصر PowerPoint أصلية وليست صورًا، ولكل رسم مصنف Excel مضمّن بالقيم غير المقرّبة وعدد الإجابات الصحيحة.

الجداول والنصوص قابلة للتحرير. القيم غير المتاحة تبقى فراغات في الرسم والمصنف ولا تصبح أصفارًا. Cumulative في هذا التقرير هو نسبة الإجابات الإيجابية وليس مجموعًا تراكميًا.

تُنشأ خطة مقترحة من نتائج كل استبيان مؤكد. في CES تغطي جميع الأسئلة الضعيفة؛ وعند غيابها تقترح تعزيز أقل النتائج المقبولة أو المحافظة على الأداء.

لا يُختلق تنفيذ سابق أو مسؤول أو موعد معتمد.

تعرض صفحة التصدير عدد الشرائح والرسوم والمقررات وأولوية التحسين ومطابقة البيانات وحالة مراجعة التصميم. مراجعة المصدر والتصميم لا تعني اعتماد الخطة من المستخدم.

التعليقات تُحلل وصفيًا في الواجهة بتكرار الإجابات والكلمات، دون إرسالها إلى خدمة ذكاء اصطناعي خارجية أو ادعاء تحليل المشاعر.

تقرير Word يعرض أكثر الإجابات تكرارًا ويصرّح بذلك؛ PowerPoint يتبع البنية الموضحة أعلاه.

## التخزين والخصوصية

- تستخدم المنصة **Cloudflare D1 فقط** لحفظ بيانات التقارير ونتائج التحليل.
- لا تستخدم المنصة R2 لتخزين ملفات الاستبيانات.
- ملف Excel الأصلي لا يُحفظ في D1 ولا في أي Object Storage.
- يُقرأ ملف Excel ويُعالج مؤقتًا أثناء عملية التحليل فقط.
- يتم حفظ نتيجة التحليل اللازمة لإعادة عرض التقرير في D1.
- قد تتضمن نتيجة التحليل بيانات مشتقة من الاستبيان، بما في ذلك المؤشرات والتجميعات ونصوص الإجابات المفتوحة المستخدمة في التقرير.
- جميع طلبات القراءة والتصدير تتحقق من ملكية مساحة المتصفح.
- تستخدم مساحة المتصفح ملفات ارتباط `HttpOnly` و`SameSite=Strict`.
- عند HTTPS يستخدم اسم ارتباط يبدأ بـ `__Host-` مع `Secure`.
- لا تُرفع ملفات المصدر إلى Git ولا يتم تضمينها في المستودع.
- لا تُسجل ردود المشاركين في سجلات الأخطاء.
- إعادة فتح الموقع من جهاز أو متصفح آخر لا تستعيد مساحة العمل تلقائيًا.
- صلاحيات المشاركة بين الأجهزة ليست ضمن هذه النسخة.

## حدود المعالجة

- حتى 20 ملفًا في الدفعة الواحدة.
- حتى 16 MB لكل ملف.
- حتى 50,000 استجابة.
- حتى 256 عمودًا.
- توجد حدود إضافية لحماية النظام من ملفات Excel المضغوطة أو المتوسعة بشكل غير طبيعي.
- تعالج ملفات الدفعة بالتتابع.
- مساحة المتصفح تدعم حتى 100 تقرير محفوظ وفق حدود التطبيق.

## قاعدة البيانات

تستخدم المنصة Cloudflare D1 من خلال Binding باسم:

```text
DB
```

قاعدة بيانات الإنتاج:

```text
survey-quality-seetah-db
```

جدول التقارير الرئيسي:

```text
reports
```

ويتضمن بيانات التقرير ونتيجة التحليل المخزنة في:

```text
analysis_json
```

ملفات migrations موجودة في:

```text
drizzle/
```

ولا ينبغي تعديل migration قديمة بعد تطبيقها على قاعدة الإنتاج. أي تغيير مستقبلي في بنية قاعدة البيانات يجب إضافته في migration جديدة.

## النشر

المستودع يستخدم GitHub لإدارة المصدر ومراجعة التغييرات.

سير GitHub Actions يتحقق من جودة المشروع من خلال فحوصات مثل TypeScript وLint والاختبارات والبناء قبل اعتماد التغييرات.

بيئة الإنتاج تستخدم Cloudflare مع قاعدة D1.

قبل أي نشر إنتاجي يجب التأكد من:

- نجاح فحوصات GitHub Actions.
- ارتباط Binding باسم `DB` بقاعدة `survey-quality-seetah-db`.
- تطبيق migrations المطلوبة.
- نجاح Build الإنتاج.
- اختبار رفع ملف Excel وتحليله.
- اختبار إعادة فتح النتائج المحفوظة.
- اختبار PowerPoint وWord.
- اختبار العربية والإنجليزية.
- التأكد من عدم تخزين ملف Excel الأصلي بشكل دائم.

## English

Survey Quality Hub is a bilingual survey-quality analysis and reporting application with anonymous browser-scoped workspaces, Excel ingestion, weighted metrics, hierarchical CES analysis, data-quality reconciliation, historical source-value registers, and editable PPTX/DOCX exports.

Source Excel workbooks are **not permanently stored on the server**.

An uploaded workbook is read and processed temporarily for analysis. The original workbook is not stored in Cloudflare D1 or object storage. Only the report metadata and analysis result required by the application are persisted in Cloudflare D1.

If a report requires reanalysis after survey settings are confirmed and the original workbook is no longer available temporarily in the browser, the same workbook must be supplied again. The application verifies that it matches the original report before reanalysis.

The application uses a secure anonymous browser workspace. Clearing the associated browser cookie can remove access to reports belonging to that workspace.

Cloudflare D1 is the application's persistent production data store. The application does not use R2 for source workbook storage.

Persisted analysis results may include derived survey information, aggregates, metrics, and open-response text required to display and export the analysis.

Source spreadsheets and private fixtures are excluded from version control.

The Excel parser uses the [official SheetJS 0.20.3 distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

The checked-in report theme is a sanitized extraction of the user-supplied PowerPoint template and is ready for builds. `scripts/prepare-theme.mjs` is only needed when replacing that theme.

The native chart template was authored with the presentation artifact runtime and sanitized before check-in. Builds use `lib/report-chart-theme.json` directly.

Its optional preparation script requires the private authoring bundle, not survey data.

`scripts/ces-export-test.mjs` verifies both language exports against a local `CES_FIXTURE`, including native chart caches and embedded workbooks. No private fixture is uploaded to CI.
