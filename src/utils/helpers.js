export const uid = () => crypto.randomUUID();
export const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
export const todayID = () => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric'
}).format(new Date());

export const blankResume = (title = 'CV Baru') => ({
  id: uid(),
  title,
  updated_at: new Date().toISOString(),
  profile: {
    nama: '', jabatan: '', email: '', telepon: '', lokasi: '',
    linkedin: '', website: '', ringkasan: ''
  },
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  certifications: '',
  jobDescription: '',
  coverLetter: { perusahaan: '', posisi: '', perekrut: '', tipe: 'Full-time', text: '' },
  template: 'modern'
});

const objectOrEmpty = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const stringList = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 200) : [];

export function normalizeResume(raw = {}) {
  const source = objectOrEmpty(raw);
  const base = blankResume(source.title || 'CV Baru');
  const profile = objectOrEmpty(source.profile);
  const coverLetter = objectOrEmpty(source.coverLetter);
  const experiences = Array.isArray(source.experiences) ? source.experiences.slice(0, 100).map(item => {
    const entry = objectOrEmpty(item);
    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : uid(),
      posisi: String(entry.posisi || ''), perusahaan: String(entry.perusahaan || ''),
      lokasi: String(entry.lokasi || ''), mulai: String(entry.mulai || ''),
      selesai: String(entry.selesai || ''), deskripsi: String(entry.deskripsi || '')
    };
  }) : [];
  const education = Array.isArray(source.education) ? source.education.slice(0, 100).map(item => {
    const entry = objectOrEmpty(item);
    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : uid(),
      gelar: String(entry.gelar || ''), institusi: String(entry.institusi || ''),
      mulai: String(entry.mulai || ''), selesai: String(entry.selesai || ''),
      catatan: String(entry.catatan || '')
    };
  }) : [];
  const template = ['modern', 'minimal', 'executive'].includes(source.template) ? source.template : 'modern';
  return {
    ...base,
    ...source,
    id: typeof source.id === 'string' && source.id ? source.id : base.id,
    title: String(source.title || base.title).slice(0, 120),
    profile: Object.fromEntries(Object.entries({ ...base.profile, ...profile }).map(([key, value]) => [key, String(value ?? '')])),
    coverLetter: Object.fromEntries(Object.entries({ ...base.coverLetter, ...coverLetter }).map(([key, value]) => [key, String(value ?? '')])),
    experiences,
    education,
    skills: stringList(source.skills),
    languages: stringList(source.languages),
    certifications: String(source.certifications || ''),
    jobDescription: String(source.jobDescription || ''),
    template
  };
}
