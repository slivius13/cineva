/* === CINEVA RATING SYSTEM & CANVAS EXPORTER === */
(() => {

const criteriaData=[
 {id:'story',name:'Сценарий / Образы',hint:'Логика истории, конфликты и диалоги, выразительность образов и символов; оценивай точность и оригинальность замысла.'},
 {id:'structure',name:'Структура / Ритмика',hint:'Композиция, монтаж, последовательность сцен и управление темпом: как произведение развивается и удерживает внимание.'},
 {id:'craft',name:'Режиссура / Реализация стиля',hint:'Насколько последовательно и выразительно воплощён выбранный стиль: постановка, камера, свет, монтаж, звук и музыка. Учитывай решения, а не бюджет.'},
 {id:'characters',name:'Персонажи / Индивидуальность и харизма',hint:'Самобытность персонажей, достоверность актёрской игры, индивидуальность исполнителей, харизма и химия между ними.'}
];
const root=document.getElementById('criteria');
criteriaData.forEach(c=>{
 const el=document.createElement('div');el.className='criterion';
 el.innerHTML=`<div class="crit-head"><div class="crit-name">${c.name}</div><div class="val" id="val-${c.id}">5</div></div><div class="hint">${c.hint}</div><div class="range-line"><span class="range-edge">1</span><input id="${c.id}" type="range" min="1" max="10" value="5" step="1" aria-label="${c.name}"><span class="range-edge">10</span></div><div class="depth-desc" id="desc-${c.id}">5 из 10 баллов</div>`;
 root.appendChild(el);
});

const $=id=>document.getElementById(id);
const num = id => { const el = $(id); return el ? Number(el.value || 0) : 0; };

const depthDescriptions={
 1:'1 балл — Развлекательный посыл: произведение прежде всего даёт аттракцион, эмоцию или жанровое удовольствие; самостоятельный смысловой слой почти не выражен.',
 2:'2 балла — Простой житейский или жанровый смысл: тема считывается напрямую, конфликт понятен, но трактовка в основном буквальная.',
 3:'3 балла — Личная и психологическая глубина: рефлексия, сложные чувства, внутренние противоречия и размышление о месте человека в мире.',
 4:'4 балла — Социальное и нравственное высказывание: произведение исследует общество, мораль, эпоху или сложные явления и допускает несколько прочтений.',
 5:'5 баллов — Вневременные смыслы: многослойное высказывание об универсальных вопросах, которое не исчерпывается сюжетом или историческим контекстом.'
};

const valueDescriptions={
 rarityGenre:{
  '0.5':'Распространённый жанр с устойчивыми, часто используемыми тропами.',
  '1.0':'Знакомый жанр, но сочетание поджанров или акцентов встречается реже.',
  '1.5':'Редкое сочетание жанров либо нетипичная трактовка привычного направления.',
  '2.0':'Редкий поджанр или смелая жанровая деконструкция.',
  '2.5':'Уникальный жанровый ход или эксперимент, которому трудно подобрать близкие аналоги.'
 },
 rarityFormat:{
  '0.5':'Наиболее распространённый формат исполнения и привычная производственная форма.',
  '1.0':'Стандартный для кино формат без заметно необычных формальных решений.',
  '1.5':'Необычное, но уже известное сочетание способов исполнения или подачи.',
  '2.0':'Редкий формат исполнения — например, гибрид игровых, документальных или анимационных средств, если он необычен для данного контекста.',
  '2.5':'Исключительно редкая или уникальная форма исполнения, определяющая всё произведение.'
 },
 integFormat:{
  '0.5':'Компактный формат: короткометражка, спецэпизод или небольшая подборка отдельных историй.',
  '1.0':'Развёрнутый формат: полнометражное произведение или законченный сезон, рассчитанный на цельное восприятие.'
 },
 integGenre:{
  '0.5':'Сборник эпизодов или жанров: единой идеи, связывающей части, почти нет.',
  '1.0':'В центре две-три самостоятельные идеи; они соседствуют, но связываются не всегда последовательно.',
  '1.5':'Несколько идей или жанров связаны общей темой, хотя цельность временами теряется.',
  '2.0':'Единая идея организует жанр, тональность и развитие произведения.',
  '2.5':'Цельный жанровый эксперимент: необычная форма и все её элементы подчинены общему замыслу.'
 },
 integMeaning:{
  '0.5':'Ясное смысловое высказывание почти отсутствует; события или эпизоды слабо связаны между собой.',
  '1.0':'Есть понятная тема и связное повествование; основные части складываются в законченное целое.',
  '1.5':'Цельное повествование и ясная смысловая линия: сцены, образы и финал усиливают общий замысел.'
 },
 impactScale:{
  '0.5':'Создатель практически неизвестен широкой аудитории; мало заметных упоминаний и работ с существенным охватом.',
  '1.0':'Малоизвестный автор: о нём знают преимущественно в узком жанровом или профессиональном кругу.',
  '1.5':'Узнаваемый создатель с устойчивой аудиторией и заметными работами, коллаборациями или публикациями.',
  '2.0':'Очень известный автор: широкая аудитория, регулярное внимание медиа и заметное присутствие в индустрии.',
  '2.5':'Один из наиболее известных создателей или авторов крупной франшизы; высокий публичный охват и широкая узнаваемость.'
 },
 impactHype:{
  '0.5':'Почти нет ожидания до выхода: слабый анонс, мало промо и почти отсутствуют предварительные обсуждения.',
  '1.0':'Незначительное ожидание: анонсы или трейлеры замечает главным образом профильная аудитория.',
  '1.5':'Умеренный интерес: есть заметные трейлеры, публикации и обсуждения среди поклонников.',
  '2.0':'Высокие ожидания: масштабная промокампания, активные обсуждения и заметный интерес широкой аудитории.',
  '2.5':'Релиз-событие: крупная кампания, устойчивый медийный резонанс и ожидание, выходящее за пределы фанатского круга.'
 }
};

const qualityDescriptions={
 story:{
  1:'Сценарная логика почти не работает; образы случайны или шаблонны.',
  2:'Мотивировки и диалоги слабы, конфликт держится на клише.',
  3:'Есть отдельные удачные находки, но история часто предсказуема или неубедительна.',
  4:'Некоторые сцены и образы работают, однако заметны штампы и пробелы.',
  5:'Крепкая базовая драматургия: история понятна, но образы и ходы в основном знакомы.',
  6:'Уверенная история и выразительные сцены; часть линий или образов раскрыта не полностью.',
  7:'Хорошо собранный сценарий, запоминающиеся образы и в основном убедительные мотивировки.',
  8:'Выразительная драматургия и многослойные образы; детали поддерживают общую тему.',
  9:'Высокая оригинальность и точность: образы, символы и сюжетные решения работают как единая система.',
  10:'Исключительно самобытная и цельная драматургия; каждая деталь значима и усиливает замысел.'
 },
 structure:{
  1:'Композиция распадается; темп мешает понять развитие произведения.',
  2:'Переходы неубедительны, ритм часто случайный, есть серьёзные провалы.',
  3:'Отдельные части плохо связаны или сильно проседают по темпу.',
  4:'Общий ход понятен, однако ритм неровный, а часть эпизодов кажется лишней.',
  5:'Рабочая стандартная структура; темп в целом приемлем, но не всегда точен.',
  6:'Хорошо организованное развитие с несколькими затянутыми или поспешными фрагментами.',
  7:'Сцены выстроены убедительно, ритм поддерживает развитие и внимание.',
  8:'Сильная композиция и точное управление темпом; переходы и нарастание напряжения работают.',
  9:'Ритм осознанно формирует впечатление, почти каждая сцена добавляет смысл или движение.',
  10:'Исключительно точная структура: форма и темп усиливают замысел, случайных или лишних фрагментов почти нет.'
 },
 craft:{
  1:'Постановка и техническая реализация не складываются в цельный стиль.',
  2:'Много случайных решений; камера, монтаж, свет или звук часто мешают восприятию.',
  3:'Есть отдельные удачные решения, но исполнение заметно неровное.',
  4:'Ремесленная база присутствует, однако стиль и технические решения непоследовательны.',
  5:'Компетентная реализация без выраженного единства или оригинальности.',
  6:'Визуальные и звуковые средства в основном согласованы с замыслом.',
  7:'Уверенная режиссура: камера, монтаж, свет и звук поддерживают настроение и тему.',
  8:'Выразительный и последовательный авторский подход к форме и атмосфере.',
  9:'Оригинальные формальные решения точно работают вместе и усиливают произведение.',
  10:'Исключительно целостная реализация: визуальный и звуковой язык сам становится частью высказывания.'
 },
 characters:{
  1:'Персонажи плоские, индивидуальность почти не проявляется, игра неубедительна.',
  2:'Преобладают шаблонные типажи, реакции и мотивация выглядят искусственно.',
  3:'Есть знакомые характеры и отдельные удачные моменты, но исполнения неровные.',
  4:'Некоторые персонажи запоминаются, однако большинство раскрыто поверхностно.',
  5:'В целом убедительно, но индивидуальность и химия между героями ограничены.',
  6:'Есть живые характеры и достоверная игра, хотя глубина раскрытия неодинакова.',
  7:'Персонажи различимы и убедительны; взаимодействия и актёрская химия работают.',
  8:'Сильная индивидуальность, многослойные характеры и выразительные исполнения.',
  9:'Персонажи и актёрские работы запоминаются надолго, а взаимодействия психологически точны.',
  10:'Исключительно самобытные и полноценно раскрытые характеры; харизма и взаимодействия создают собственный мир.'
 }
};
function updateValueDescriptions(){
 Object.entries(valueDescriptions).forEach(([id,descriptions])=>{
  const el=$(id),desc=$(id+'Desc');if(!el||!desc)return;
  const value=Number(el.value).toFixed(1);
  desc.textContent=`${value} — ${descriptions[value]||'Промежуточное значение выбранного критерия.'}`;
 });
 criteriaData.forEach(c=>{const el=$(c.id),desc=$('desc-'+c.id);if(el&&desc){const value=Number(el.value);desc.textContent=`${value}/10 — ${qualityDescriptions[c.id]?.[value]||'Оценка выбранного уровня реализации.'}`;}});
 const vibe=$('vibe');if(vibe&&$('vibeDesc'))$('vibeDesc').textContent=`${vibe.value} из 10 — ${vibe.value<=3?'сдержанное эмоциональное погружение':vibe.value<=6?'умеренное эмоциональное погружение':vibe.value<=8?'сильное эмоциональное погружение':'максимальное эмоциональное погружение'}.`;
}

// Таблица множителей влияния (сумма баллов известности и ожидания -> индекс)
const impactMultiplierTable={
 '1.0':1.12,
 '1.5':1.34,
 '2.0':1.50,
 '2.5':1.62,
 '3.0':1.72,
 '3.5':1.81,
 '4.0':1.88,
 '4.5':1.94,
 '5.0':2.00
};

// Множители Атмосферы/Вайба (от 1 до 10)
const vibeMultipliers=[1.0000,1.0675,1.1349,1.2024,1.2699,1.3373,1.4048,1.4723,1.5397,1.6072];

function getValueTier(val,kindText){
 const noun=kindText.includes('СЕРИАЛ')?'СЕРИАЛ':(kindText.includes('МУЛЬТ')?'МУЛЬТФИЛЬМ':'ФИЛЬМ');
 if(val>=24)return {name:`РУБИНОВЫЙ ${noun}`,short:'Рубин',range:'24.00 – 30.00',color:'#ff4d6d',bg:'rgba(255,77,109,.16)',dark:'#3b0d18'};
 if(val>=18)return {name:`САПФИРОВЫЙ ${noun}`,short:'Сапфир',range:'18.00 – 23.99',color:'#60a5fa',bg:'rgba(96,165,250,.16)',dark:'#0f2342'};
 if(val>=12)return {name:`ИЗУМРУДНЫЙ ${noun}`,short:'Изумруд',range:'12.00 – 17.99',color:'#34d399',bg:'rgba(52,211,153,.16)',dark:'#0b2e23'};
 if(val>=6) return {name:`ЗОЛОТОЙ ${noun}`,short:'Золото',range:'6.00 – 11.99',color:'#fbbf24',bg:'rgba(251,191,36,.16)',dark:'#332407'};
 return {name:`СЕРЕБРЯНЫЙ ${noun}`,short:'Серебро',range:'0.34 – 5.99',color:'#cbd5e1',bg:'rgba(203,213,225,.14)',dark:'#1e2430'};
}

function setArtworkColors(img){
 const rootStyle=document.documentElement.style;
 const fallback=['#273a48','#171923','#c5ff65'];
 const apply=colors=>{
  rootStyle.setProperty('--art-a',colors[0]||fallback[0]);
  rootStyle.setProperty('--art-b',colors[1]||fallback[1]);
  rootStyle.setProperty('--art-accent',colors[2]||fallback[2]);
 };
 const sample=()=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(img,0,0,32,32);
   const data=ctx.getImageData(0,0,32,32).data;
   let r=0,g=0,b=0,n=0,brightR=0,brightG=0,brightB=0,brightN=0;
   for(let i=0;i<data.length;i+=16){
    const rr=data[i],gg=data[i+1],bb=data[i+2];
    if(rr+gg+bb<420){r+=rr;g+=gg;b+=bb;n++;}
    if(Math.max(rr,gg,bb)-Math.min(rr,gg,bb)>25){brightR+=rr;brightG+=gg;brightB+=bb;brightN++;}
   }
   const dark=n?`rgb(${Math.round(r/n*.48)},${Math.round(g/n*.48)},${Math.round(b/n*.48)})`:fallback[1];
   const average=`rgb(${Math.round(r/(n||1))},${Math.round(g/(n||1))},${Math.round(b/(n||1))})`;
   const accent=brightN?`rgb(${Math.round(brightR/brightN)},${Math.round(brightG/brightN)},${Math.round(brightB/brightN)})`:'#c5ff65';
   apply([average,dark,accent]);
  }catch(e){apply(fallback);}
 };
 if(img.complete&&img.naturalWidth)sample();
 else img.addEventListener('load',sample,{once:true});
}

