import './styles.css';
import {store} from './services/store.js';
import {supabase,hasSupabaseConfig} from './services/supabase.js';
import {analyzeResume,tokens} from './services/analysis.js';
import {esc,todayID,uid,normalizeResume} from './utils/helpers.js';
import {Document,Packer,Paragraph,TextRun,HeadingLevel} from 'docx';
import {saveAs} from 'file-saver';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let screen='profil',analysis=null,previewMode='cv',saveTimer=null,pendingSaveResolve=null;
const app=$('#app');

function toast(msg){
  const t=$('#toast');
  if(!t)return;
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2400);
}

function field(label,key,value='',type='text',full=false,idPrefix=''){
  const id=(idPrefix?`${idPrefix}_`:'f_')+key.replace(/[^a-zA-Z0-9_]/g,'_');
  return `<label class="field ${full?'full':''}" for="${id}">${label}<input id="${id}" name="${esc(key)}" data-bind="${key}" type="${type}" value="${esc(value)}"></label>`;
}

function textarea(label,key,value='',rows=4,idPrefix=''){
  const id=(idPrefix?`${idPrefix}_`:'f_')+key.replace(/[^a-zA-Z0-9_]/g,'_');
  return `<label class="field full" for="${id}">${label}<textarea id="${id}" name="${esc(key)}" data-bind="${key}" rows="${rows}">${esc(value)}</textarea></label>`;
}

