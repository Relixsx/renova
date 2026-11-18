import {DatabaseSync} from 'node:sqlite';
export type Pending={jobId:string;attemptToken:string;result:'SENT'|'UNCERTAIN'|'NOT_ATTEMPTED';messageId?:string};
export class Journal {
 private db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path);this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS sends(attempt TEXT PRIMARY KEY,job TEXT NOT NULL,result TEXT NOT NULL,message_id TEXT,reported INTEGER NOT NULL DEFAULT 0,ack INTEGER,ack_reported INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); UPDATE sends SET result='UNCERTAIN' WHERE result IN('AUTHORISED','CALLING');");}
 begin(job:string,attempt:string){this.db.prepare("INSERT INTO sends(attempt,job,result) VALUES(?,?,'AUTHORISED')").run(attempt,job);}
 has(attempt:string){return Boolean(this.db.prepare('SELECT 1 FROM sends WHERE attempt=?').get(attempt));}
 sentForJob(job:string){return Boolean(this.db.prepare("SELECT 1 FROM sends WHERE job=? AND result='SENT'").get(job));}
 calling(attempt:string){this.db.prepare("UPDATE sends SET result='CALLING' WHERE attempt=? AND result='AUTHORISED'").run(attempt);}
 finish(value:Pending){this.db.prepare('UPDATE sends SET result=?,message_id=?,reported=0 WHERE attempt=?').run(value.result,value.messageId??null,value.attemptToken);}
 pending():Pending[]{return this.db.prepare("SELECT job AS jobId,attempt AS attemptToken,result,message_id AS messageId FROM sends WHERE reported=0 AND result IN('SENT','UNCERTAIN','NOT_ATTEMPTED')").all() as Pending[];}
 reported(attempt:string){this.db.prepare('UPDATE sends SET reported=1 WHERE attempt=?').run(attempt);}
 ack(messageId:string,value:number){this.db.prepare('UPDATE sends SET ack=CASE WHEN ack IS NULL THEN ? ELSE MAX(ack,?) END,ack_reported=0 WHERE message_id=?').run(value,value,messageId);}
 pendingAcks(){return this.db.prepare('SELECT job AS jobId,attempt AS attemptToken,message_id AS messageId,ack FROM sends WHERE reported=1 AND ack IS NOT NULL AND ack_reported=0').all();}
 ackReported(attempt:string,value:number){this.db.prepare('UPDATE sends SET ack_reported=1 WHERE attempt=? AND ack=?').run(attempt,value);}
 close(){this.db.close();}
}