function displayGenre(text){
 return String(text||'').split(',').map(part=>part.trim().replace(/(^|[\s-])([а-яёa-z])/giu,(match,prefix,letter)=>prefix+letter.toLocaleUpperCase('ru-RU'))).join(', ');
}

function fmtNum(n){
 return Number.isInteger(n)?String(n):n.toFixed(1);
}

// API keys are never embedded in this file. They are supplied by the user and
// saved locally in the browser when storage is available.
const KINOPOISK_BASE='https://kinopoiskapiunofficial.tech/api';
let tmdbKeyMemory='';
let kpKeyMemory='';
let apiSetupCompleteMemory=false;
function readApiKey(storageKey, memoryValue){
 try{
  const value=localStorage.getItem(storageKey);
  if(value!==null)return value.trim();
 }catch(_){}
 return String(memoryValue||'').trim();
}
function getTmdbKey(){return readApiKey('cineva_tmdb_key',tmdbKeyMemory);}
function getKpKey(){return readApiKey('cineva_kp_key',kpKeyMemory);}
function isApiSetupComplete(){
 try{if(localStorage.getItem('cineva_api_setup_complete')==='true')return true;}catch(_){}
 return apiSetupCompleteMemory;
}
function saveApiKeys(tmdbValue,kpValue){
 tmdbKeyMemory=String(tmdbValue||'').trim();
 kpKeyMemory=String(kpValue||'').trim();
 apiSetupCompleteMemory=true;
 try{
  if(tmdbKeyMemory)localStorage.setItem('cineva_tmdb_key',tmdbKeyMemory);else localStorage.removeItem('cineva_tmdb_key');
  if(kpKeyMemory)localStorage.setItem('cineva_kp_key',kpKeyMemory);else localStorage.removeItem('cineva_kp_key');
  localStorage.setItem('cineva_api_setup_complete','true');
 }catch(_){}
}

// Global Toast helper
function showToast(msg, type='info', duration=3200){
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type==='success'?'✓':type==='error'?'✕':'ℹ';
  t.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  container.appendChild(t);
  const close = () => { t.classList.add('hiding'); setTimeout(()=>t.remove(), 320); };
  t.addEventListener('click', close);
  setTimeout(close, duration);
}

