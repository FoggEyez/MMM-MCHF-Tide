const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={setProperty(key,value){this[key]=value;}};this.className='';this.text='';}
    append(...children){this.children.push(...children);}setAttribute(key,value){this.attributes[key]=String(value);}
    set textContent(value){this.text=String(value);}get textContent(){return this.text+this.children.map(c=>c.textContent).join(' ');}
  }
  const document={documentElement:new Element('html'),createElement:tag=>new Element(tag)};let definition;
  vm.runInNewContext(fs.readFileSync(require.resolve('../MMM-MCHF-Tide.js'),'utf8'),{document,Module:{register(name,value){definition=value;}}});
  const instance={...definition,config:{...definition.defaults},data:{position:'bottom_bar'},warning:false,lastStale:false,snapshot:{fetchedAt:Date.now(),indicators:[{id:'PAYEMS',label:'Payroll jobs',value:165000,date:'2026-10-01',basis:'monthly change',source:'https://fred.stlouisfed.org/series/PAYEMS'},{id:'A191RL1Q225SBEA',label:'Real GDP growth',value:3.4,date:'2026-07-01',basis:'annualized',source:'https://fred.stlouisfed.org/series/A191RL1Q225SBEA'}]}};
  return {instance,document,all:root=>[root,...root.children.flatMap(function walk(e){return[e,...e.children.flatMap(walk)];})]};
}
test('ticker preserves economic units, periods and accessible duplicate handling',()=>{
  const {instance,all}=fixture(),root=instance.getDom(),nodes=all(root);
  assert.ok(root.textContent.includes('+165k'));assert.ok(root.textContent.includes('Oct 2026'));assert.ok(root.textContent.includes('+3.4%'));assert.ok(root.textContent.includes('Q3 2026'));
  const groups=nodes.filter(e=>e.className==='econ-group');assert.equal(groups.length,2);assert.equal(groups[1].attributes['aria-hidden'],'true');
  instance.config.showPeriods=false;assert.ok(!all(instance.getDom()).some(e=>e.tag==='small'));
});
test('ticker follows native placement or explicit anchors with bounded dimensions',()=>{
  const {instance,document}=fixture();let root=instance.getDom();assert.ok(root.className.includes('econ-place-bottom'));assert.equal(document.documentElement.style['--econ-reserve'],'38px');
  instance.data.position='top_left';assert.ok(instance.getDom().className.includes('econ-place-region'));
  instance.data.position='top_bar';assert.ok(instance.getDom().className.includes('econ-place-top'));
  instance.config.placement='bottom-right';instance.config.panelWidth=99999;root=instance.getDom();assert.ok(root.className.includes('econ-place-bottom-right'));assert.equal(root.style['--econ-width'],'1600px');
  instance.config.placement='invalid';instance.config.panelWidth='invalid';assert.equal(instance.getDom().style['--econ-width'],'600px');
});
test('ticker distinguishes unavailable, saved and overdue data',()=>{
  const {instance}=fixture();instance.warning=true;assert.ok(instance.getDom().textContent.includes('Saved readings'));instance.lastStale=true;assert.ok(instance.getDom().textContent.includes('Refresh overdue'));instance.snapshot=null;assert.ok(instance.getDom().textContent.includes('unavailable'));
});
