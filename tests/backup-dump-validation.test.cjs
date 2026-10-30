const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const validator=path.join(__dirname,"..","scripts","verify_auth_dump.py");
function verify(sql){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"cwl-auth-dump-"));
 try{
  const target=path.join(temp,"auth-data.sql");
  fs.writeFileSync(target,sql,"utf8");
  return spawnSync("python3",[validator,target],{encoding:"utf8",timeout:5000});
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
test("Backup validator accepts a complete nonempty PostgreSQL auth users dump",()=>{
 const result=verify([
  "-- PostgreSQL database dump",
  "COPY auth.users (id, email) FROM stdin;",
  "test-uid\tuser@example.invalid",
  "\\.",
  "COPY auth.sessions (id) FROM stdin;",
  "\\.",
  "",
 ].join("\n"));
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/1 user row\(s\)/);
 assert.doesNotMatch(result.stdout,/user@example\.invalid/);
});
test("Backup validator also supports quoted auth schema names",()=>{
 const result=verify('COPY "auth"."users" (id) FROM stdin;\nuser-1\n\\.\n');
 assert.equal(result.status,0,result.stderr);
});
test("Backup validator refuses missing or empty auth users",()=>{
 for(const sample of [
  "COPY auth.sessions (id) FROM stdin;\ntest\n\\.\n",
  "COPY auth.users (id) FROM stdin;\n\\.\n",
  "COPY auth.users (id) FROM stdin;\nuser-1\n",
  "-- empty SQL dump\n"
 ]){
  const result=verify(sample);
  assert.equal(result.status,1,"Should fail: "+sample);
  assert.match(result.stderr,/Auth backup verification failed/);
 }
});
test("Encrypted backup workflow runs validator before encryption and never uploads plaintext",()=>{
 const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","encrypted-backup.yml"),"utf8");
 assert.match(workflow,/python3 scripts\/verify_auth_dump\.py/);
 assert.doesNotMatch(workflow,/grep -Eq/);
 const validatePos=workflow.indexOf("python3 scripts/verify_auth_dump.py");
 const encryptPos=workflow.indexOf("Encrypt, integrity-check and securely dispose of plaintext");
 const uploadPos=workflow.indexOf("Upload encrypted artifact only");
 assert.ok(validatePos>0&&validatePos<encryptPos&&encryptPos<uploadPos);
 assert.match(workflow,/sha256sum cwl-backup\.tar\.gz\.gpg/);
 assert.match(workflow,/cwl-backup\.tar\.gz\.gpg/);
 assert.doesNotMatch(workflow,/path:\s*\|[\s\S]*?\.sql[\s\S]*?retention-days:/);
});