const pImg = $('posterImg'); if (pImg) pImg.addEventListener('error',()=>{
  $('posterImg').style.display='none';
  $('posterPlaceholder').style.display='block';
});
if (pImg) pImg.addEventListener('load',()=>{ if($('posterImg').naturalWidth>0){ $('posterImg').style.display='block'; $('posterPlaceholder').style.display='none'; setArtworkColors($('posterImg')); } });
let tmdbSearchResults=[];
let tmdbSearchController=null;
async function fetchJsonWithTimeout(url,options={},timeoutMs=10000){
 const controller=new AbortController();
 const parentSignal=options.signal;
 const relayAbort=()=>controller.abort();
 if(parentSignal){
  if(parentSignal.aborted)controller.abort();
  else parentSignal.addEventListener('abort',relayAbort,{once:true});
 }
 const timeoutId=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  if(!response.ok){
   let detail='';try{detail=await response.text();}catch(e){}
   throw new Error(`HTTP ${response.status}${detail?' — '+detail.slice(0,120):''}`);
  }
  return await response.json();
 }catch(error){
  if(controller.signal.aborted&&!parentSignal?.aborted)throw new Error(`Превышено время ожидания ответа API (${Math.round(timeoutMs/1000)} сек.).`);
  throw error;
 }finally{
  clearTimeout(timeoutId);
  if(parentSignal)parentSignal.removeEventListener('abort',relayAbort);
 }
}
async function kpFetch(path,signal,timeoutMs=10000){
 const key = getKpKey();
 if(!key)throw new Error('Ключ Кинопоиска не задан в коде или настройках.');
 return fetchJsonWithTimeout(KINOPOISK_BASE+path,{
  headers:{'X-API-KEY':key,'Accept':'application/json'},signal
 },timeoutMs);
}
function releaseYear(item){return item.year?String(item.year):(item.startYear?String(item.startYear):'');}
function clearTmdbResults(){ $('tmdbResults').replaceChildren(); }
function normalizeTmdb(item){
 const isTv=item.media_type==='tv'||item.media_type==='TV';
 return {source:'tmdb',id:item.id,media_type:isTv?'tv':'movie',type:isTv?'TV_SERIES':'FILM',nameRu:item.title||item.name||item.original_title||item.original_name||'',nameEn:item.original_title||item.original_name||'',nameOriginal:item.original_title||item.original_name||'',year:String((item.release_date||item.first_air_date||'').slice(0,4)||''),posterUrl:item.poster_path?'https://image.tmdb.org/t/p/w500'+item.poster_path:'',posterUrlPreview:item.poster_path?'https://image.tmdb.org/t/p/w185'+item.poster_path:'',ratingTmdb:item.vote_average||0,voteCountTmdb:item.vote_count||0};
}
function normalizeSearchText(value){
 if(!value)return '';
 return String(value)
  .toLocaleLowerCase('ru-RU')
  .replace(/ё/g,'е')
  .replace(/[éèêë]/g,'e').replace(/[àáâãäå]/g,'a').replace(/[óòôõö]/g,'o').replace(/[íìîï]/g,'i').replace(/[úùûü]/g,'u').replace(/ç/g,'c')
  .replace(/[^0-9a-zа-яё]+/giu,' ')
  .trim()
  .replace(/\s+/g,' ');
}
function switchKeyboardLayout(value){
 const en='`qwertyuiop[]asdfghjkl;\'zxcvbnm,./';
 const ru='ёйцукенгшщзхъфывапролджэячсмитьбю.';
 const chars=Array.from(String(value||''));
 return chars.map(char=>{
  const lower=char.toLocaleLowerCase();
  let i=ru.indexOf(lower);
  if(i>=0){const converted=en[i]||char;return char!==lower?converted.toLocaleUpperCase():converted;}
  i=en.indexOf(lower);
  if(i>=0){const converted=ru[i]||char;return char!==lower?converted.toLocaleUpperCase():converted;}
  return char;
 }).join('');
}
function makeSearchPlan(query){
 const raw=String(query||'').trim().replace(/\s+/g,' ');
 const flipped=switchKeyboardLayout(raw).trim().replace(/\s+/g,' ');
 const seen=new Set();const out=[];
 const add=(text,reason)=>{
  text=String(text||'').trim().replace(/\s+/g,' ');
  const key=normalizeSearchText(text);
  if(text.length>=2&&key&&!seen.has(key)){seen.add(key);out.push({query:text,reason});}
 };
 add(raw,'точное название');
 if(flipped&&normalizeSearchText(flipped)!==normalizeSearchText(raw))add(flipped,'исправление раскладки');
 const clean=raw.replace(/[’'“”"`´:;!?.,()[\]{}]/g,' ').replace(/\s+/g,' ').trim();
 if(clean!==raw)add(clean,'без знаков препинания');
 const stopWords=new Set(['the','a','an','of','and','in','on','at','to','for','with','le','la','les','de','des','du','и','в','во','на','из','за','к','ко','по','с','со','о','об','от','до','для','над','под']);
 const words=clean.split(/\s+/).filter(Boolean);
 const meaningful=words.filter(w=>w.length>=3&&!stopWords.has(w.toLocaleLowerCase()));
 if(meaningful.length>=2){
  const reduced=meaningful.slice(0,3).join(' ');add(reduced,'по ключевым словам');
  const strongest=[...meaningful].sort((a,b)=>b.length-a.length).slice(0,2);
  strongest.forEach(word=>{if(word.length>=5)add(word,'по главному слову');});
 }else if(words.length>=2){
  const substantial=words.filter(w=>w.length>=4);
  if(substantial.length)add(substantial[0],'по части названия');
 }
 const typoWords=words.filter(w=>w.length>=5).sort((a,b)=>b.length-a.length).slice(0,2);
 for(const word of typoWords){
  const repairs=[];const addRepair=v=>{if(v&&v!==word&&!repairs.includes(v))repairs.push(v);};
  for(let i=1;i<word.length;i++)if(word[i]===word[i-1])addRepair(word.slice(0,i)+word.slice(i+1));
  const lower=word.toLocaleLowerCase();
  const duplicatePriority='lstrnmpcoegdaerлрснтмпкоаеи';
  for(const letter of duplicatePriority){
   const i=lower.indexOf(letter);
   if(i>=0&&!((lower[i-1]||'')===letter||(lower[i+1]||'')===letter))addRepair(word.slice(0,i+1)+word[i]+word.slice(i+1));
   if(repairs.length>=2)break;
  }
  const swapPositions=[Math.floor((word.length-1)/3),Math.floor((word.length-1)/2),Math.floor(2*(word.length-1)/3)];
  for(const i0 of swapPositions){const i=Math.max(0,Math.min(word.length-2,i0));if(word[i]!==word[i+1])addRepair(word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2));}
  for(const repair of repairs.slice(0,4)){
   const replaced=clean.split(/\s+/).map(w=>w===word?repair:w).join(' ');
   add(replaced,'возможная опечатка');
  }
 }
 return out.slice(0,10);
}
function titleMatchScore(query,item){
 const q=normalizeSearchText(query);if(!q)return 0;
 const names=[item.nameRu,item.nameEn,item.nameOriginal,item.title,item.name].filter(Boolean).map(normalizeSearchText);
 let best=0;
 for(const name of names){
  if(!name)continue;
  if(name===q)best=Math.max(best,1);
  else if(name.startsWith(q)||q.startsWith(name))best=Math.max(best,.88);
  else if(name.includes(q)||q.includes(name))best=Math.max(best,.78);
  const qt=q.split(' ').filter(Boolean),nt=name.split(' ').filter(Boolean);
  if(qt.length&&nt.length){const overlap=qt.filter(t=>nt.some(n=>n===t||n.includes(t)||t.includes(n))).length/qt.length;best=Math.max(best,overlap*.72);}
  if(q.length>=5&&name.length>=5&&Math.abs(name.length-q.length)<=3){
   let prev=Array.from({length:name.length+1},(_,i)=>i);
   for(let i=1;i<=q.length;i++){
    const curr=[i];
    for(let j=1;j<=name.length;j++)curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(q[i-1]===name[j-1]?0:1));
    prev=curr;
   }
   best=Math.max(best,1-prev[name.length]/Math.max(q.length,name.length));
  }
 }
 return best;
}
function sortSearchResults(items,queries){
 return items.map((item,index)=>({...item,_sortScore:Math.max(0,...queries.map(q=>titleMatchScore(q,item))),_originalOrder:index}))
  .sort((a,b)=>b._sortScore-a._sortScore||Number(b.ratingTmdb||b.ratingKinopoisk||0)-Number(a.ratingTmdb||a.ratingKinopoisk||0)||a._originalOrder-b._originalOrder)
  .map(({_sortScore,_originalOrder,...item})=>item);
}
function renderTmdbResults(items){
 clearTmdbResults();
 if(!items.length){$('tmdbStatus').textContent='Совпадений не найдено. Попробуй оригинальное название или ручной ввод.';return;}
 $('tmdbStatus').textContent=`Найдено вариантов: ${items.length}. Результаты отсортированы по близости названия.`;
 const frag=document.createDocumentFragment();
 items.forEach((item,index)=>{
  const btn=document.createElement('button');btn.type='button';btn.className='tmdb-result';
  const posterUrl=item.posterUrlPreview||item.posterUrl;
  const poster=posterUrl?document.createElement('img'):document.createElement('div');
  if(posterUrl){poster.src=posterUrl;poster.alt='';poster.loading='lazy';poster.onerror=()=>{poster.replaceWith(Object.assign(document.createElement('div'),{className:'tmdb-no-poster',textContent:'✳'}));};}else{poster.className='tmdb-no-poster';poster.textContent='✳';}
  const copy=document.createElement('span');copy.className='tmdb-result-copy';
  const name=document.createElement('strong');name.textContent=item.nameRu||item.nameEn||item.nameOriginal||'Без названия';
  const source=item.source==='tmdb'?'TMDB':'Кинопоиск';
  const meta=document.createElement('span');meta.textContent=`${item.type==='TV_SERIES'||item.type==='MINI_SERIES'||item.type==='TV_MINI_SERIES'||item.media_type==='tv'?'Сериал':'Фильм'}${releaseYear(item)?' · '+releaseYear(item):''} · ${source}${Number(item.ratingTmdb)>0?' · TMDB '+Number(item.ratingTmdb).toFixed(1):''}${Number(item.ratingKinopoisk)>0?' · КП '+Number(item.ratingKinopoisk).toFixed(1):''}`;
  copy.append(name,meta);btn.append(poster,copy);btn.addEventListener('click',()=>selectTmdbResult(index));frag.appendChild(btn);
 });
 $('tmdbResults').appendChild(frag);
}
let searchDebounce=null;
let searchSequence=0;
async function tmdbFetch(path,signal,timeoutMs=10000){
 const key=getTmdbKey();
 if(!key)throw new Error('Ключ TMDB не задан.');
 const headers={accept:'application/json'};
 let url='https://api.themoviedb.org/3'+path;
 if(key.length>100)headers.Authorization='Bearer '+key;
 else url+=(url.includes('?')?'&':'?')+'api_key='+encodeURIComponent(key);
 return fetchJsonWithTimeout(url,{headers,signal},timeoutMs);
}
function isAbort(error){return error?.name==='AbortError';}
function hasCyrillic(text){return /[а-яё]/i.test(text);}
async function searchTmdb(queryOverride){
 const query=(queryOverride===undefined?$('tmdbQuery').value:queryOverride).trim().replace(/\s+/g,' ');
 const sequence=++searchSequence;
 if(tmdbSearchController)tmdbSearchController.abort();
 if(query.length<2){$('tmdbStatus').textContent=query.length?'Введи хотя бы два символа.':'Введи название фильма или сериала.';clearTmdbResults();tmdbSearchResults=[];return;}
 if(!getTmdbKey()&&!getKpKey()){$('tmdbStatus').textContent='Источники отключены. Можно перейти к ручному вводу и оценить произведение без API.';clearTmdbResults();tmdbSearchResults=[];return;}
 tmdbSearchController=new AbortController();const signal=tmdbSearchController.signal;
 $('tmdbSearchBtn').disabled=true;$('tmdbSearchBtn').textContent='Ищу…';$('tmdbStatus').textContent='Параллельно ищем в TMDB и Кинопоиске…';clearTmdbResults();tmdbSearchResults=[];
 const plan=makeSearchPlan(query);
 const tmdbTask=(async()=>{
  let error=null;
  const [movies,tv]=await Promise.all([
   tmdbFetch('/search/movie?query='+encodeURIComponent(query)+'&include_adult=false&language=ru-RU&page=1',signal,8000).catch(e=>{error=error||e.message;return {results:[]};}),
   tmdbFetch('/search/tv?query='+encodeURIComponent(query)+'&include_adult=false&language=ru-RU&page=1',signal,8000).catch(e=>{error=error||e.message;return {results:[]};})
  ]);
  const items=[...(movies.results||[]).map(x=>({...normalizeTmdb({...x,media_type:'movie'}),source:'tmdb'})),...(tv.results||[]).map(x=>({...normalizeTmdb({...x,media_type:'tv'}),source:'tmdb'}))];
  return {items,error};
 })();
 const kpTask=(async()=>{
  const items=[],errors=[];
  for(const variant of plan.slice(0,5)){
   try{
    const data=await kpFetch('/v2.1/films/search-by-keyword?keyword='+encodeURIComponent(variant.query)+'&page=1',signal,7000);
    (data.films||data.items||data.results||[]).forEach(x=>items.push({
     ...x,source:'kinopoisk',id:String(x.filmId||x.kinopoiskId||x.film_id||x.id||''),
     media_type:['TV_SERIES','MINI_SERIES','TV_MINI_SERIES','TV_SHOW'].includes(x.type)?'tv':'movie',
     nameRu:x.nameRu||x.name||'',nameEn:x.nameEn||x.nameOriginal||'',nameOriginal:x.nameOriginal||x.nameEn||'',
     ratingKinopoisk:Number(x.ratingKinopoisk||x.rating||0),ratingKinopoiskVoteCount:Number(x.ratingKinopoiskVoteCount||x.ratingVoteCount||0),
     year:String(x.year||''),posterUrl:x.posterUrl||'',posterUrlPreview:x.posterUrlPreview||''
    }));
   }catch(error){if(isAbort(error))return {cancelled:true,items:[],errors};errors.push(error.message||String(error));}
   if(sequence!==searchSequence)return {cancelled:true,items:[],errors};
   if(items.length>=20)break;
  }
  const seen=new Set();return {items:items.filter(x=>x.id&&!seen.has(x.id)&&seen.add(x.id)),errors};
 })();
 try{
  const tmdbResult=await tmdbTask;
  if(sequence!==searchSequence)return;
  // Render primary TMDB results as soon as they are ready instead of waiting for Kinopoisk.
  tmdbSearchResults=sortSearchResults(tmdbResult.items,plan.map(x=>x.query)).slice(0,15);
  if(tmdbSearchResults.length){
   renderTmdbResults(tmdbSearchResults);
   $('tmdbStatus').textContent=`TMDB: ${tmdbSearchResults.length} результатов. Подтягиваем совпадения и оценки Кинопоиска…`;
  }else if(tmdbResult.error){
   $('tmdbStatus').textContent=`TMDB пока не ответил (${tmdbResult.error}). Ищем в Кинопоиске…`;
  }else{
   $('tmdbStatus').textContent='В TMDB совпадений нет. Проверяем Кинопоиск…';
  }
  const kpResult=await kpTask;
  if(sequence!==searchSequence||kpResult.cancelled)return;
  const kpUnique=kpResult.items;
  const merged=[];const usedTmdb=new Set();
  for(const item of tmdbResult.items){
   const matched=kpUnique.find(k=>k.media_type===item.media_type&&titleMatchScore(item.nameRu||item.nameEn,k)>=.78&&(!item.year||!k.year||item.year===k.year));
   const normalized={...item,ratingTmdb:Number(item.ratingTmdb||0),ratingKinopoisk:Number(matched?.ratingKinopoisk||0),kinopoiskId:matched?.id||''};
   const key=normalized.media_type+':'+normalized.id;
   if(!usedTmdb.has(key)){usedTmdb.add(key);merged.push(normalized);}
  }
  for(const item of kpUnique){
   const duplicate=tmdbResult.items.some(t=>t.media_type===item.media_type&&titleMatchScore(t.nameRu||t.nameEn,item)>=.78&&(!t.year||!item.year||t.year===item.year));
   if(!duplicate)merged.push(item);
  }
  tmdbSearchResults=sortSearchResults(merged,plan.map(x=>x.query)).slice(0,15);
  renderTmdbResults(tmdbSearchResults);
  if(tmdbSearchResults.length)$('tmdbStatus').textContent=`Найдено вариантов: ${tmdbSearchResults.length}. Источник по умолчанию — TMDB; рейтинг Кинопоиска добавляется при совпадении.`;
  else if(tmdbResult.error||kpResult.errors.length)$('tmdbStatus').textContent='Оба источника не вернули результатов. TMDB: '+(tmdbResult.error||'совпадений нет')+'; Кинопоиск: '+(kpResult.errors[0]||'совпадений нет');
  else $('tmdbStatus').textContent='Совпадений не найдено. Попробуй оригинальное название или ручной ввод.';
 }catch(error){
  if(isAbort(error))return;
  if(sequence===searchSequence)$('tmdbStatus').textContent='Ошибка поиска: '+(error.message||String(error))+' Нажми «Поиск» для повтора.';
 }finally{if(sequence===searchSequence){$('tmdbSearchBtn').disabled=false;$('tmdbSearchBtn').textContent='Поиск';}}
}
function scheduleTmdbSearch(){
 clearTimeout(searchDebounce);const query=$('tmdbQuery').value.trim();
 if(query.length<2){if(tmdbSearchController)tmdbSearchController.abort();searchSequence++;tmdbSearchResults=[];clearTmdbResults();$('tmdbStatus').textContent=query.length?'Введи хотя бы два символа.':'Введи название фильма или сериала.';$('tmdbSearchBtn').disabled=false;$('tmdbSearchBtn').textContent='Поиск';return;}
 $('tmdbStatus').textContent='Готовлю варианты названия…';searchDebounce=setTimeout(()=>searchTmdb(query),450);
}
let metadataMode='unset';
const metadataFieldIds=['title','director','year','genre','kind','posterFile'];
function setMetadataMode(mode){
 metadataMode=mode;
 const locked=mode==='tmdb'||mode==='kinopoisk';
 metadataFieldIds.forEach(id=>{
  const el=$(id);el.disabled=locked;
  el.title=locked?'Данные загружены из базы и защищены от редактирования.':'';
 });
 $('metadataFields').hidden=locked;
 $('manualEntryBtn').hidden=locked;
 $('manualEntryBtn').textContent='Ручной ввод';
}
async function selectTmdbResult(index){
 const item=tmdbSearchResults[index];if(!item)return;
 if(tmdbSearchController)tmdbSearchController.abort();
 $('tmdbStatus').textContent='Загружаем данные фильма…';const buttons=[...$('tmdbResults').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{
  let title='',date='',genres=[],director='',posterUrl='',isTv=false,isShort=false,votes=0,rating=0,detailType='';
  if(item.source==='tmdb'){
   const type=item.media_type==='tv'?'tv':'movie';
   const details=await tmdbFetch('/'+type+'/'+encodeURIComponent(item.id)+'?language=ru-RU');
   title=details.title||details.name||details.original_title||details.original_name||item.nameRu||'';
   date=String((details.release_date||details.first_air_date||item.year||'').slice(0,4));
   genres=(details.genres||[]).map(g=>g.name).filter(Boolean);
   posterUrl=details.poster_path?'https://image.tmdb.org/t/p/w780'+details.poster_path:(item.posterUrl||'');
   isTv=type==='tv';rating=Number(details.vote_average||item.ratingTmdb||0);votes=Number(details.vote_count||0);
   if(type==='movie'){
    try{const credits=await tmdbFetch('/movie/'+encodeURIComponent(item.id)+'/credits?language=ru-RU');director=(credits.crew||[]).filter(x=>x.job==='Director').map(x=>x.name).filter(Boolean).join(', ');}catch(e){}
   }else{
    try{const credits=await tmdbFetch('/tv/'+encodeURIComponent(item.id)+'/aggregate_credits?language=ru-RU');director=(credits.crew||[]).filter(x=>(x.jobs||[]).some(j=>j.job==='Director'||j.job==='Creator')||x.department==='Directing'||x.department==='Writing').map(x=>x.name).filter(Boolean).slice(0,4).join(', ');}catch(e){}
   }
  }else{
   const id=item.id||item.filmId||item.kinopoiskId;
   const details=await kpFetch('/v2.2/films/'+encodeURIComponent(id));
   try{const staff=await kpFetch('/v1/staff?filmId='+encodeURIComponent(id));director=(staff||[]).filter(p=>p.professionKey==='DIRECTOR'||p.professionText==='Режиссеры'||p.professionText==='Режиссёр').map(p=>p.nameRu||p.nameEn).filter(Boolean).join(', ');}catch(e){}
   title=details.nameRu||details.nameOriginal||details.nameEn||item.nameRu||item.nameEn||'';date=details.year?String(details.year):'';
   genres=(details.genres||item.genres||[]).map(g=>typeof g==='string'?g:(g.genre||g.name||'')).filter(Boolean);
   isTv=['TV_SERIES','MINI_SERIES','TV_SHOW'].includes(details.type||item.type);isShort=!!(details.filmLength&&details.filmLength<45);
   votes=Number(details.ratingKinopoiskVoteCount||item.ratingKinopoiskVoteCount||0);rating=Number(details.ratingKinopoisk||item.ratingKinopoisk||0);
   posterUrl=details.posterUrl||item.posterUrl||details.posterUrlPreview||item.posterUrlPreview||'';
  }
  $('title').value=title;$('director').value=director;$('year').value=date;$('genre').value=genres.join(', ');
  const isAnimated=genres.some(g=>String(g).toLowerCase().includes('анима')||String(g).toLowerCase().includes('animation'));
  if(isTv){$('kind').value=isAnimated?'Анимационный сериал':'Сериал';$('integFormat').value='1.0';}
  else{$('kind').value=isShort?'Короткометражка':(isAnimated?'Мультфильм':'Фильм');$('integFormat').value=isShort?'0.5':'1.0';}
  if(votes>100000){$('impactScale').value='2.5';$('impactHype').value='2.5';}
  else if(votes>30000){$('impactScale').value='2.0';$('impactHype').value='2.0';}
  else if(votes>8000||rating>=8){$('impactScale').value='1.5';$('impactHype').value='1.5';}
  else if(votes>1000){$('impactScale').value='1.0';$('impactHype').value='1.0';}
  else{$('impactScale').value='0.5';$('impactHype').value='0.5';}
  if(posterUrl){if(imageUrl){URL.revokeObjectURL(imageUrl);imageUrl=null;}$('posterFile').value='';$('posterImg').dataset.imageType='poster';$('posterImg').removeAttribute('crossorigin');$('posterImg').src=posterUrl;$('posterImg').style.display='block';$('posterPlaceholder').style.display='none';setArtworkColors($('posterImg'));}
  $('editorDetails').hidden=false;$('resultCard').hidden=false;document.querySelector('.layout').classList.add('has-preview');setMetadataMode(item.source==='tmdb'?'tmdb':'kinopoisk');update();
  $('tmdbStatus').textContent=`Заполнено из ${item.source==='tmdb'?'TMDB':'Кинопоиска'}: ${title}${date?' ('+date+')':''}. Проверь критерии и оценки.`;clearTmdbResults();
 }catch(error){$('tmdbStatus').textContent=`Не удалось загрузить карточку: ${error.message}`;}
 finally{buttons.forEach(b=>b.disabled=false);}
}
const manualBtn = $('manualEntryBtn'); if (manualBtn) manualBtn.addEventListener('click',()=>{
 setMetadataMode('manual');
 $('editorDetails').hidden=false;$('resultCard').hidden=false;document.querySelector('.layout').classList.add('has-preview');
 clearTmdbResults();
 $('tmdbStatus').textContent='Ручной ввод: заполните данные произведения и выставьте оценки.';
 $('title').focus();update();
});
setMetadataMode('unset');
$('tmdbSearchBtn').addEventListener('click',()=>{clearTimeout(searchDebounce);searchTmdb();});
$('tmdbQuery').addEventListener('input',scheduleTmdbSearch);
$('tmdbQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(searchDebounce);searchTmdb();}});


const setText = (id, txt) => { const el = $(id); if (el) el.textContent = String(txt ?? ''); };

function update(){
 if (typeof updateValueDescriptions === 'function') updateValueDescriptions();
 // 1. Базовые критерии (4..40) и Качество (10%..100%)
 let baseSum=0;
 criteriaData.forEach(c=>{
  const v=num(c.id);baseSum+=v;
  setText('val-'+c.id, v);
  setText('share-'+c.id, v);
 });
 const qualityPct=baseSum*2.5;
 const qualityFactor=qualityPct/100;

 // 2. Атмосфера / Вайб и 90-балльный рейтинг
 const vibe=num('vibe');
 const vibeMult=vibeMultipliers[Math.max(0, Math.min(vibe-1, vibeMultipliers.length-1))] || 1.0;
 setText('vibeValue', vibe);
 setText('share-vibe', vibe);
 const score90=Math.round(baseSum*1.4*vibeMult);
 setText('score', score90);
 setText('previewBaseSum', `${baseSum}/40`);
 setText('previewVibeMult', `×${vibeMult.toFixed(2)}`);
 setText('previewQualityPct', `${fmtNum(qualityPct)}%`);
 setText('baseSumBadge', `База: ${baseSum} / 40 · Качество: ${fmtNum(qualityPct)}%`);

 // 3. Ценность кино: (Редкость + Целостность + Глубина) * Качество * Влияние
 const rGenre=num('rarityGenre'), rFormat=num('rarityFormat');
 const rarity=rGenre+rFormat;
 setText('rarityGenreVal', rGenre.toFixed(1));
 setText('rarityFormatVal', rFormat.toFixed(1));
 setText('rarityScoreDisplay', `${fmtNum(rarity)} / 5`);

 const iFormat=num('integFormat'), iGenre=num('integGenre'), iMeaning=num('integMeaning');
 const integrity=Math.min(5,iFormat+iGenre+iMeaning);
 setText('integFormatVal', iFormat.toFixed(1));
 setText('integGenreVal', iGenre.toFixed(1));
 setText('integMeaningVal', iMeaning.toFixed(1));
 setText('integrityScoreDisplay', `${fmtNum(integrity)} / 5`);

 const depth=num('depth');
 setText('depthScoreDisplay', `${depth} / 5`);
 setText('depthDesc', depthDescriptions[depth] || '');

 const impScale=num('impactScale'), impHype=num('impactHype');
 const impSum=(impScale+impHype).toFixed(1);
 const impactMult=impactMultiplierTable[impSum]||1.62;
 setText('impactScaleVal', impScale.toFixed(1));
 setText('impactHypeVal', impHype.toFixed(1));
 setText('impactScoreDisplay', `×${impactMult.toFixed(2)}`);

 const rawValue=(rarity+integrity+depth)*qualityFactor*impactMult;
 const valueFixed=rawValue.toFixed(2);
 setText('valueScore', valueFixed);
 setText('valueFormulaBadge', `Ценность: ${valueFixed} / 30`);

 setText('chipRarity', `${fmtNum(rarity)}/5`);
 setText('chipIntegrity', `${fmtNum(integrity)}/5`);
 setText('chipDepth', `${depth}/5`);
 setText('chipQuality', `${fmtNum(qualityPct)}%`);
 setText('chipImpact', `×${impactMult.toFixed(2)}`);

 const kindEl = $('kind');
 const kindUpper = (kindEl ? kindEl.value : 'MOVIE').toUpperCase();
 const tier=getValueTier(rawValue,kindUpper);
 if (document.documentElement && document.documentElement.style) {
   document.documentElement.style.setProperty('--tier-color',tier.color);
   document.documentElement.style.setProperty('--tier-bg',tier.bg);
 }
 setText('tierPill', tier.name);
 setText('previewTierShort', tier.short);
 setText('previewTierRange', tier.range);

 const titleEl = $('title');
 const title = (titleEl ? titleEl.value.trim() : '') || 'Название произведения';
 setText('previewTitle', title);
 const dirEl = $('director');
 setText('previewDirector', (dirEl ? dirEl.value.trim() : '') || 'Режиссёр / создатель');
 const yrEl = $('year');
 setText('previewYear', (yrEl ? yrEl.value.trim() : '') || 'Год');
 const gnEl = $('genre');
 setText('previewGenre', (gnEl ? displayGenre(gnEl.value.trim()) : '') || 'Жанр');
 setText('previewKind', kindUpper);
}


[
 'title','director','year','genre','kind','vibe',
 'rarityGenre','rarityFormat','integFormat','integGenre','integMeaning','depth','impactScale','impactHype',
 ...criteriaData.map(c=>c.id)
]
.forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', update);
});

