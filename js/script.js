/* BudgetTrip — roteiro, gastos por categoria e custo total estimado da viagem */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const banco = {
  ler(k, padrao) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } },
  salvar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } }
};
const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const deISO = (s) => new Date(s + 'T12:00');
const maisDias = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d); };
const entre = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5);
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtData = (s, ano = false) => deISO(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(ano ? { year: 'numeric' } : {}) }).replace('.', '');
function numero(t) {
  let s = String(t ?? '').replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
const fmtNum = (n) => (n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const HOJE = iso(new Date());

const CATS = {
  hospedagem: { nome: 'Hospedagem', emoji: '🏨', cor: '#1f7ae0' },
  transporte: { nome: 'Transporte', emoji: '🚗', cor: '#ff7a3d' },
  passeios: { nome: 'Passeios', emoji: '🎟️', cor: '#9b5de5' },
  alimentacao: { nome: 'Alimentação', emoji: '🍽️', cor: '#1f9d6a' },
  compras: { nome: 'Compras', emoji: '🛍️', cor: '#f15bb5' },
  outros: { nome: 'Outros', emoji: '📦', cor: '#8d99ae' }
};
const TEMAS = { praia: ['#00b4d8', '#ffd166', '🏖️'], serra: ['#2d6a4f', '#95d5b2', '🏔️'], cidade: ['#3a0ca3', '#4895ef', '🏙️'], neve: ['#4361ee', '#bde0fe', '❄️'], campo: ['#bc6c25', '#dda15e', '🌾'], exterior: ['#d62828', '#f77f00', '🌍'] };

function exemplos() {
  const ida = maisDias(HOJE, 38), volta = maisDias(ida, 4);
  const ida2 = maisDias(HOJE, 95), meio = maisDias(ida2, 3), volta2 = maisDias(ida2, 6);
  return [
    { id: 1, nome: 'Férias em Gramado', inicio: ida, fim: volta, pessoas: 2, orcamento: 5000, tema: 'serra', comidaDia: 140,
      destinos: [{ cidade: 'Gramado, RS', chegada: ida, saida: volta, nota: 'Hotel perto da Rua Coberta' }],
      gastos: [
        { id: 11, cat: 'hospedagem', desc: 'Pousada no centro', noites: 4, porNoite: 420, valor: 1680, porPessoa: false, pago: true },
        { id: 12, cat: 'transporte', desc: 'Combustível + pedágio (ida e volta)', valor: 320, porPessoa: false, pago: false },
        { id: 13, cat: 'passeios', desc: 'Snowland', valor: 290, porPessoa: true, pago: false },
        { id: 14, cat: 'passeios', desc: 'Trem Maria Fumaça', valor: 210, porPessoa: true, pago: false },
        { id: 15, cat: 'compras', desc: 'Chocolates e lembrancinhas', valor: 250, porPessoa: false, pago: false }
      ] },
    { id: 2, nome: 'Rio e Búzios', inicio: ida2, fim: volta2, pessoas: 3, orcamento: 9000, tema: 'praia', comidaDia: 120,
      destinos: [{ cidade: 'Rio de Janeiro, RJ', chegada: ida2, saida: meio, nota: '' }, { cidade: 'Búzios, RJ', chegada: meio, saida: volta2, nota: 'Ir de van' }],
      gastos: [
        { id: 21, cat: 'transporte', desc: 'Passagens aéreas POA ⇄ RIO', valor: 980, porPessoa: true, pago: true },
        { id: 22, cat: 'hospedagem', desc: 'Apartamento em Copacabana', noites: 3, porNoite: 520, valor: 1560, porPessoa: false, pago: false },
        { id: 23, cat: 'hospedagem', desc: 'Pousada em Búzios', noites: 3, porNoite: 480, valor: 1440, porPessoa: false, pago: false },
        { id: 24, cat: 'transporte', desc: 'Van Rio → Búzios', valor: 90, porPessoa: true, pago: false },
        { id: 25, cat: 'passeios', desc: 'Cristo Redentor', valor: 100, porPessoa: true, pago: false }
      ] }
  ];
}
let viagens = banco.ler('bt_viagens', null) ?? exemplos();
const salvar = () => banco.salvar('bt_viagens', viagens);
let atual = null, filtroCat = 'todas';

/* ---------- Cálculos ---------- */
const dias = (v) => Math.max(1, entre(v.inicio, v.fim) + 1);
const valorGasto = (g, v) => (g.cat === 'hospedagem' && g.noites ? g.noites * g.porNoite : g.valor) * (g.porPessoa ? v.pessoas : 1);
function custos(v) {
  const porCat = Object.fromEntries(Object.keys(CATS).map((k) => [k, 0]));
  v.gastos.forEach((g) => { porCat[g.cat] = (porCat[g.cat] || 0) + valorGasto(g, v); });
  const comida = (v.comidaDia || 0) * v.pessoas * dias(v);
  porCat.alimentacao += comida;
  const total = Object.values(porCat).reduce((s, x) => s + x, 0);
  const pago = v.gastos.filter((g) => g.pago).reduce((s, g) => s + valorGasto(g, v), 0);
  return { porCat, comida, total, pago, porPessoa: total / v.pessoas, porDia: total / dias(v) };
}
const tema = (v) => TEMAS[v.tema] || TEMAS.cidade;

/* ---------- Lista ---------- */
function telaLista() {
  atual = null;
  $('#tela-lista').hidden = false; $('#tela-viagem').hidden = true;
  const l = [...viagens].sort((a, b) => (a.fim < HOJE) - (b.fim < HOJE) || a.inicio.localeCompare(b.inicio));
  $('#viagens').innerHTML = l.length ? l.map((v) => {
    const c = custos(v), [a, b, em] = tema(v), falta = entre(HOJE, v.inicio);
    const pct = v.orcamento ? (c.total / v.orcamento) * 100 : 0;
    const quando = v.fim < HOJE ? 'Viagem concluída' : falta > 0 ? `Faltam ${falta} ${falta === 1 ? 'dia' : 'dias'}` : 'Em andamento 🎉';
    return `<li><button class="cartao-viagem" data-abrir="${v.id}">
      <div class="cv__capa" style="--a:${a};--b:${b}" data-emoji="${em}"><b>${escapar(v.nome)}</b><span>${fmtData(v.inicio)} – ${fmtData(v.fim, true)} · ${dias(v)} dias</span></div>
      <div class="cv__corpo">
        <div class="cv__linha"><span>Custo estimado</span><strong>${brlCurto(c.total)}</strong></div>
        ${v.orcamento ? `<div class="medidor" title="${Math.round(pct)}% do orçamento"><i class="${pct > 100 ? 'estourou' : ''}" style="width:${Math.min(100, pct)}%"></i></div>` : ''}
        <div class="cv__linha"><span>${v.pessoas} ${v.pessoas === 1 ? 'viajante' : 'viajantes'} · ${brlCurto(c.porPessoa)} por pessoa</span><span>${quando}</span></div>
      </div></button></li>`;
  }).join('') : '<li class="vazio">Nenhuma viagem planejada. Clique em “+ Nova viagem” para começar.</li>';
}
$('#viagens').addEventListener('click', (e) => { const b = e.target.closest('[data-abrir]'); if (b) telaViagem(+b.dataset.abrir); });
$('#ir-inicio').addEventListener('click', telaLista);
$('#voltar').addEventListener('click', telaLista);

/* ---------- Viagem ---------- */
function telaViagem(id) {
  atual = viagens.find((v) => v.id === id);
  if (!atual) { telaLista(); return; }
  $('#tela-lista').hidden = true; $('#tela-viagem').hidden = false;
  scrollTo(0, 0);
  desenharViagem();
}
function desenharViagem() {
  const v = atual, [a, b, em] = tema(v), falta = entre(HOJE, v.inicio);
  document.documentElement.style.setProperty('--a', a); document.documentElement.style.setProperty('--b', b);
  $('#capa').innerHTML = `<div><h1>${escapar(v.nome)} ${em}</h1><p>${fmtData(v.inicio)} – ${fmtData(v.fim, true)} · ${dias(v)} dias · ${v.pessoas} ${v.pessoas === 1 ? 'viajante' : 'viajantes'}</p></div>
    <div class="capa__dir">${v.fim >= HOJE ? `<div class="contagem"><strong>${falta > 0 ? falta : '✈'}</strong><span>${falta > 0 ? (falta === 1 ? 'dia para ir' : 'dias para ir') : 'boa viagem!'}</span></div>` : '<div class="contagem"><strong>✓</strong><span>concluída</span></div>'}
    <button class="btn-capa" id="editar-viagem">Editar</button></div>`;
  $('#editar-viagem').addEventListener('click', () => abrirViagem(v));

  // Roteiro em ordem de chegada, com aviso se sobrar ou faltar dia
  const ds = [...v.destinos].sort((x, y) => x.chegada.localeCompare(y.chegada));
  $('#roteiro').innerHTML = ds.length ? ds.map((d) => {
    const n = entre(d.chegada, d.saida);
    return `<li class="parada"><span class="parada__num">${v.destinos.indexOf(d) + 1}</span><div><b>${escapar(d.cidade)}</b><small>${fmtData(d.chegada)} → ${fmtData(d.saida)} · ${n} ${n === 1 ? 'noite' : 'noites'}${d.nota ? ` · ${escapar(d.nota)}` : ''}</small></div><button data-destino="${v.destinos.indexOf(d)}">Editar</button></li>`;
  }).join('') : '<li class="vazio" style="padding:20px">Adicione as cidades da viagem.</li>';
  const noitesRoteiro = ds.reduce((s, d) => s + entre(d.chegada, d.saida), 0), noitesViagem = entre(v.inicio, v.fim);
  const noitesHosp = v.gastos.filter((g) => g.cat === 'hospedagem').reduce((s, g) => s + (g.noites || 0), 0);
  let aviso = '';
  if (ds.length && noitesRoteiro !== noitesViagem) aviso = `O roteiro soma ${noitesRoteiro} noites, mas a viagem tem ${noitesViagem}.`;
  else if (noitesHosp && noitesHosp < noitesViagem) aviso = `Hospedagem cobre ${noitesHosp} de ${noitesViagem} noites.`;
  if (aviso) $('#roteiro').insertAdjacentHTML('beforeend', `<li class="aviso-datas">⚠ ${aviso}</li>`);

  // Gastos
  const usadas = Object.keys(CATS).filter((k) => v.gastos.some((g) => g.cat === k));
  if (filtroCat !== 'todas' && !usadas.includes(filtroCat)) filtroCat = 'todas';
  $('#cats-filtro').innerHTML = usadas.length > 1 ? [['todas', 'Todas'], ...usadas.map((k) => [k, `${CATS[k].emoji} ${CATS[k].nome}`])].map(([k, n]) => `<button data-filtro="${k}" aria-pressed="${filtroCat === k}">${n}</button>`).join('') : '';
  const gs = v.gastos.filter((g) => filtroCat === 'todas' || g.cat === filtroCat);
  $('#gastos').innerHTML = gs.length ? gs.map((g) => {
    const c = CATS[g.cat], val = valorGasto(g, v);
    const det = g.cat === 'hospedagem' && g.noites ? `${g.noites} ${g.noites === 1 ? 'noite' : 'noites'} × ${brl(g.porNoite)}` : g.porPessoa ? `${brl(g.valor)} × ${v.pessoas} pessoas` : c.nome;
    return `<li class="gasto" data-gasto="${g.id}" tabindex="0" role="button" aria-label="Editar ${escapar(g.desc)}"><span class="gasto__ico" style="--c:${c.cor}" aria-hidden="true">${c.emoji}</span>
      <div><b>${escapar(g.desc)}</b><small>${det}${g.pago ? ' · <span class="pago">✓ pago</span>' : ''}</small></div>
      <div class="gasto__valor">${brl(val)}</div></li>`;
  }).join('') : '<li class="vazio" style="padding:20px">Nenhum gasto ainda. Comece pela hospedagem e o transporte.</li>';

  // Alimentação
  if (document.activeElement !== $('#comida-dia')) $('#comida-dia').value = fmtNum(v.comidaDia);
  const c = custos(v);
  $('#comida-total').innerHTML = `${brl(v.comidaDia || 0)} × ${v.pessoas} ${v.pessoas === 1 ? 'pessoa' : 'pessoas'} × ${dias(v)} dias = <strong>${brl(c.comida)}</strong>`;
  $('#sug-comida').innerHTML = [['Econômico', 60], ['Moderado', 120], ['Confortável', 200]].map(([n, val]) => `<button data-comida="${val}">${n}: ${brlCurto(val)}/dia</button>`).join('');

  desenharResumo(c);
  salvar();
}
function desenharResumo(c) {
  const v = atual;
  const cats = Object.entries(c.porCat).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]);
  // gráfico de rosca em SVG
  const R = 15.9155, circ = 100;
  let acum = 0;
  const fatias = cats.map(([k, x]) => { const p = (x / (c.total || 1)) * circ; const s = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${CATS[k].cor}" stroke-width="6" stroke-dasharray="${p} ${circ - p}" stroke-dashoffset="${-acum}"><title>${CATS[k].nome}: ${brl(x)}</title></circle>`; acum += p; return s; }).join('');
  const pct = v.orcamento ? (c.total / v.orcamento) * 100 : 0;
  const sobra = v.orcamento - c.total;
  $('#resumo').innerHTML = `
    <div><h2>Custo total estimado</h2><div class="total">${brl(c.total)}</div></div>
    <div class="sub"><div><strong>${brl(c.porPessoa)}</strong><span>por pessoa</span></div><div><strong>${brl(c.porDia)}</strong><span>por dia</span></div></div>
    ${v.orcamento ? `<div class="orc"><h2>Orçamento: ${brlCurto(v.orcamento)}</h2><div class="orc__barra"><i class="${pct > 100 ? 'estourou' : pct > 85 ? 'alerta' : ''}" style="width:${Math.min(100, pct)}%"></i></div>
      <p>${sobra >= 0 ? `Sobram <b>${brl(sobra)}</b> (${Math.round(100 - pct)}%)` : `Passou <b>${brl(-sobra)}</b> do orçamento`}</p></div>` : ''}
    ${cats.length ? `<div class="rosca"><svg viewBox="0 0 42 42" role="img" aria-label="Gastos por categoria"><circle r="${R}" cx="21" cy="21" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6"/>${fatias}</svg>
      <ul class="legenda">${cats.map(([k, x]) => `<li style="--c:${CATS[k].cor}"><i></i><span>${CATS[k].nome}</span><span>${Math.round((x / c.total) * 100)}%</span></li>`).join('')}</ul></div>` : ''}
    <p class="pagamento">Já pago: <b>${brl(c.pago)}</b> · falta pagar ${brl(Math.max(0, c.total - c.pago))}</p>`;
}

$('#comida-dia').addEventListener('input', (e) => { atual.comidaDia = numero(e.target.value); desenharViagem(); });
$('#comida-dia').addEventListener('blur', (e) => { e.target.value = fmtNum(atual.comidaDia); });
$('#sug-comida').addEventListener('click', (e) => { const b = e.target.closest('[data-comida]'); if (b) { atual.comidaDia = +b.dataset.comida; $('#comida-dia').value = fmtNum(atual.comidaDia); desenharViagem(); } });
$('#cats-filtro').addEventListener('click', (e) => { const b = e.target.closest('[data-filtro]'); if (b) { filtroCat = b.dataset.filtro; desenharViagem(); } });
$('#gastos').addEventListener('click', (e) => { const li = e.target.closest('[data-gasto]'); if (li) abrirGasto(atual.gastos.find((g) => g.id === +li.dataset.gasto)); });
$('#gastos').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-gasto]')) e.target.click(); });
$('#roteiro').addEventListener('click', (e) => { const b = e.target.closest('[data-destino]'); if (b) abrirDestino(+b.dataset.destino); });

/* ---------- Viagem: criar/editar ---------- */
let editViagem = null;
$('#v-temas').innerHTML = Object.entries(TEMAS).map(([k, [a, b, em]], i) => `<label title="${k}"><input type="radio" name="tema" value="${k}" ${i === 0 ? 'checked' : ''} aria-label="${k}"><span style="--a:${a};--b:${b}">${em}</span></label>`).join('');
function abrirViagem(v = null) {
  editViagem = v;
  $('#dv-titulo').textContent = v ? 'Editar viagem' : 'Nova viagem';
  $('#v-nome').value = v?.nome || ''; $('#v-inicio').value = v?.inicio || maisDias(HOJE, 30); $('#v-fim').value = v?.fim || maisDias(HOJE, 34);
  $('#v-pessoas').value = v?.pessoas || 2; $('#v-orcamento').value = v?.orcamento ? fmtNum(v.orcamento) : '';
  document.querySelector(`[name=tema][value=${v?.tema || 'praia'}]`).checked = true;
  $('#v-erro').textContent = ''; $('#v-excluir').hidden = !v; $('#v-excluir').textContent = 'Excluir viagem';
  $('#dlg-viagem').showModal();
}
$('#nova-viagem').addEventListener('click', () => abrirViagem());
$('#form-viagem').addEventListener('submit', (e) => {
  if (e.submitter?.value === 'salvar' && $('#v-fim').value < $('#v-inicio').value) { e.preventDefault(); $('#v-erro').textContent = 'A volta precisa ser depois da ida.'; }
});
$('#dlg-viagem').addEventListener('close', () => {
  if ($('#dlg-viagem').returnValue !== 'salvar') return;
  const dados = { nome: $('#v-nome').value.trim(), inicio: $('#v-inicio').value, fim: $('#v-fim').value, pessoas: Math.max(1, Math.min(50, +$('#v-pessoas').value || 1)), orcamento: numero($('#v-orcamento').value), tema: document.querySelector('[name=tema]:checked').value };
  if (!dados.nome || !dados.inicio || !dados.fim) return;
  if (editViagem) { Object.assign(editViagem, dados); salvar(); desenharViagem(); toast('Viagem atualizada'); }
  else { const v = { id: Date.now(), destinos: [], gastos: [], comidaDia: 0, ...dados }; viagens.push(v); salvar(); telaViagem(v.id); toast('Viagem criada! Agora adicione o roteiro e os gastos.'); }
});
$('#v-excluir').addEventListener('click', (e) => {
  if (e.target.textContent !== 'Confirmar exclusão') { e.target.textContent = 'Confirmar exclusão'; return; }
  viagens = viagens.filter((v) => v !== editViagem); salvar(); $('#dlg-viagem').close(); telaLista(); toast('Viagem excluída');
});

/* ---------- Destinos ---------- */
let editDestino = null;
function abrirDestino(i = null) {
  editDestino = i;
  const d = i !== null ? atual.destinos[i] : null;
  const ultimo = [...atual.destinos].sort((a, b) => b.saida.localeCompare(a.saida))[0];
  $('#dd-titulo').textContent = d ? 'Editar destino' : 'Novo destino';
  $('#d-cidade').value = d?.cidade || ''; $('#d-chegada').value = d?.chegada || ultimo?.saida || atual.inicio; $('#d-saida').value = d?.saida || atual.fim; $('#d-nota').value = d?.nota || '';
  $('#d-chegada').min = $('#d-saida').min = atual.inicio; $('#d-chegada').max = $('#d-saida').max = atual.fim;
  $('#d-erro').textContent = ''; $('#d-excluir').hidden = !d; $('#d-excluir').textContent = 'Remover';
  $('#dlg-destino').showModal();
}
$('#add-destino').addEventListener('click', () => abrirDestino());
$('#form-destino').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'salvar') return;
  if ($('#d-saida').value < $('#d-chegada').value) { e.preventDefault(); $('#d-erro').textContent = 'A saída precisa ser depois da chegada.'; }
});
$('#dlg-destino').addEventListener('close', () => {
  if ($('#dlg-destino').returnValue !== 'salvar') return;
  const d = { cidade: $('#d-cidade').value.trim(), chegada: $('#d-chegada').value, saida: $('#d-saida').value, nota: $('#d-nota').value.trim() };
  if (!d.cidade) return;
  if (editDestino !== null) atual.destinos[editDestino] = d; else atual.destinos.push(d);
  desenharViagem();
});
$('#d-excluir').addEventListener('click', (e) => {
  if (e.target.textContent !== 'Confirmar') { e.target.textContent = 'Confirmar'; return; }
  atual.destinos.splice(editDestino, 1); $('#dlg-destino').close(); desenharViagem();
});

