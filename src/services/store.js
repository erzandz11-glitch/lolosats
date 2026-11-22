import { supabase, hasSupabaseConfig } from './supabase.js';
import { blankResume, normalizeResume } from '../utils/helpers.js';

const LEGACY_KEY = 'lolosats_workspace_v2';
const cacheKey = userId => userId ? `lolosats_workspace_user_${userId}` : LEGACY_KEY;

function readCache(userId = null) {
  try {
    const raw = localStorage.getItem(cacheKey(userId)) || (!userId ? localStorage.getItem('lolosats_workspace_v1') : null);
    const saved = raw ? JSON.parse(raw) : null;
    if (Array.isArray(saved?.resumes) && saved.resumes.length) {
      return { resumes: saved.resumes.map(normalizeResume), activeId: saved.activeId || saved.resumes[0].id };
    }
  } catch (error) {
    console.warn('Cache LolosATS tidak dapat dibaca:', error);
  }
  return null;
}

export const store = {
  user: null,
  resumes: [],
  activeId: null,
  mode: hasSupabaseConfig ? 'cloud' : 'local',
  syncError: null,
  get active() {
    return this.resumes.find(item => item.id === this.activeId) || this.resumes[0] || null;
  },
  loadWorkspace(userId = null) {
    const saved = readCache(userId);
    this.resumes = saved?.resumes || [];
    this.activeId = saved?.activeId || this.resumes[0]?.id || null;
    if (!this.resumes.length) {
      const resume = blankResume('CV Pertama Saya');
      this.resumes = [resume];
      this.activeId = resume.id;
      this.persistLocal();
    }
  },
  async init() {
    if (supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      this.user = data.session?.user || null;
    }
    if (this.user) {
      try {
        await this.fetch();
      } catch (error) {
        this.syncError = error;
        this.loadWorkspace(this.user.id);
      }
    } else {
      this.loadWorkspace();
    }
  },
  persistLocal() {
    const key = cacheKey(this.user?.id || null);
    localStorage.setItem(key, JSON.stringify({ resumes: this.resumes, activeId: this.activeId }));
  },
  async fetch() {
    if (!supabase || !this.user) return;
    const { data, error } = await supabase.from('resumes')
      .select('id,title,content,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    this.resumes = (data || []).map(item => normalizeResume({
      ...item.content, id: item.id, title: item.title, updated_at: item.updated_at
    }));
    if (this.resumes.length) this.activeId = this.resumes[0].id;
    else this.activeId = null;
    if (!this.resumes.length) {
      const resume = blankResume('CV Pertama Saya');
      this.resumes = [resume];
      this.activeId = resume.id;
      await this.save(resume);
    } else {
      this.persistLocal();
    }
    this.syncError = null;
  },
  async save(resume) {
    resume.updated_at = new Date().toISOString();
    this.persistLocal();
    if (supabase && this.user) {
      const { error } = await supabase.from('resumes').upsert({
        id: resume.id,
        user_id: this.user.id,
        title: resume.title,
        content: resume,
        updated_at: resume.updated_at
      });
      if (error) {
        this.syncError = error;
        throw error;
      }
      this.syncError = null;
    }
  },
  async create() {
    const resume = blankResume(`CV ${this.resumes.length + 1}`);
    this.resumes.unshift(resume);
    this.activeId = resume.id;
    await this.save(resume);
    return resume;
  },
  async remove(id) {
    if (this.resumes.length === 1) throw new Error('Minimal harus ada satu CV.');
    this.resumes = this.resumes.filter(item => item.id !== id);
    if (this.activeId === id) this.activeId = this.resumes[0].id;
    this.persistLocal();
    if (supabase && this.user) {
      const { error } = await supabase.from('resumes').delete().eq('id', id);
      if (error) throw error;
    }
  },
  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    try {
      await this.fetch();
    } catch (error) {
      this.syncError = error;
      this.loadWorkspace(this.user.id);
    }
  },
  async signUp(email, password) {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    this.user = data.session?.user || null;
    if (this.user) {
      try { await this.fetch(); }
      catch (error) { this.syncError = error; this.loadWorkspace(this.user.id); }
    }
    return data;
  },
  async resetPassword(email) {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
    if (!email) throw new Error('Masukkan email akun terlebih dahulu.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    });
    if (error) throw error;
  },
  async signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    this.user = null;
    this.syncError = null;
    this.loadWorkspace();
  }
};