let imageUrl=null;
const pFile = $('posterFile'); if (pFile) pFile.addEventListener('change',e=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 if(imageUrl)URL.revokeObjectURL(imageUrl);
 imageUrl=URL.createObjectURL(file);
 $('posterImg').removeAttribute('crossorigin');$('posterImg').dataset.imageType='custom';$('posterImg').src=imageUrl;
 $('posterImg').style.display='block';$('posterPlaceholder').style.display='none';
 setArtworkColors($('posterImg'));
});

function loadImageForExport(img){
 return new Promise((resolve,reject)=>{
  if(!img||!img.getAttribute('src')){reject(new Error('Обложка не выбрана'));return;}
  const settleOriginal=()=>{
   if(img.naturalWidth>0)beginAttempts();
   else reject(new Error('Не удалось загрузить исходный постер. Проверь ссылку или выбери файл вручную.'));
  };
  let waitTimer=null;
  if(!img.complete){
   const onLoad=()=>{cleanupWait();settleOriginal();};
   const onError=()=>{cleanupWait();reject(new Error('Не удалось загрузить исходный постер. Проверь ссылку или выбери файл вручную.'));};
   const cleanupWait=()=>{if(waitTimer)clearTimeout(waitTimer);img.removeEventListener('load',onLoad);img.removeEventListener('error',onError);};
   img.addEventListener('load',onLoad,{once:true});img.addEventListener('error',onError,{once:true});
   waitTimer=setTimeout(()=>{cleanupWait();reject(new Error('Загрузка постера заняла слишком много времени.'));},10000);
   return;
  }
  if(!img.naturalWidth){reject(new Error('Не удалось загрузить исходный постер. Проверь ссылку или выбери файл вручную.'));return;}
  beginAttempts();
  function beginAttempts(){
  const originalSrc=img.currentSrc||img.src;
  const isCustom=img.dataset.imageType==='custom' || originalSrc.startsWith('blob:') || originalSrc.startsWith('data:');
  const attempts=[];
  if(isCustom){attempts.push({src:originalSrc,crossOrigin:false});}
  else {
   // First try the source directly with CORS; if the host doesn't permit canvas export,
   // retry through an image proxy that returns CORS headers.
   attempts.push({src:originalSrc,crossOrigin:true});
   try {
    const u=new URL(originalSrc);
    if(u.protocol==='https:'||u.protocol==='http:') attempts.push({src:'https://images.weserv.nl/?url='+encodeURIComponent(u.host+u.pathname+u.search),crossOrigin:true});
   } catch(_) {}
  }
  let index=0;
  const tryNext=()=>{
   if(index>=attempts.length){reject(new Error('Не удалось загрузить обложку для PNG. Попробуйте загрузить файл постера вручную.'));return;}
   const attempt=attempts[index++],copy=new Image();
   if(attempt.crossOrigin)copy.crossOrigin='anonymous';
   copy.onload=()=>resolve(copy);
   copy.onerror=tryNext;
   copy.src=attempt.src;
  };
  tryNext();
  }
 });
}
function roundedRect(ctx,x,y,w,h,r){
 const rr=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function wrapCanvasText(ctx,text,maxWidth,maxLines){
 const words=String(text||'').split(/\s+/).filter(Boolean),lines=[];let line='';
 for(const word of words){
  const next=line?line+' '+word:word;
  if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;if(lines.length===maxLines-1)break;}
  else line=next;
 }
 if(line&&lines.length<maxLines)lines.push(line);
 if(lines.length===maxLines&&words.join(' ')!==lines.join(' ')){
  let last=lines[lines.length-1];while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[lines.length-1]=last.trim()+'…';
 }
 return lines;
}