/* ---------- Gastos ---------- */
let editGasto = null;
$('#g-cats').innerHTML = Object.entries(CATS).filter(([k]) => k !== 'alimentacao' || true).map(([k, c], i) => `<label><input type="radio" name="gcat" value="${k}" ${i === 0 ? 'checked' : ''}><span>${c.emoji} ${c.nome}</span></label>`).join('');
function ajustarFormGasto() {
  const cat = document.querySelector('[name=gcat]:checked').value, hosp = cat === 'hospedagem';
  $('#g-linha-noites').hidden = !hosp; $('#g-linha-valor').hidden = hosp;
  const g = { cat, noites: Math.max(1, +$('#g-noites').value || 1), porNoite: numero($('#g-por-noite').value), valor: numero($('#g-valor').value), porPessoa: !hosp && $('#g-por-pessoa').checked };
  const total = valorGasto(g, atual);
  $('#g-calculo').textContent = total ? (hosp ? `${g.noites} × ${brl(g.porNoite)} = ${brl(total)}` : g.porPessoa ? `${brl(g.valor)} × ${atual.pessoas} pessoas = ${brl(total)}` : `Total: ${brl(total)}`) : '';
  $('#g-desc').placeholder = { hospedagem: 'Ex.: Hotel no centro', transporte: 'Ex.: Passagem aérea, combustível', passeios: 'Ex.: Ingresso do parque', alimentacao: 'Ex.: Jantar especial', compras: 'Ex.: Lembrancinhas', outros: 'Ex.: Seguro viagem' }[cat];
}
function abrirGasto(g = null) {
  editGasto = g;
  $('#dg-titulo').textContent = g ? 'Editar gasto' : 'Novo gasto';
  document.querySelector(`[name=gcat][value=${g?.cat || (filtroCat !== 'todas' ? filtroCat : 'hospedagem')}]`).checked = true;
  $('#g-desc').value = g?.desc || ''; $('#g-noites').value = g?.noites || Math.max(1, entre(atual.inicio, atual.fim));
  $('#g-por-noite').value = fmtNum(g?.porNoite || 0); $('#g-valor').value = fmtNum(g?.valor || 0);
  $('#g-por-pessoa').checked = !!g?.porPessoa; $('#g-pago').checked = !!g?.pago;
  $('#g-erro').textContent = ''; $('#g-excluir').hidden = !g; $('#g-excluir').textContent = 'Excluir';
  ajustarFormGasto();
  $('#dlg-gasto').showModal();
}
$('#add-gasto').addEventListener('click', () => abrirGasto());
$('#form-gasto').addEventListener('input', ajustarFormGasto);
$('#form-gasto').addEventListener('change', (e) => { if (e.target.matches('#g-valor, #g-por-noite')) e.target.value = fmtNum(numero(e.target.value)); });
$('#form-gasto').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'salvar') return;
  const cat = document.querySelector('[name=gcat]:checked').value;
  const v = cat === 'hospedagem' ? numero($('#g-por-noite').value) : numero($('#g-valor').value);
  if (!$('#g-desc').value.trim()) { e.preventDefault(); $('#g-erro').textContent = 'Dê um nome para o gasto.'; return; }
  if (!v) { e.preventDefault(); $('#g-erro').textContent = 'Informe um valor maior que zero.'; }
});
$('#dlg-gasto').addEventListener('close', () => {
  if ($('#dlg-gasto').returnValue !== 'salvar') return;
  const cat = document.querySelector('[name=gcat]:checked').value, hosp = cat === 'hospedagem';
  const dados = { cat, desc: $('#g-desc').value.trim(), pago: $('#g-pago').checked, porPessoa: !hosp && $('#g-por-pessoa').checked };
  if (hosp) { dados.noites = Math.max(1, +$('#g-noites').value || 1); dados.porNoite = numero($('#g-por-noite').value); dados.valor = dados.noites * dados.porNoite; }
  else { dados.valor = numero($('#g-valor').value); dados.noites = 0; dados.porNoite = 0; }
  if (!dados.desc || !dados.valor) return;
  if (editGasto) Object.assign(editGasto, dados); else atual.gastos.push({ id: Date.now(), ...dados });
  desenharViagem(); toast(editGasto ? 'Gasto atualizado' : `${CATS[cat].emoji} Gasto adicionado`);
});
$('#g-excluir').addEventListener('click', (e) => {
  if (e.target.textContent !== 'Confirmar') { e.target.textContent = 'Confirmar'; return; }
  atual.gastos = atual.gastos.filter((g) => g !== editGasto); $('#dlg-gasto').close(); desenharViagem(); toast('Gasto excluído');
});
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

let timerToast;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(timerToast); timerToast = setTimeout(() => { t.hidden = true; }, 2600); }

telaLista();
