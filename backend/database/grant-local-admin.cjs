// Explicit local operator action; public registration never grants ADMIN.
const fs=require('node:fs'),path=require('node:path');const {parseEnv}=require('node:util');const {Client}=require('pg');
(async()=>{
  const email=process.argv[2]?.trim().toLowerCase();if(!email)throw new Error('Usage: node backend/database/grant-local-admin.cjs registered-email');
  const env=parseEnv(fs.readFileSync(path.join(__dirname,'../.env'),'utf8'));const url=new URL(env.DATABASE_URL);
  if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local database required');
  const db=new Client({connectionString:url.toString()});
  try{await db.connect();await db.query('BEGIN');
    const {rows}=await db.query("SELECT id FROM users WHERE lower(email)=$1 AND status='ACTIVE' FOR UPDATE",[email]);if(rows.length!==1)throw new Error('Register an active user first');
    await db.query("INSERT INTO user_role_memberships(user_id,role,status) VALUES($1,'ADMIN','ACTIVE') ON CONFLICT(user_id,role) DO UPDATE SET status='ACTIVE'",[rows[0].id]);
    await db.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,reason) VALUES($1,'LOCAL_ADMIN_GRANTED','USER',$1,'Explicit local operator provisioning')",[rows[0].id]);
    await db.query('COMMIT');console.log('ADMIN granted. Sign in again and select ADMIN.');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
})().catch(e=>{console.error(e.code || e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
