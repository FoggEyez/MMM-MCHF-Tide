/* global Module */
Module.register('MMM-MCHF-Tide',{
 requiresVersion:'2.38.0',
  defaults:{scrollSeconds:90,showPeriods:true,placement:'auto',panelWidth:600,horizontalMargin:12,verticalMargin:6,offsetX:0,offsetY:0,textSize:'normal',backgroundOpacity:97},
  getStyles(){return [this.file('mischief-surfaces.css'),this.file('MMM-MCHF-Tide.css')];},
  start(){this.snapshot=null;this.warning=false;this.lastStale=false;this.sendSocketNotification('ECON_START');this.timer=setInterval(()=>{const stale=!!this.snapshot&&Date.now()-this.snapshot.fetchedAt>172800000;if(stale!==this.lastStale){this.lastStale=stale;this.updateDom(0);}},60000);},
  suspend(){clearInterval(this.timer);this.reserveObserver?.disconnect();},
  resume(){this.start();if(this.band)this.reserveObserver?.observe(this.band);},
  socketNotificationReceived(name,payload){if(name!=='ECON_DATA')return;this.snapshot=payload.snapshot;this.warning=payload.warning;this.lastStale=!!this.snapshot&&Date.now()-this.snapshot.fetchedAt>172800000;this.updateDom(0);},
  element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;},
  updateReserve(){const height=this.band?.isConnected?this.band.getBoundingClientRect().height:32;if(this.bottomBand)document.documentElement.style.setProperty('--econ-reserve',Math.max(0,Math.ceil(height)+this.reserveGap)+'px');},
  period(row){const date=new Date(row.date+'T12:00:00Z');if(row.id==='A191RL1Q225SBEA')return 'Q'+(Math.floor(date.getUTCMonth()/3)+1)+' '+date.getUTCFullYear();return date.toLocaleDateString('en-US',{month:'short',...(row.id==='DFF'||row.id==='DGS10'?{day:'numeric'}:{}),year:'numeric',timeZone:'UTC'});},
  getDom(){
    const band=this.element('section','econ-band');band.setAttribute('aria-label','U.S. economic indicators');
    const number=(value,min,max,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
    const allowed=['auto','region','top','bottom','top-left','top-right','bottom-left','bottom-right','center-left','center-right'];let placement=allowed.includes(this.config.placement)?this.config.placement:'auto';if(placement==='auto')placement=this.data?.position==='bottom_bar'?'bottom':this.data?.position==='top_bar'?'top':'region';
    band.className+=' econ-place-'+placement+(this.config.textSize==='large'?' econ-text-large':'');
    const gap=number(this.config.verticalMargin,0,100,6),dy=number(this.config.offsetY,-500,500,0);
    for(const[key,value]of Object.entries({'--econ-width':number(this.config.panelWidth,280,1600,600)+'px','--econ-gap-x':number(this.config.horizontalMargin,0,100,12)+'px','--econ-gap-y':gap+'px','--econ-offset-x':number(this.config.offsetX,-500,500,0)+'px','--econ-offset-y':dy+'px','--econ-alpha':String(number(this.config.backgroundOpacity,0,100,97)/100)}))band.style.setProperty(key,value);
    this.band=band;this.bottomBand=placement==='bottom';this.reserveGap=gap-dy;if(typeof ResizeObserver==='function'){if(!this.reserveObserver)this.reserveObserver=new ResizeObserver(()=>this.updateReserve());this.reserveObserver.disconnect();this.reserveObserver.observe(band);}this.updateReserve();
    const label=this.element('div','econ-label','MCHF TIDE · FRED');label.title='U.S. economy: latest releases via FRED · BEA / BLS / Federal Reserve';band.append(label);
    if(!this.snapshot){band.append(this.element('span','econ-note',this.warning?'Economic data unavailable · retrying':'Loading official economic readings…'));return band;}
    const viewport=this.element('div','econ-window'),track=this.element('div','econ-track');track.style.animationDuration=Math.min(240,Math.max(30,Number(this.config.scrollSeconds)||90))+'s';
    for(let copy=0;copy<2;copy++){
      const group=this.element('div','econ-group');if(copy)group.setAttribute('aria-hidden','true');
      for(const row of this.snapshot.indicators){const item=this.element('div','econ-item');item.title=row.label+' · '+row.date+' · '+row.basis+' · '+row.source;const value=row.id==='PAYEMS'?(row.value>0?'+':'')+Math.round(row.value/1000).toLocaleString('en-US')+'k':(row.id==='A191RL1Q225SBEA'&&row.value>0?'+':'')+row.value.toFixed(row.id==='DFF'||row.id==='DGS10'?2:1)+'%';item.append(this.element('span','econ-name',row.label),this.element('strong','',value));if(this.config.showPeriods!==false)item.append(this.element('small','',this.period(row)+' · '+row.basis));group.append(item);}
      track.append(group);
    }
    viewport.append(track);band.append(viewport);if(this.warning||this.lastStale)band.append(this.element('span','econ-note',this.lastStale?'Refresh overdue':'Saved readings'));
    return band;
  }
});
