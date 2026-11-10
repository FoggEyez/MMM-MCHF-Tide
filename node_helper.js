const NodeHelper=require('node_helper');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process');
const CACHE=path.join(os.homedir(),'.cache/MMM-MCHF-Tide/economy.json');
const valid=data=>data?.version===1&&Number.isFinite(data.fetchedAt)&&data.fetchedAt<=Date.now()+30000&&Array.isArray(data.indicators)&&data.indicators.length>=4&&data.indicators.length<=6&&data.indicators.every(row=>typeof row.label==='string'&&Number.isFinite(row.value)&&/^\d{4}-\d{2}-\d{2}$/.test(row.date));
module.exports=NodeHelper.create({
  start(){this.started=false;this.stopped=false;this.snapshot=null;this.warning=false;},
  socketNotificationReceived(name){if(name!=='ECON_START')return;if(this.snapshot)this.sendSocketNotification('ECON_DATA',{snapshot:this.snapshot,warning:this.warning});if(!this.started){this.started=true;this.load();}},
  async load(){try{const stat=await fs.stat(CACHE);if(stat.size<65536){const data=JSON.parse(await fs.readFile(CACHE,'utf8'));if(valid(data)){this.snapshot=data;this.sendSocketNotification('ECON_DATA',{snapshot:data,warning:false});}}}catch{}
    if(this.snapshot&&Date.now()-this.snapshot.fetchedAt<21600000)this.timer=setTimeout(()=>this.refresh(),21600000-(Date.now()-this.snapshot.fetchedAt));else this.refresh();
  },
  async refresh(){
    try{
      const data=await new Promise((resolve,reject)=>{this.child=execFile('python3',[path.join(__dirname,'fetch_economy.py')],{timeout:35000,maxBuffer:65536,windowsHide:true},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout));}catch(e){reject(e);}});});
      if(!valid(data))throw Error('Invalid observations');
      if(this.stopped)return;
      this.snapshot=data;this.warning=false;
      await fs.mkdir(path.dirname(CACHE),{recursive:true,mode:0o700});const temp=CACHE+'.'+process.pid+'.pending';
      try{await fs.writeFile(temp,JSON.stringify(data),{mode:0o600,flag:'w'});await fs.rename(temp,CACHE);}finally{await fs.unlink(temp).catch(()=>{});}
    }catch{this.warning=true;}
    if(!this.stopped){this.sendSocketNotification('ECON_DATA',{snapshot:this.snapshot,warning:this.warning});this.timer=setTimeout(()=>this.refresh(),this.warning?(this.snapshot?3600000:300000):21600000);}
  },
  stop(){this.stopped=true;clearTimeout(this.timer);this.child?.kill();}
});
