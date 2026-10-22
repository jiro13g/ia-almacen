const inv = {
  "Jabón Líquido":{x:2,y:4,stock:5,uso:"manos"},
  "Desinfectante":{x:4,y:1,stock:4,uso:"pisos"},
  "Detergente en Polvo":{x:1,y:5,stock:3,uso:"ropa"},
  "Esponjas":{x:3,y:2,stock:10,uso:"platos"}
};
const zones = {"0,0":"Recepción","5,5":"Rampa","5,0":"Muelle local","5,2":"Muelle nacional","0,5":"Almacén central"};
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Queue{
  constructor(){this.items=[];this.waiters=[]}
  put(v){this.waiters.length?this.waiters.shift()(v):this.items.push(v)}
  get(){return this.items.length?Promise.resolve(this.items.shift()):new Promise(r=>this.waiters.push(r))}
}
const red = {ordenes:new Queue(), listos:new Queue(), alertas:new Queue()};

// ---- Piso ----
const grid = document.getElementById('grid'), floor = document.getElementById('floor');
function drawGrid(){
  grid.innerHTML = '';
  for(let y=0;y<6;y++)for(let x=0;x<6;x++){
    const c = document.createElement('div'); c.className='cell';
    const s = Object.entries(inv).find(([,d])=>d.x===x&&d.y===y);
    if(s){
      c.className += ' shelf' + (s[1].stock<=1?' low':'');
      c.innerHTML = `<span>${s[0]}</span><b>${s[1].stock} u.</b>`;
    } else if(zones[x+','+y]){ c.className += ' zone'; c.textContent = zones[x+','+y]; }
    grid.appendChild(c);
  }
}
drawGrid();

class Robot{
  constructor(id,rol,x,y,color,letter){
    Object.assign(this,{id,rol,x,y});
    this.el = document.createElement('div'); this.el.className='bot';
    this.el.innerHTML = `<span style="background:var(--${color})" title="${id} · ${rol}">${letter}</span>`;
    floor.appendChild(this.el); this.place();
  }
  place(){ this.el.style.left = (this.x/6*100)+'%'; this.el.style.top = (this.y/6*100)+'%'; }
  async mover(xd,yd,v=0.3){
    while(this.x!==xd||this.y!==yd){
      if(this.x<xd)this.x++; else if(this.x>xd)this.x--;
      if(this.y<yd)this.y++; else if(this.y>yd)this.y--;
      this.place(); await sleep(v*1000);
    }
  }
}
const alfa = new Robot("Alfa","Receptor",0,0,"rose","A");
const beta = new Robot("Beta","Recolector",3,3,"moss","B");
const gamma= new Robot("Gamma","Repartidor",5,0,"plum","G");
const delta= new Robot("Delta","Reabastecedor",0,5,"sky","D");

const logEl = document.getElementById('log');
function log(cls,msg){
  const d=document.createElement('div'); d.className=cls; d.textContent=msg;
  logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight;
}

// ---- Nodos ----
async function nodoAlfa(p){
  log('a',`Alfa está programando el despacho para ${p.ciudad}…`);
  await sleep(1000);
  red.ordenes.put(p);
}
async function nodoBeta(){
  while(true){
    const p = await red.ordenes.get();
    const info = inv[p.producto], v = p.periodo==="Inmediato"?0.15:0.3;
    log('b',`Beta toma el pedido ${p.id}: ${p.unidades} u. de ${p.producto}.`);
    if(info.stock>=p.unidades){
      info.stock -= p.unidades;
      await beta.mover(info.x,info.y,v); drawGrid();
      log('b',`Recogidas ${p.unidades} u. Quedan ${info.stock} en el estante.`);
      if(info.stock===0){ log('w','Estante vacío. Beta avisa a Delta.'); red.alertas.put(p.producto); }
      await beta.mover(5,5,v);
      red.listos.put(p);
    } else {
      log('w',`Stock insuficiente: pidió ${p.unidades} u. y hay ${info.stock}.`);
      if(info.stock>0){
        const resto = info.stock; info.stock = 0;
        await beta.mover(info.x,info.y,v); drawGrid();
        red.alertas.put(p.producto);
        await beta.mover(5,5,v);
        p.unidades = resto; red.listos.put(p);
      } else { drawGrid(); red.alertas.put(p.producto); log('w','No hay nada que despachar. Delta reabastecerá el estante.'); done(); }
    }
  }
}
async function nodoGamma(){
  while(true){
    const p = await red.listos.get();
    log('g',`Gamma prepara la salida de ${p.id}.`);
    let transporte, muelle, demora, salida;
    if(p.lugar==="Local"){
      transporte="Motocicleta eléctrica"; muelle=[5,0]; demora="45 a 90 minutos";
      const h = new Date(Date.now()+2*3600e3);
      salida = p.periodo==="Inmediato" ? "Sale de inmediato" : "A las "+h.toTimeString().slice(0,5);
    } else {
      transporte="Camión de carga troncal"; muelle=[5,2]; demora="24 a 48 horas hábiles";
      salida="Hoy a las 20:00 (ruta nocturna nacional)";
    }
    await gamma.mover(muelle[0],muelle[1], p.periodo==="Inmediato"?0.1:0.3);
    document.getElementById('doc').className='ticket';
    document.getElementById('doc').innerHTML = `<h3>${p.id}</h3><dl>
      <dt>Destino</dt><dd>${esc(p.ciudad)} (${p.lugar})</dd>
      <dt>Dirección</dt><dd>${esc(p.direccion)}</dd>
      <dt>Contenido</dt><dd>${p.unidades} u. de ${p.producto}</dd>
      <dt>Ventana</dt><dd>${p.horario}</dd>
      <dt>Transporte</dt><dd>${transporte}</dd>
      <dt>Demora estimada</dt><dd>${demora}</dd>
      <dt>Próxima salida</dt><dd>${salida}</dd></dl>`;
    log('g','Documento de despacho generado.');
    await sleep(800); await gamma.mover(5,0,0.2);
    done();
  }
}
async function nodoDelta(){
  while(true){
    const prod = await red.alertas.get();
    log('d',`Delta atiende la alerta: reabastecerá «${prod}» en 3 segundos.`);
    await delta.mover(0,5);
    await sleep(3000);
    const info = inv[prod];
    await delta.mover(info.x,info.y);
    info.stock += 10; drawGrid();
    log('d',`Inventario reabastecido a las ${new Date().toLocaleTimeString('es-CO')}. Nuevo stock de «${prod}»: ${info.stock} u.`);
    await delta.mover(0,5);
  }
}
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const btn = document.getElementById('go');
function done(){ btn.disabled=false; btn.textContent='Enviar otro pedido'; }

nodoBeta(); nodoGamma(); nodoDelta();

btn.addEventListener('click',()=>{
  const g = id => document.getElementById(id).value;
  const periodo = g('per');
  const p = {
    id:"Pedido #LOG_"+(100+Math.floor(Math.random()*900)),
    producto:g('uso'),
    unidades:Math.max(1,parseInt(g('cant'))||1),
    ciudad:g('ciudad').trim()||"Sin ciudad",
    direccion:g('dir').trim()||"Sin dirección",
    lugar:g('lugar'),
    periodo,
    horario: periodo==="Inmediato" ? "Inmediato (siguiente bloque horario)" : g('hor')
  };
  btn.disabled=true; btn.textContent='Los robots están trabajando…';
  document.getElementById('doc').className='empty';
  document.getElementById('doc').textContent='Gamma todavía no entrega el paquete.';
  log('a',`Orden registrada para ${p.ciudad.toUpperCase()}.`);
  nodoAlfa(p);
});