function render(){
  const r=store.active;
  if(!r)return;
  app.innerHTML=`<header class="top"><div class="brand"><div class="logo">LA</div><div>LolosATS<div class="muted small" style="font-weight:400">CV Builder & Career Workspace</div></div></div><div class="actions"><span class="muted small">${store.user?esc(store.user.email):'Mode lokal'} · ${hasSupabaseConfig?'Cloud siap':'Cloud belum dikonfigurasi'}</span><button class="btn" id="authBtn">${store.user?'Keluar':'Masuk / Daftar'}</button></div></header>
<div class="shell"><aside class="sidebar"><div class="side-title">Workspace</div><div class="nav">${[['profil','Profil'],['pengalaman','Pengalaman'],['pendidikan','Pendidikan'],['keahlian','Keahlian'],['ats','Analisis ATS'],['surat','Surat Lamaran']].map(([k,v])=>`<button data-screen="${k}" class="${screen===k?'active':''}">${v}</button>`).join('')}</div><div class="side-title" style="margin-top:18px">Dokumen CV</div><select id="resumeSelect" class="input" aria-label="Pilih dokumen CV">${store.resumes.map(x=>`<option value="${esc(x.id)}" ${x.id===r.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select><button class="btn primary" id="newResume" style="width:100%;margin-top:8px">+ CV Baru</button><button class="btn danger" id="deleteResume" style="width:100%;margin-top:7px">Hapus CV ini</button><button class="btn" id="activateLicense" style="width:100%;margin-top:7px">Aktifkan lisensi</button><button class="btn" id="adminLicenses" style="width:100%;margin-top:7px">Admin lisensi</button><button class="btn" id="exportBackup" style="width:100%;margin-top:7px">Backup JSON</button><label class="btn" style="display:block;text-align:center;margin-top:7px" for="importBackup">Import JSON<input id="importBackup" type="file" accept="application/json,.json" hidden></label><div class="notice">Data tersimpan otomatis di perangkat. Login Supabase akan mengaktifkan sinkronisasi cloud setelah konfigurasi selesai.</div></aside>
<section class="workspace"><div class="panel"><div class="row" style="justify-content:space-between"><div><h2>${({profil:'Data Diri',pengalaman:'Pengalaman',pendidikan:'Pendidikan',keahlian:'Keahlian & Sertifikasi',ats:'Analisis ATS',surat:'Surat Lamaran'})[screen]}</h2><p class="hint">${({profil:'Lengkapi informasi profesional yang ingin ditampilkan di CV.',pengalaman:'Masukkan pengalaman kerja, magang, proyek, atau organisasi.',pendidikan:'Tambahkan riwayat pendidikan dan pelatihan.',keahlian:'Cantumkan kemampuan yang benar-benar kamu kuasai.',ats:'Bandingkan isi CV dengan deskripsi lowongan secara transparan.',surat:'Buat surat lamaran berdasarkan data yang sudah kamu isi.'})[screen]}</p></div><input id="resumeTitle" class="input" style="max-width:160px" value="${esc(r.title)}" aria-label="Nama dokumen"></div>
<div class="screen ${screen==='profil'?'active':''}" data-panel="profil"><div class="formgrid">${field('Nama lengkap','profile.nama',r.profile.nama)}${field('Posisi target','profile.jabatan',r.profile.jabatan)}${field('Email','profile.email',r.profile.email,'email')}${field('Nomor telepon','profile.telepon',r.profile.telepon)}${field('Domisili','profile.lokasi',r.profile.lokasi)}${field('LinkedIn','profile.linkedin',r.profile.linkedin)}${field('Website / portofolio','profile.website',r.profile.website)}${textarea('Ringkasan profil','profile.ringkasan',r.profile.ringkasan,4)}</div></div>
<div class="screen ${screen==='pengalaman'?'active':''}" data-panel="pengalaman"><div id="experienceList">${r.experiences.map((x,i)=>entryExperience(x,i)).join('')}</div><button class="btn" id="addExperience">+ Tambah pengalaman</button></div>
<div class="screen ${screen==='pendidikan'?'active':''}" data-panel="pendidikan"><div id="educationList">${r.education.map((x,i)=>entryEducation(x,i)).join('')}</div><button class="btn" id="addEducation">+ Tambah pendidikan</button></div>
<div class="screen ${screen==='keahlian'?'active':''}" data-panel="keahlian"><label class="field" for="skillInput">Tambah keahlian<div class="row"><input id="skillInput" class="input" placeholder="Contoh: Excel, React, Akuntansi"><button class="btn primary" id="addSkill" type="button">Tambah</button></div></label><div class="chips">${r.skills.map((x,i)=>`<span class="chip">${esc(x)} <button type="button" data-remove-skill="${i}" aria-label="Hapus keahlian ${esc(x)}">×</button></span>`).join('')}</div><label class="field" for="languageInput" style="margin-top:22px">Tambah bahasa<div class="row"><input id="languageInput" class="input" placeholder="Contoh: Bahasa Inggris"><button class="btn primary" id="addLanguage" type="button">Tambah</button></div></label><div class="chips">${r.languages.map((x,i)=>`<span class="chip">${esc(x)} <button type="button" data-remove-language="${i}" aria-label="Hapus bahasa ${esc(x)}">×</button></span>`).join('')}</div>${textarea('Sertifikasi / penghargaan','certifications',r.certifications,4)}</div>
<div class="screen ${screen==='ats'?'active':''}" data-panel="ats">${textarea('Deskripsi lowongan kerja','jobDescription',r.jobDescription,9)}<button class="btn primary" id="analyzeBtn" type="button">Analisis kecocokan</button>${analysis?renderAnalysis(analysis):'<div class="notice">Hasil analisis akan muncul di sini. Masukkan deskripsi lowongan yang cukup lengkap.</div>'}</div>
<div class="screen ${screen==='surat'?'active':''}" data-panel="surat"><div class="formgrid">${field('Nama perusahaan','coverLetter.perusahaan',r.coverLetter.perusahaan)}${field('Posisi yang dilamar','coverLetter.posisi',r.coverLetter.posisi)}${field('Nama perekrut (opsional)','coverLetter.perekrut',r.coverLetter.perekrut)}<label class="field" for="f_coverLetter_tipe">Tipe pekerjaan<select id="f_coverLetter_tipe" name="coverLetter.tipe" data-bind="coverLetter.tipe"><option ${r.coverLetter.tipe==='Full-time'?'selected':''}>Full-time</option><option ${r.coverLetter.tipe==='Kontrak'?'selected':''}>Kontrak</option><option ${r.coverLetter.tipe==='Magang'?'selected':''}>Magang</option><option ${r.coverLetter.tipe==='Freelance'?'selected':''}>Freelance</option></select></label></div><button class="btn primary" id="generateLetter" type="button">Buat surat lamaran</button>${textarea('Hasil surat (bisa diedit)','coverLetter.text',r.coverLetter.text,12)}</div>
</div></section>
<section class="preview"><div class="toolbar"><strong>Preview dokumen</strong><select id="previewMode" class="input" style="width:auto" aria-label="Mode preview"><option value="cv" ${previewMode==='cv'?'selected':''}>CV</option><option value="letter" ${previewMode==='letter'?'selected':''}>Surat</option></select><span class="spacer"></span><select id="templateSelect" class="input" style="width:auto" aria-label="Template CV"><option value="modern" ${r.template==='modern'?'selected':''}>Modern</option><option value="minimal" ${r.template==='minimal'?'selected':''}>Minimalis</option><option value="executive" ${r.template==='executive'?'selected':''}>Eksekutif</option></select><button class="btn" id="exportDocx">Export DOCX</button><button class="btn primary" id="exportPdf">Export PDF</button></div><div class="paper-wrap"><article class="paper ${r.template}" id="paper">${previewMode==='cv'?buildPaper(r):buildLetterPaper(r)}</article></div></section></div><div class="modal" id="modal"><div class="dialog" id="dialog"></div></div><div class="toast" id="toast"></div>`;
  bind();
}

function entryExperience(x,i){
  const p=`exp_${x.id}`;
  return `<div class="entry" data-entry="experience" data-id="${esc(x.id)}"><div class="entry-head"><span>Pengalaman ${i+1}</span><button class="btn danger" type="button" data-delete-entry>Hapus</button></div><div class="formgrid">${field('Posisi','posisi',x.posisi,'text',false,p)}${field('Perusahaan','perusahaan',x.perusahaan,'text',false,p)}${field('Lokasi','lokasi',x.lokasi,'text',false,p)}${field('Mulai','mulai',x.mulai,'text',false,p)}${field('Selesai','selesai',x.selesai,'text',false,p)}${textarea('Pencapaian (satu poin per baris)','deskripsi',x.deskripsi,4,p)}</div></div>`;
}

function entryEducation(x,i){
  const p=`edu_${x.id}`;
  return `<div class="entry" data-entry="education" data-id="${esc(x.id)}"><div class="entry-head"><span>Pendidikan ${i+1}</span><button class="btn danger" type="button" data-delete-entry>Hapus</button></div><div class="formgrid">${field('Jenjang / jurusan','gelar',x.gelar,'text',false,p)}${field('Institusi','institusi',x.institusi,'text',false,p)}${field('Mulai','mulai',x.mulai,'text',false,p)}${field('Selesai','selesai',x.selesai,'text',false,p)}${field('IPK / catatan','catatan',x.catatan,'text',false,p)}</div></div>`;
}

function buildPaper(r){
  const p=r.profile,contact=[p.email,p.telepon,p.lokasi,p.linkedin,p.website].filter(Boolean).map(esc).join(' · ');
  let h=`<header><h1>${esc(p.nama||'Nama Lengkap')}</h1><div class="role">${esc(p.jabatan)}</div><div class="contact">${contact}</div></header>`;
  if(p.ringkasan)h+=`<section><h3>Ringkasan Profil</h3><div>${esc(p.ringkasan)}</div></section>`;
  if(r.experiences.length)h+=`<section><h3>Pengalaman Kerja</h3>${r.experiences.map(x=>`<div class="job"><div class="jobtop"><b>${esc(x.posisi)}</b><span class="date">${esc([x.mulai,x.selesai].filter(Boolean).join(' – '))}</span></div><b>${esc([x.perusahaan,x.lokasi].filter(Boolean).join(' · '))}</b><ul>${(x.deskripsi||'').split('\n').filter(y=>y.trim()).map(y=>`<li>${esc(y)}</li>`).join('')}</ul></div>`).join('')}</section>`;
  if(r.education.length)h+=`<section><h3>Pendidikan</h3>${r.education.map(x=>`<div class="job"><div class="jobtop"><b>${esc(x.gelar)}</b><span class="date">${esc([x.mulai,x.selesai].filter(Boolean).join(' – '))}</span></div>${esc(x.institusi)} ${esc(x.catatan)}</div>`).join('')}</section>`;
  if(r.skills.length)h+=`<section><h3>Keahlian</h3><div class="tags">${r.skills.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`;
  if(r.languages.length)h+=`<section><h3>Bahasa</h3><div class="tags">${r.languages.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`;
  if(r.certifications)h+=`<section><h3>Sertifikasi & Penghargaan</h3><ul>${r.certifications.split('\n').filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
  return h;
}

function buildLetterPaper(r){
  return r.coverLetter.text?`<div style="white-space:pre-wrap;line-height:1.8">${esc(r.coverLetter.text)}</div>`:'<i class="muted">Belum ada surat lamaran. Buat surat melalui menu Surat Lamaran.</i>';
}

function downloadBackup(){
  const payload={format:'lolosats-backup-v1',exported_at:new Date().toISOString(),resumes:store.resumes};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='lolosats-backup.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Backup berhasil dibuat.');
}

async function importBackup(file){
  const inputEl=$('#importBackup');
  if(!file)return;
  try{
    if(file.size>10*1024*1024)throw new Error('Ukuran backup maksimal 10 MB.');
    const data=JSON.parse(await file.text());
    if(data.format!=='lolosats-backup-v1'||!Array.isArray(data.resumes)||!data.resumes.length||data.resumes.length>100)
      throw new Error('Format backup tidak dikenali atau jumlah CV melebihi batas.');
    if(!confirm(`Impor ${data.resumes.length} dokumen? Dokumen akan ditambahkan ke workspace ini.`))return;
    for(const item of data.resumes){
      const copy=normalizeResume({...item,id:uid(),title:(item.title||'CV')+' (Impor)'});
      store.resumes.push(copy);
      if(store.user)await store.save(copy);
    }
    store.activeId=store.resumes.at(-1).id;
    store.persistLocal();
    render();
    toast('Backup berhasil diimpor.');
  }catch(e){
    toast(e.message||'Gagal membaca backup.');
  }finally{
    if(inputEl)inputEl.value='';
  }
}

function renderAnalysis(a){
  return `<div class="result"><div class="score">${a.score}/100</div><b>Estimasi kecocokan</b><div class="muted small">Kata kunci ${a.keywordScore}% · Struktur ${a.formatScore}%</div><p>${a.disclaimer}</p><h4>Kata kunci ditemukan (${a.matched.length})</h4><div class="chips">${a.matched.map(x=>`<span class="chip">${esc(x)}</span>`).join('')||'Belum ada'}</div><h4>Kata kunci belum ditemukan (${a.missing.length})</h4><div class="chips">${a.missing.map(x=>`<span class="chip">${esc(x)}</span>`).join('')||'Tidak ada'}</div><h4>Checklist</h4>${a.checks.map(x=>`<p>${x[1]?'✓':'○'} ${esc(x[0])}${x[1]?'':` — <span class="muted">${esc(x[2])}</span>`}</p>`).join('')}</div>`;
}

function bind(){
  const r=store.active;
  $$('[data-screen]').forEach(b=>b.onclick=()=>{screen=b.dataset.screen;analysis=null;render()});
  $('#resumeSelect').onchange=e=>{store.activeId=e.target.value;render()};
  $('#newResume').onclick=async()=>{
    try{
      await store.create();
      screen='profil';
      render();
      toast('CV baru berhasil dibuat.');
    }catch(e){
      toast(e.message);
    }
  };
  $('#deleteResume').onclick=async()=>{
    if(confirm('Hapus CV ini?')) {
      try{
        await store.remove(r.id);
        render();
        toast('CV berhasil dihapus.');
      }catch(e){
        toast(e.message);
      }
    }
  };
  $('#resumeTitle').addEventListener('input',e=>{
    r.title=e.target.value;
    const opt=document.querySelector(`#resumeSelect option[value="${r.id}"]`);
    if(opt)opt.textContent=r.title;
    persist(false);
  });
  $('#resumeTitle').addEventListener('change',async e=>{
    r.title=e.target.value;
    const opt=document.querySelector(`#resumeSelect option[value="${r.id}"]`);
    if(opt)opt.textContent=r.title;
    await persist(true);
  });
  $('#templateSelect').onchange=e=>{
    r.template=e.target.value;
    render();
    persist(false);
  };
  $('#previewMode').onchange=e=>{previewMode=e.target.value;render()};

  $$('[data-bind]').filter(el=>!el.closest('[data-entry]')).forEach(el=>{
    const updateHandler=async()=>{
      const path=el.dataset.bind.split('.');
      let target=r;
      for(const k of path.slice(0,-1))target=target[k];
      target[path.at(-1)]=el.value;
      const paper=$('#paper');
      if(paper)paper.innerHTML=previewMode==='cv'?buildPaper(r):buildLetterPaper(r);
      await persist(false);
    };
    el.addEventListener('input',updateHandler);
    if(el.tagName==='SELECT')el.addEventListener('change',updateHandler);
  });

  ['experience','education'].forEach(kind=>{
    const list=kind==='experience'?r.experiences:r.education;
    document.querySelectorAll(`[data-entry="${kind}"]`).forEach(card=>{
      card.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',async()=>{
        const item=list.find(x=>x.id===card.dataset.id);
        if(item)item[el.dataset.bind]=el.value;
        const paper=$('#paper');
        if(paper)paper.innerHTML=previewMode==='cv'?buildPaper(r):buildLetterPaper(r);
        await persist(false);
      }));
      card.querySelector('[data-delete-entry]').onclick=()=>{
        const i=list.findIndex(x=>x.id===card.dataset.id);
        if(i>=0)list.splice(i,1);
        render();
        persist(false);
      };
    });
  });

  $('#addExperience')?.addEventListener('click',()=>{
    r.experiences.push({id:uid(),posisi:'',perusahaan:'',lokasi:'',mulai:'',selesai:'',deskripsi:''});
    render();
    persist(false);
  });
  $('#addEducation')?.addEventListener('click',()=>{
    r.education.push({id:uid(),gelar:'',institusi:'',mulai:'',selesai:'',catatan:''});
    render();
    persist(false);
  });

  const doAddSkill=()=>{
    const inp=$('#skillInput');
    const v=inp.value.trim();
    if(v&&!r.skills.includes(v)){
      r.skills.push(v);
      render();
      persist(false);
    }
  };
  const doAddLanguage=()=>{
    const inp=$('#languageInput');
    const v=inp.value.trim();
    if(v&&!r.languages.includes(v)){
      r.languages.push(v);
      render();
      persist(false);
    }
  };

  $('#addSkill')?.addEventListener('click',doAddSkill);
  $('#skillInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doAddSkill();}});
  $('#addLanguage')?.addEventListener('click',doAddLanguage);
  $('#languageInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doAddLanguage();}});

  $$('[data-remove-skill]').forEach(b=>b.onclick=()=>{
    r.skills.splice(+b.dataset.removeSkill,1);
    render();
    persist(false);
  });
  $$('[data-remove-language]').forEach(b=>b.onclick=()=>{
    r.languages.splice(+b.dataset.removeLanguage,1);
    render();
    persist(false);
  });

  $('#analyzeBtn')?.addEventListener('click',()=>{
    try{
      analysis=analyzeResume(r);
      render();
    }catch(e){
      toast(e.message);
    }
  });

  $('#generateLetter')?.addEventListener('click',()=>{
    const c=r.coverLetter;
    if(!c.perusahaan||!c.posisi){
      toast('Isi nama perusahaan dan posisi terlebih dahulu.');
      return;
    }
    const kwTokens=tokens(r.jobDescription||'').slice(0,4);
    const kw=kwTokens.length?kwTokens.join(', '):'';
    c.text=`${todayID()}\n\nYth. ${c.perekrut||'Tim Rekrutmen'}\n${c.perusahaan}\n\nPerihal: Lamaran pekerjaan — ${c.posisi}\n\nDengan hormat,\n\nSaya ${r.profile.nama||'[Nama Anda]'}, bermaksud mengajukan lamaran untuk posisi ${c.posisi} (${c.tipe}) di ${c.perusahaan}. ${r.profile.ringkasan||'Saya memiliki minat untuk berkontribusi dan mengembangkan kemampuan profesional pada posisi ini.'}\n\nKeahlian yang saya miliki meliputi ${(r.skills.slice(0,5).join(', ')||'keahlian yang relevan dengan posisi')}. ${kw?`Saya juga memahami kebutuhan terkait ${kw}.`:''} Saya siap menjelaskan pengalaman dan kualifikasi lebih lanjut dalam proses wawancara.\n\nTerima kasih atas waktu dan pertimbangannya.\n\nHormat saya,\n${r.profile.nama||'[Nama Anda]'}\n${r.profile.telepon||''}\n${r.profile.email||''}`;
    previewMode='letter';
    render();
    toast('Surat lamaran berhasil dibuat.');
    persist(false);
  });

  $('#exportPdf').onclick=()=>window.print();
  $('#exportDocx').onclick=()=>exportDocx(r);
  $('#activateLicense').onclick=()=>showLicense();
  $('#adminLicenses').onclick=()=>showAdminLicenses();
  $('#exportBackup').onclick=()=>downloadBackup();
  $('#importBackup').onchange=e=>importBackup(e.target.files?.[0]);
  $('#authBtn').onclick=()=>{
    if(store.user){
      store.signOut().then(()=>{
        render();
        toast('Berhasil keluar.');
      }).catch(error=>toast(error.message));
      return;
    }
    showAuth();
  };
}

async function persist(show=true){
  const resume=store.active;
  if(!resume)return;
  store.persistLocal();
  if(saveTimer)clearTimeout(saveTimer);
  if(pendingSaveResolve)pendingSaveResolve();
  return new Promise(resolve=>{
    pendingSaveResolve=resolve;
    saveTimer=setTimeout(async()=>{
      try{
        await store.save(resume);
        if(show)toast('Perubahan tersimpan.');
      }catch(e){
        toast('Perubahan tersimpan di perangkat; sinkronisasi cloud gagal.');
      }finally{
        pendingSaveResolve=null;
        saveTimer=null;
        resolve();
      }
    },550);
  });
}

function showAuth(){
  const m=$('#modal');
  m.classList.add('show');
  $('#dialog').innerHTML=`<h2>Masuk ke LolosATS</h2><p class="muted small">Akun cloud membutuhkan konfigurasi Supabase.</p><label class="field" for="authEmail">Email<input id="authEmail" name="email" type="email"></label><label class="field" for="authPassword">Password<input id="authPassword" name="password" type="password"></label><div class="row"><button class="btn primary" id="login" type="button">Masuk</button><button class="btn" id="register" type="button">Daftar</button><button class="btn" id="resetPassword" type="button">Lupa password?</button><button class="btn" id="closeModal" type="button">Tutup</button></div>`;
  $('#closeModal').onclick=()=>m.classList.remove('show');
  $('#login').onclick=async()=>{
    try{
      await store.signIn($('#authEmail').value,$('#authPassword').value);
      m.classList.remove('show');
      render();
      toast('Berhasil masuk.');
    }catch(e){
      toast(e.message);
    }
  };
  $('#register').onclick=async()=>{
    try{
      const result=await store.signUp($('#authEmail').value,$('#authPassword').value);
      if(result.session){
        m.classList.remove('show');
        render();
        toast('Akun berhasil dibuat.');
      }else toast('Pendaftaran diproses. Periksa email untuk konfirmasi.');
    }catch(e){
      toast(e.message);
    }
  };
  $('#resetPassword').onclick=async()=>{
    try{
      await store.resetPassword($('#authEmail').value.trim());
      toast('Tautan pemulihan dikirim jika email terdaftar.');
    }catch(e){
      toast(e.message);
    }
  };
}

function showLicense(){
  const m=$('#modal');
  m.classList.add('show');
  $('#dialog').innerHTML=`<h2>Aktifkan lisensi</h2><p class="muted small">Masukkan kode yang diberikan setelah pembelian. Aktivasi memerlukan akun dan koneksi Supabase.</p><label class="field" for="licenseCode">Kode lisensi<input id="licenseCode" name="licenseCode" class="input" autocomplete="off"></label><div class="row"><button class="btn primary" id="submitLicense" type="button">Aktifkan</button><button class="btn" id="closeModal" type="button">Tutup</button></div>`;
  $('#closeModal').onclick=()=>m.classList.remove('show');
  $('#submitLicense').onclick=async()=>{
    if(!supabase||!store.user){
      toast('Login dan konfigurasi Supabase diperlukan.');
      return;
    }
    try{
      const {data,error}=await supabase.functions.invoke('activate-license',{body:{code:$('#licenseCode').value.trim()}});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      m.classList.remove('show');
      toast(data?.message||'Lisensi aktif.');
    }catch(e){
      toast(e.message||'Aktivasi gagal.');
    }
  };
}

function showAdminLicenses(){
  const m=$('#modal');
  m.classList.add('show');
  $('#dialog').innerHTML=`<h2>Admin lisensi</h2><p class="muted small">Khusus akun admin. Kode mentah hanya ditampilkan sekali saat dibuat.</p><label class="field" for="licenseDays">Masa berlaku (hari, kosong = tanpa batas)<input id="licenseDays" name="licenseDays" class="input" type="number" min="1" max="3650" placeholder="365"></label><div class="row"><button class="btn primary" id="createLicense" type="button">Buat kode lisensi</button><button class="btn" id="refreshLicenses" type="button">Muat daftar</button><button class="btn" id="closeModal" type="button">Tutup</button></div><div id="licenseOutput"></div><div id="licenseList"></div>`;
  $('#closeModal').onclick=()=>m.classList.remove('show');
  const load=async()=>{
    try{
      const {data,error}=await supabase.functions.invoke('admin-license',{body:{action:'list'}});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      $('#licenseList').innerHTML=`<h3>Daftar lisensi</h3>${(data.licenses||[]).map(x=>`<div class="entry"><b>${esc(x.status)}</b><div class="muted small">ID: ${esc(x.id)}<br>Dibuat: ${esc(x.created_at||'-')}<br>Aktif: ${esc(x.activated_at||'Belum')}<br>Kedaluwarsa: ${esc(x.expires_at||'Tanpa batas')}</div>${x.status==='unused'||x.status==='active'?`<button class="btn danger" type="button" data-revoke-license="${esc(x.id)}">Cabut lisensi</button>`:''}</div>`).join('')||'<p class="muted small">Belum ada lisensi.</p>'}`;
      $$('[data-revoke-license]').forEach(button=>button.onclick=async()=>{
        if(!confirm('Cabut lisensi ini? Tindakan ini tidak dapat dibatalkan.'))return;
        try{
          const {data,error}=await supabase.functions.invoke('admin-license',{body:{action:'revoke',id:button.dataset.revokeLicense}});
          if(error)throw error;
          if(data?.error)throw new Error(data.error);
          toast('Lisensi dicabut.');
          await load();
        }catch(e){
          toast(e.message||'Gagal mencabut lisensi.');
        }
      });
    }catch(e){
      $('#licenseList').textContent=e.message||'Gagal memuat daftar lisensi.';
    }
  };
  $('#refreshLicenses').onclick=load;
  $('#createLicense').onclick=async()=>{
    if(!supabase||!store.user){
      toast('Login dan konfigurasi Supabase diperlukan.');
      return;
    }
    try{
      const raw=$('#licenseDays').value.trim();
      const days=raw?Number(raw):null;
      if(raw&&(!Number.isInteger(days)||days<1||days>3650))throw new Error('Masa berlaku harus 1–3650 hari.');
      const {data,error}=await supabase.functions.invoke('admin-license',{body:{action:'create',days}});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      $('#licenseOutput').innerHTML=`<div class="notice"><b>Kode lisensi (salin sekarang):</b><p style="word-break:break-all">${esc(data.code)}</p><button class="btn" id="copyLicense" type="button">Salin kode</button></div>`;
      $('#copyLicense').onclick=()=>navigator.clipboard.writeText(data.code).then(()=>toast('Kode disalin.'));
      await load();
    }catch(e){
      toast(e.message||'Tidak memiliki akses admin atau server belum tersedia.');
    }
  };
  load();
}

async function exportDocx(r){
  try{
    if(previewMode==='letter'){
      if(!r.coverLetter.text.trim())throw new Error('Surat lamaran masih kosong. Buat surat terlebih dahulu.');
      const letterParas=r.coverLetter.text.split('\n').map(line=>new Paragraph({text:line||' '}));
      const letterDoc=new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:letterParas}]});
      const letterBlob=await Packer.toBlob(letterDoc);
      saveAs(letterBlob,`${(r.coverLetter.perusahaan||'Surat-Lamaran').replace(/[^a-z0-9-_]/gi,'_')}.docx`);
      toast('File DOCX surat lamaran berhasil diunduh.');
      return;
    }
    const p=r.profile;
    const paras=[new Paragraph({text:p.nama||'Nama Lengkap',heading:HeadingLevel.TITLE}),new Paragraph({text:p.jabatan||''}),new Paragraph({text:[p.email,p.telepon,p.lokasi,p.linkedin,p.website].filter(Boolean).join(' | ')})];
    if(p.ringkasan){paras.push(new Paragraph({text:'RINGKASAN PROFIL',heading:HeadingLevel.HEADING_2}),new Paragraph(p.ringkasan))}
    for(const [title,items,heading,detail] of [['PENGALAMAN KERJA',r.experiences,'posisi','perusahaan'],['PENDIDIKAN',r.education,'gelar','institusi']]){
      if(!items.length)continue;
      paras.push(new Paragraph({text:title,heading:HeadingLevel.HEADING_2}));
      for(const item of items){
        paras.push(new Paragraph({children:[new TextRun({text:item[heading]||'-',bold:true}),new TextRun({text:`  ${item[detail]||''}  ${[item.mulai,item.selesai].filter(Boolean).join(' - ')}`})]}));
        const description=item.deskripsi||item.catatan||'';
        for(const line of description.split('\n').filter(Boolean))paras.push(new Paragraph({text:line,bullet:{indent:360}}));
      }
    }
    for(const [title,items] of [['KEAHLIAN',r.skills],['BAHASA',r.languages]])if(items.length)paras.push(new Paragraph({text:title,heading:HeadingLevel.HEADING_2}),new Paragraph(items.join(' • ')));
    if(r.certifications)paras.push(new Paragraph({text:'SERTIFIKASI & PENGHARGAAN',heading:HeadingLevel.HEADING_2}),...r.certifications.split('\n').filter(Boolean).map(line=>new Paragraph({text:line,bullet:{indent:360}})));
    const doc=new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:paras}]});
    const blob=await Packer.toBlob(doc);
    saveAs(blob,`${(r.title||'CV').replace(/[^a-z0-9-_]/gi,'_')}.docx`);
    toast('File DOCX CV berhasil diunduh.');
  }catch(error){
    console.error(error);
    toast(error.message||'Gagal mengekspor DOCX. Coba lagi atau periksa isi CV.');
  }
}

(async()=>{
  try{
    await store.init();
    render();
    if(!hasSupabaseConfig)toast('Mode lokal aktif. Hubungkan Supabase untuk akun dan sinkronisasi cloud.');
  }catch(e){
    console.error(e);
    toast(e.message);
  }
})();
