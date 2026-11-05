/** Validate builder documents before saving or publishing.
 * No arbitrary HTML, scripts or CSS are accepted. */
export const WIDGET_TYPES = ['heading','text','image','button','features','quote','faq','signup','divider','spacer','testimonials','iconGrid','imageText'] as const;
export type BuilderWidget = {
  id: string; type: typeof WIDGET_TYPES[number]; title?: string; text?: string;
  image?: string; url?: string; label?: string; align?: string;
  icon?: string; imagePosition?: string; columns?: number;
  imageWidth?: number; imageHeight?: number; imageBytes?: number; imageMime?: string;
  fontSize?: number; color?: string; background?: string;
  items?: Array<{ title?: string; text?: string; role?: string; image?: string; icon?: string }>;
};
export type BuilderSection = {
  id: string; label: string; columns: number; background: string;
  color: string; padding: number; backgroundImage?: string;
  widgets: BuilderWidget[];
};
export type BuilderPage = {
  title: string; font: string; headerColor: string; accentColor: string;
  logoImage?: string; brandName?: string; brandSubtitle?: string; footerText?: string;
  privacyTitle?: string; privacyText?: string;
  menuItems?: Array<{id: string;label: string;href: string}>;
  sections: BuilderSection[];
};
const SAFE_ICONS = new Set(['users','lightbulb','star','target','coffee','check','globe','briefcase','handshake','rocket','heart','calendar','award','zap','message','shield','book','sparkles','network','megaphone']);
const safeColor = (x: unknown): x is string => typeof x === 'string' && /^#[\da-fA-F]{6}$/.test(x);
const safeUrl = (x: unknown): boolean => typeof x !== 'string' || x === '' || (x.length <= 800 && (/^https:\/\//i.test(x) || /^\/(?!\/)/.test(x) || /^#[\w-]+$/.test(x)));
const textLen = (x: unknown, max: number): boolean => x === undefined || (typeof x === 'string' && x.length <= max);
export function validatePage(input: unknown): input is BuilderPage {
  if (!input || typeof input!=='object' || Array.isArray(input)) return false;
  const p = input as BuilderPage;
  if (!textLen(p.title,120) || typeof p.title!=='string' || !['sans','serif','modern'].includes(p.font) ||
      !safeColor(p.headerColor) || !safeColor(p.accentColor) ||
      !textLen(p.brandName,90) || !textLen(p.brandSubtitle,45) || !textLen(p.footerText,240) || !textLen(p.privacyTitle,120) || !textLen(p.privacyText,12000) ||
      !safeUrl(p.logoImage) || (p.menuItems!==undefined && (
        !Array.isArray(p.menuItems) || p.menuItems.length>16 ||
        p.menuItems.some(link=>!link || typeof link.id!=='string' || !/^[\w-]{4,64}$/.test(link.id) ||
          typeof link.label!=='string' || !link.label.trim() || !textLen(link.label,50) ||
          typeof link.href!=='string' || !link.href.trim() || !safeUrl(link.href))
      )) || !Array.isArray(p.sections) ||
      p.sections.length < 1 || p.sections.length > 35) return false;
  let total=0;
  const ids=new Set<string>();
  for (const section of p.sections) {
    if (!section || typeof section!=='object' || typeof section.id!=='string' || !/^[\w-]{4,64}$/.test(section.id) ||
        ids.has(section.id) || !textLen(section.label,90) || ![1,2,3,4].includes(section.columns) ||
        !safeColor(section.background) || !safeColor(section.color) ||
        !Number.isInteger(section.padding) || section.padding < 16 || section.padding > 160 ||
        !safeUrl(section.backgroundImage) || !Array.isArray(section.widgets) || section.widgets.length > 24) return false;
    ids.add(section.id);
    for (const w of section.widgets) {
      total++;
      if (!w || typeof w.id!=='string' || !/^[\w-]{4,64}$/.test(w.id) || ids.has(w.id) ||
          !WIDGET_TYPES.includes(w.type) || !textLen(w.title,160) || !textLen(w.text,4000) ||
          !textLen(w.label,100) || !safeUrl(w.image) || !safeUrl(w.url) ||
          (w.icon!==undefined && !SAFE_ICONS.has(w.icon)) ||
          (w.imagePosition!==undefined && !['left','right'].includes(w.imagePosition)) ||
          (w.columns!==undefined && ![2,3,4].includes(w.columns)) ||
          (w.color && !safeColor(w.color)) || (w.background && !safeColor(w.background)) ||
          (w.imageWidth!==undefined && (!Number.isInteger(w.imageWidth) || w.imageWidth<1 || w.imageWidth>4096)) ||
          (w.imageHeight!==undefined && (!Number.isInteger(w.imageHeight) || w.imageHeight<1 || w.imageHeight>4096)) ||
          (w.imageBytes!==undefined && (!Number.isInteger(w.imageBytes) || w.imageBytes<1 || w.imageBytes>921600)) ||
          (w.imageMime!==undefined && w.imageMime!=='image/webp') ||
          (w.fontSize!==undefined && (!Number.isInteger(w.fontSize) || w.fontSize<10 || w.fontSize>90)) ||
          (w.align && !['left','center','right'].includes(w.align)) ||
          (w.items && (!Array.isArray(w.items) || w.items.length>15 || w.items.some(x=>!x || !textLen(x.title,160) || !textLen(x.text,1200) || !textLen(x.role,120) || !safeUrl(x.image) || (x.icon!==undefined && !SAFE_ICONS.has(x.icon)))))) return false;
      ids.add(w.id);
    }
  }
  return total<=150 && JSON.stringify(p).length <= 120_000;
}