async function downloadCardPng(){
 const button=$('saveImage');button.disabled=true;button.textContent='Рендерим PNG…';
 try{
  const W=1200,H=1240,pad=52;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  const css=getComputedStyle(document.documentElement);
  const accent=css.getPropertyValue('--art-accent').trim()||'#c5ff65';
  const artA=css.getPropertyValue('--art-a').trim()||'#273a48';
  const artB=css.getPropertyValue('--art-b').trim()||'#171923';

  const kindUpper=$('kind').value.toUpperCase();
  const rawVal=parseFloat($('valueScore').textContent)||0;
  const tier=getValueTier(rawVal,kindUpper);

  let img=null;
  const posterElement=$('posterImg');
  if(posterElement.getAttribute('src')){
   try{img=await loadImageForExport(posterElement);}
   catch(error){throw new Error('Постер отображается, но браузер не смог включить его в PNG. Попробуй ещё раз или загрузи изображение файлом. '+error.message);}
  }

  // 1. Глубокий фон карточки + мягкое размытие постера
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,artA);bg.addColorStop(.52,artB);bg.addColorStop(1,'#070910');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  if(img){
   ctx.save();
   ctx.globalAlpha=0.22;
   ctx.filter='blur(48px) saturate(135%)';
   const br=Math.max(W/img.width,H/img.height);
   ctx.drawImage(img,(W-img.width*br)/2,(H-img.height*br)/2,img.width*br,img.height*br);
   ctx.restore();
  }

  // Свечение статуса в правом верхнем углу
  const glow=ctx.createRadialGradient(W-160,120,20,W-160,120,520);
  glow.addColorStop(0,tier.bg.replace('.16','.32').replace('.14','.28'));
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

  // Внешняя рамка
  ctx.fillStyle='rgba(8,10,18,.58)';
  roundedRect(ctx,24,24,W-48,H-48,38);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;
  roundedRect(ctx,24,24,W-48,H-48,38);ctx.stroke();

  // 2. Верхний колонтитул (Header)
  const topY=56;
  ctx.fillStyle=tier.color;
  ctx.beginPath();ctx.arc(pad+10,topY+18,7,0,Math.PI*2);ctx.fill();
  ctx.font='900 19px system-ui, -apple-system, sans-serif';
  ctx.fillStyle='#e5eaf7';
  ctx.fillText('CINEVA · CINEMA INDEX',pad+28,topY+25);

  // Плашка драгоценного статуса справа
  ctx.font='900 18px system-ui, -apple-system, sans-serif';
  const tierText=tier.name;
  const tierW=ctx.measureText(tierText).width+42;
  const tierX=W-pad-tierW;
  roundedRect(ctx,tierX,topY,tierW,38,19);
  ctx.fillStyle=tier.dark;ctx.fill();
  ctx.strokeStyle=tier.color;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=tier.color;
  ctx.fillText(tierText,tierX+21,topY+25);

  // 3. Блок Героя: Постер слева + Инфо и Двойной счёт справа
  const heroY=116, heroH=470;
  const posterW=330, posterH=470;
  const posterX=pad;

  ctx.save();
  roundedRect(ctx,posterX,heroY,posterW,posterH,26);
  ctx.clip();
  if(img){
   const ratio=Math.max(posterW/img.width,posterH/img.height);
   const iw=img.width*ratio,ih=img.height*ratio;
   ctx.drawImage(img,posterX+(posterW-iw)/2,heroY+(posterH-ih)*0.35,iw,ih);
  }else{
   const ph=ctx.createLinearGradient(posterX,heroY,posterX+posterW,heroY+posterH);
   ph.addColorStop(0,artA);ph.addColorStop(1,artB);
   ctx.fillStyle=ph;ctx.fillRect(posterX,heroY,posterW,posterH);
   ctx.fillStyle='#ffffff';ctx.font='900 54px system-ui, sans-serif';ctx.textAlign='center';
   ctx.fillText('КИНО',posterX+posterW/2,heroY+posterH/2+10);
   ctx.textAlign='left';
  }
  const pShade=ctx.createLinearGradient(0,heroY+posterH*0.55,0,heroY+posterH);
  pShade.addColorStop(0,'rgba(0,0,0,0)');pShade.addColorStop(1,'rgba(5,7,12,.82)');
  ctx.fillStyle=pShade;ctx.fillRect(posterX,heroY,posterW,posterH);
  ctx.restore();

  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;
  roundedRect(ctx,posterX,heroY,posterW,posterH,26);ctx.stroke();

  // Правая часть Героя
  const infoX=posterX+posterW+34;
  const infoW=W-pad-infoX;

  const title=$('title').value.trim()||'Название произведения';
  ctx.fillStyle='#ffffff';
  ctx.font='900 50px system-ui, -apple-system, sans-serif';
  const titleLines=wrapCanvasText(ctx,title,infoW,2);
  titleLines.forEach((line,i)=>ctx.fillText(line,infoX,heroY+52+i*56));

  const metaY=heroY+52+(titleLines.length-1)*56+40;
  const directorText=$('director').value.trim()||'Режиссёр / создатель';
  ctx.font='600 22px system-ui, sans-serif';
  ctx.fillStyle='#c9d2e6';
  const directorLines=wrapCanvasText(ctx,directorText,infoW,2);
  directorLines.forEach((line,i)=>ctx.fillText(line,infoX,metaY+i*30));

  // Метаданные идут сразу под режиссёром; отдельной плашки типа нет.
  const detailParts=[$('year').value.trim()||'Год',displayGenre($('genre').value.trim())||'Жанр'].filter(Boolean);
  ctx.font='600 20px system-ui, sans-serif';ctx.fillStyle='#aebbd3';
  const detailLines=wrapCanvasText(ctx,detailParts.join('  ·  '),infoW,2);
  detailLines.forEach((line,i)=>ctx.fillText(line,infoX,metaY+directorLines.length*30+28+i*28));

  // Две большие карточки счёта (Рейтинг 90 и Ценность 30)
  const boxesY=heroY+220, boxesH=250, boxGap=18;
  const box1W=Math.floor((infoW-boxGap)*0.46);
  const box2W=infoW-boxGap-box1W;

  // Бокс 1: Рейтинг 90
  roundedRect(ctx,infoX,boxesY,box1W,boxesH,24);
  ctx.fillStyle='rgba(12,16,28,.82)';ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;ctx.stroke();

  ctx.font='800 17px system-ui, sans-serif';ctx.fillStyle='#a8b2c8';
  ctx.fillText('РЕЙТИНГ',infoX+24,boxesY+38);

  const score90=$('score').textContent;
  ctx.font='950 92px system-ui, sans-serif';ctx.fillStyle=accent;
  ctx.fillText(score90,infoX+22,boxesY+148);
  const s90W=ctx.measureText(score90).width;
  ctx.font='800 28px system-ui, sans-serif';ctx.fillStyle='#8f99b0';
  ctx.fillText('/ 90',infoX+28+s90W,boxesY+144);

  ctx.font='600 18px system-ui, sans-serif';ctx.fillStyle='#b8c2d8';
  ctx.fillText(`База ${$('previewBaseSum').textContent}`,infoX+24,boxesY+212);

  // Бокс 2: Ценность Кино (30.00)
  const box2X=infoX+box1W+boxGap;
  roundedRect(ctx,box2X,boxesY,box2W,boxesH,24);
  const vGrad=ctx.createLinearGradient(box2X,boxesY,box2X+box2W,boxesY+boxesH);
  vGrad.addColorStop(0,tier.dark);vGrad.addColorStop(1,'rgba(12,16,28,.88)');
  ctx.fillStyle=vGrad;ctx.fill();
  ctx.strokeStyle=tier.color;ctx.lineWidth=2.5;ctx.stroke();

  ctx.font='800 17px system-ui, sans-serif';ctx.fillStyle=tier.color;
  ctx.fillText('ЦЕННОСТЬ КИНО',box2X+24,boxesY+38);

  ctx.textAlign='right';
  ctx.font='800 16px system-ui, sans-serif';ctx.fillStyle='#dfe6f6';
  ctx.fillText(tier.short.toUpperCase(),box2X+box2W-24,boxesY+38);
  ctx.textAlign='left';

  const valText=$('valueScore').textContent;
  ctx.font='950 88px system-ui, sans-serif';ctx.fillStyle=tier.color;
  ctx.fillText(valText,box2X+22,boxesY+148);
  const valW=ctx.measureText(valText).width;
  ctx.font='800 26px system-ui, sans-serif';ctx.fillStyle='#b5bfd4';
  ctx.fillText('/ 30',box2X+28+valW,boxesY+144);

  ctx.font='600 18px system-ui, sans-serif';ctx.fillStyle='#dbe2f4';
  ctx.fillText('Индекс произведения',box2X+24,boxesY+212);

  // 4. Секция: Базовые критерии (90-балльная система)
  const sec1Y=heroY+heroH+48;
  ctx.font='800 18px system-ui, sans-serif';ctx.fillStyle='#9aa5bd';
  ctx.fillText('КРИТЕРИИ ОЦЕНКИ',pad,sec1Y);
  ctx.textAlign='right';
  ctx.fillStyle='#e2e7f5';
  ctx.fillText(`КАЧЕСТВО РЕАЛИЗАЦИИ: ${$('previewQualityPct').textContent}`,W-pad,sec1Y);
  ctx.textAlign='left';

  const ratings=[
   ['Сценарий / Образы',$('story').value,false],
   ['Структура / Темп',$('structure').value,false],
   ['Режиссура / Стиль',$('craft').value,false],
   ['Актёры / Харизма',$('characters').value,false],
   ['Атмосфера / Вайб',$('vibe').value,true]
  ];
  const gridY=sec1Y+20, gap=16, fullW=W-pad*2, cw=(fullW-gap)/2, ch=84;
  ratings.forEach((item,i)=>{
   const isFull=item[2];
   const col=isFull?0:i%2, row=isFull?2:Math.floor(i/2);
   const bx=pad+col*(cw+gap), by=gridY+row*(ch+14), bw=isFull?fullW:cw;
   roundedRect(ctx,bx,by,bw,ch,18);
   ctx.fillStyle=isFull?'rgba(42,26,64,.82)':'rgba(14,18,30,.76)';
   ctx.fill();
   ctx.strokeStyle=isFull?'rgba(198,145,255,.45)':'rgba(255,255,255,.11)';
   ctx.lineWidth=2;ctx.stroke();

   // Полоска прогресса внизу чипа
   const valNum=Number(item[1]);
   const barW=Math.max(12,((bw-44)*(valNum/10)));
   roundedRect(ctx,bx+22,by+ch-14,bw-44,5,3);
   ctx.fillStyle='rgba(255,255,255,.08)';ctx.fill();
   roundedRect(ctx,bx+22,by+ch-14,barW,5,3);
   ctx.fillStyle=isFull?'#d5a8ff':accent;ctx.fill();

   ctx.fillStyle='#e6eaf5';ctx.font='700 22px system-ui, sans-serif';
   ctx.fillText(item[0],bx+22,by+44);

   ctx.textAlign='right';
   ctx.fillStyle=isFull?'#d5a8ff':'#ffffff';
   ctx.font='950 38px system-ui, sans-serif';
   ctx.fillText(`${item[1]} / 10`,bx+bw-22,by+48);
   ctx.textAlign='left';
  });

  // 5. Секция: Детализация Ценности Кино (5 компонентов)
  const sec2Y=gridY+3*(ch+14)+28;
  ctx.font='800 18px system-ui, sans-serif';ctx.fillStyle='#9aa5bd';
  ctx.fillText('ИНДЕКС ЦЕННОСТИ',pad,sec2Y);
  ctx.textAlign='right';
  ctx.fillStyle=tier.color;
  ctx.fillText(`ПОРОГ СТАТУСА: ${tier.range}`,W-pad,sec2Y);
  ctx.textAlign='left';

  const vItems=[
   {
    title:'РЕДКОСТЬ',val:$('chipRarity').textContent,hi:false,
    details:[`Жанр / поджанр ${$('rarityGenreVal').textContent}`,`Формат исполнения ${$('rarityFormatVal').textContent}`]
   },
   {
    title:'ЦЕЛОСТНОСТЬ',val:$('chipIntegrity').textContent,hi:false,
    details:[`Формат ${$('integFormatVal').textContent} · Жанр/идеи ${$('integGenreVal').textContent}`,`Смысл ${$('integMeaningVal').textContent}`]
   },
   {
    title:'ГЛУБИНА',val:$('chipDepth').textContent,hi:false,
    details:[`Вертикаль смысла · ${$('depth').value}`]
   },
   {
    title:'КАЧЕСТВО',val:$('chipQuality').textContent,hi:false,
    details:[`Сценарий ${$('story').value} · Структура ${$('structure').value}`,`Стиль ${$('craft').value} · Актёры ${$('characters').value}`]
   },
   {
    title:'ВЛИЯНИЕ',val:$('chipImpact').textContent,hi:true,
    details:[`Известность автора ${$('impactScaleVal').textContent}`,`Ожидание релиза ${$('impactHypeVal').textContent}`]
   }
  ];
  const vY=sec2Y+20, vGap=14, vW=(fullW-vGap*4)/5, vH=134;
  vItems.forEach((v,i)=>{
   const vx=pad+i*(vW+vGap);
   roundedRect(ctx,vx,vY,vW,vH,18);
   ctx.fillStyle=v.hi?tier.dark:'rgba(14,18,30,.82)';
   ctx.fill();
   ctx.strokeStyle=v.hi?tier.color:'rgba(255,255,255,.12)';
   ctx.lineWidth=2;ctx.stroke();

   ctx.font='800 14px system-ui, sans-serif';
   ctx.fillStyle=v.hi?tier.color:'#9aa5bd';
   ctx.fillText(v.title,vx+16,vY+32);

   ctx.font='950 36px system-ui, sans-serif';
   ctx.fillStyle=v.hi?tier.color:'#ffffff';
   ctx.fillText(v.val,vx+16,vY+78);

   // One fixed font size across all tiles; concise labels are arranged in two lines.
   ctx.font='650 11px system-ui, sans-serif';
   ctx.fillStyle=v.hi?'#d8e8bd':'#9aa5bd';
   (v.details||[]).slice(0,2).forEach((line,j)=>{
    ctx.fillText(line,vx+16,vY+105+j*14,vW-32);
   });
  });

  // Нижний колонтитул расположен на том же расстоянии от нижнего края,
  // что и верхняя строка от верхнего края.
  const footerY=H-pad;
  ctx.font='900 19px system-ui, -apple-system, sans-serif';
  ctx.fillStyle='#e5eaf7';
  ctx.textBaseline='alphabetic';
  ctx.fillText('FILM REVIEW',pad,footerY);
  ctx.textAlign='right';
  ctx.font='900 19px system-ui, -apple-system, sans-serif';
  ctx.fillStyle='#e5eaf7';
  ctx.fillText(`${(window.reviewerName || 'Рецензент')} · ${new Date().toLocaleDateString('ru-RU')}`,W-pad,footerY);
  ctx.textAlign='left';

  const safeName=title.replace(/[\\/:*?"<>|]+/g,' ').trim().replace(/\s+/g,'-').slice(0,60)||'rzt-cinema';
  const link=document.createElement('a');
  link.download=`${safeName}-cineva.png`;
  link.href=canvas.toDataURL('image/png');
  link.click();
 }catch(error){
  alert('Не удалось создать PNG: '+error.message);
 }finally{
  button.disabled=false;button.textContent='Скачать PNG';
 }
}

window.reviewerName = '';
try { window.reviewerName = localStorage.getItem('cinevaReviewerName') || ''; } catch(e){}
try{reviewerName=localStorage.getItem('cinevaReviewerName')||'';}catch(e){}
const reviewerOverlay=$('reviewerOverlay');
function showReviewerSetup(){ $('reviewerNameInput').value=reviewerName; reviewerOverlay.hidden=false; $('reviewerNameInput').focus(); }
function saveReviewerName(){
 const value=$('reviewerNameInput').value.trim();
 if(!value){$('reviewerNameInput').focus();return;}
 window.reviewerName = value; $('reviewerHeaderName').textContent=reviewerName;
 try{localStorage.setItem('cinevaReviewerName',reviewerName);}catch(e){}
 reviewerOverlay.hidden=true;
}
const revSave = $('reviewerSave'); if (revSave) revSave.addEventListener('click',saveReviewerName);
const revInp = $('reviewerNameInput'); if (revInp) revInp.addEventListener('keydown',e=>{if(e.key==='Enter')saveReviewerName();});
const revEdit = $('reviewerEdit'); if (revEdit) revEdit.addEventListener('click',showReviewerSetup);
const rhn = $('reviewerHeaderName'); if (rhn) rhn.textContent = window.reviewerName || 'не задан';
// Имя рецензента необязательно: диалог открывается только по запросу из вкладки оценки.
reviewerOverlay.hidden=true;

const sImg = $('saveImage'); if (sImg) sImg.addEventListener('click',downloadCardPng);

const rBtn = $('reset'); if (rBtn) rBtn.addEventListener('click',()=>{
  clearTimeout(searchDebounce);if(tmdbSearchController)tmdbSearchController.abort();searchSequence++;
  ['title','director','year','genre'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  const tq = $('tmdbQuery'); if (tq) tq.value = '';
  clearTmdbResults();
  const ed = $('editorDetails'); if (ed) ed.hidden = true;
  setMetadataMode('unset');
  const rc = $('resultCard'); if (rc) rc.hidden = true;
  const layout = document.querySelector('.layout'); if (layout) layout.classList.remove('has-preview');
  const ts = $('tmdbStatus'); if (ts) ts.textContent = 'Введи название фильма или сериала.';
  const kd = $('kind'); if (kd) kd.selectedIndex = 0;
  criteriaData.forEach(c => { const el = $(c.id); if (el) el.value = 5; });
  const setVal = (id, v) => { const el = $(id); if (el) el.value = v; };
  setVal('vibe', 5);
  setVal('rarityGenre', '1.0');
  setVal('rarityFormat', '1.0');
  setVal('integFormat', '1.0');
  setVal('integGenre', '1.5');
  setVal('integMeaning', '1.0');
  setVal('depth', 3);
  setVal('impactScale', '2.0');
  setVal('impactHype', '2.0');
  setVal('posterFile', '');
  if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = null; }
  const pImg = $('posterImg'); if (pImg) { pImg.removeAttribute('src'); pImg.style.display = 'none'; }
  const pPh = $('posterPlaceholder'); if (pPh) pPh.style.display = 'block';
  if (document.documentElement && document.documentElement.style) {
    document.documentElement.style.setProperty('--art-a','#273a48');
    document.documentElement.style.setProperty('--art-b','#171923');
    document.documentElement.style.setProperty('--art-accent','#c5ff65');
  }
  update();
});

update();


// Rating Project Sharing via URL
function shareRatingProject() {
  try {
    const title = ($('title') ? $('title').value.trim() : '') || 'Кинопроизведение';
    const director = ($('director') ? $('director').value.trim() : '');
    const year = ($('year') ? $('year').value.trim() : '');
    const posterSrc = ($('posterImg') && $('posterImg').style.display !== 'none') ? $('posterImg').src : '';
    const scores = {};
    if (typeof criteriaData !== 'undefined') {
      criteriaData.forEach(c => {
        const inp = $(c.id);
        if (inp) scores[c.id] = inp.value;
      });
    }
    const payload = { t: title, d: director, y: year, p: posterSrc, s: scores, rev: window.reviewerName || '' };
    const b64 = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    const shareUrl = `${window.location.origin}${window.location.pathname}#rate=${b64}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        if (typeof window.showToast === 'function') window.showToast('🔗 Ссылка на оценку скопирована в буфер обмена!', 'success');
      }).catch(() => prompt('Скопируйте ссылку на оценку:', shareUrl));
    } else {
      prompt('Скопируйте ссылку на оценку:', shareUrl);
    }
  } catch (e) {
    console.error(e);
  }
}

function checkSharedRatingFromUrl() {
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    let rateParam = null;
    if (hash.includes('rate=')) rateParam = hash.split('rate=')[1].split('&')[0];
    else if (search.includes('rate=')) rateParam = new URLSearchParams(search).get('rate');
    if (rateParam) {
      const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(rateParam)))));
      if (payload && payload.t) {
        if ($('title')) $('title').value = payload.t || '';
        if ($('director')) $('director').value = payload.d || '';
        if ($('year')) $('year').value = payload.y || '';
        if (payload.p && $('posterImg')) {
          $('posterImg').src = payload.p;
          $('posterImg').style.display = 'block';
          if ($('posterPlaceholder')) $('posterPlaceholder').style.display = 'none';
        }
        if (payload.s) {
          Object.keys(payload.s).forEach(cid => {
            const inp = $(cid);
            if (inp) {
              inp.value = payload.s[cid];
              const valEl = $('val-' + cid);
              if (valEl) valEl.textContent = payload.s[cid];
            }
          });
        }
        if (payload.rev) {
          window.reviewerName = payload.rev;
          if ($('reviewerHeaderName')) $('reviewerHeaderName').textContent = payload.rev;
        }
        update();
        if (typeof window.showPage === 'function') window.showPage('rating');
        if (typeof window.showToast === 'function') window.showToast(`⭐ Загружена оценка для «${payload.t}»!`, 'success');
      }
    }
  } catch (e) {}
}

document.addEventListener('click', e => {
  const btn = e.target.closest('#ratingShareBtn');
  if (btn) { e.preventDefault(); shareRatingProject(); }
});
window.addEventListener('hashchange', checkSharedRatingFromUrl);

// Bridge exports for app.js
window.showToast = showToast;
window.isApiSetupComplete = isApiSetupComplete;
window.getTmdbKey = getTmdbKey;
window.getKpKey = getKpKey;
window.saveApiKeys = saveApiKeys;
window.setArtworkColors = setArtworkColors;
window.setMetadataMode = setMetadataMode;
window.updateRating = update;
window.update = update;
window.checkSharedRatingFromUrl = checkSharedRatingFromUrl;

})();
