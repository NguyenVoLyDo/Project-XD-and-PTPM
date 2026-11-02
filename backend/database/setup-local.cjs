// Local bootstrap/additive migration only. Never runs the reset preamble in init.sql.
const fs=require('node:fs'),path=require('node:path');
const {parseEnv}=require('node:util');const {Client}=require('pg');
(async()=>{
  const env=parseEnv(fs.readFileSync(path.join(__dirname,'../.env'),'utf8'));
  const url=new URL(env.DATABASE_URL);
  if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local PostgreSQL required');
  const name=decodeURIComponent(url.pathname.slice(1));
  if(!name || ['postgres','template0','template1'].includes(name))throw new Error('Dedicated application database required');
  const maintenance=new URL(url);maintenance.pathname='/postgres';
  const admin=new Client({connectionString:maintenance.toString()});
  try{await admin.connect();const found=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);
    if(!found.rowCount)await admin.query('CREATE DATABASE "'+name.replaceAll('"','""')+'"');
  }finally{await admin.end();}
  const db=new Client({connectionString:url.toString()});
  try{await db.connect();await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(82731)');
    const tables=await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    if(!tables.rowCount){const sql=fs.readFileSync(path.join(__dirname,'init.sql'),'utf8');const start=sql.indexOf('CREATE EXTENSION IF NOT EXISTS');if(start<0)throw new Error('Bootstrap marker missing');await db.query(sql.slice(start).replace(/^\\ir .*$/gm,''));}
    else if(!tables.rows.some(r=>r.tablename==='users') || !tables.rows.some(r=>r.tablename==='customer_orders'))throw new Error('Unrecognized existing schema; no migration applied');
    for(const f of ['01-nguoi1-identity-sessions.sql','05-integration-commerce.sql'])await db.query(fs.readFileSync(path.join(__dirname,'schema',f),'utf8'));
    await db.query('COMMIT');console.log(JSON.stringify({database:name,status:'READY',existingTables:tables.rowCount,reset:false}));
  }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
})().catch(e=>{console.error('Database setup failed:',e.code || e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
