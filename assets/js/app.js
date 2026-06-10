
const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav');
if(menuBtn && nav){menuBtn.addEventListener('click',()=>{nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', nav.classList.contains('open'));});}
const search = document.querySelector('#materialSearch');
if(search){search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase(); document.querySelectorAll('.material-card').forEach(card=>{const text=(card.innerText+' '+(card.dataset.keywords||'')).toLowerCase(); card.classList.toggle('hidden', q && !text.includes(q));});});}
document.querySelectorAll('[data-print]').forEach(btn=>btn.addEventListener('click',()=>window.print()));
const year = document.querySelector('[data-year]'); if(year) year.textContent = new Date().getFullYear();
