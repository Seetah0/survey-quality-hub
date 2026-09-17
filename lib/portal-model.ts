import type { Analysis, Lang } from './analysis';
import type { CourseReport } from './course-report';
export type Section = 'courses' | 'students' | 'employees';
export type Dataset = {
  id: string;
  name: string;
  hash: string;
  created: string;
  year: number;
  section: Section;
  analysis?: Analysis;
  course?: CourseReport;
};
export type ExportRequest = {
  items: Dataset[];
  lang: Lang;
  format: 'pptx' | 'docx' | 'xlsx' | 'preview';
};
