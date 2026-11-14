// Pure validation and response projection for the authenticated player proxy.
export const cleanPlayerTag=value=>{
 const t=String(value||"").trim().toUpperCase();
 return t.startsWith("#")?t:t?"#"+t:"";
};
export const validPlayerTag=tag=>/^#[0289PYLQGRJCUV]{3,15}$/.test(tag);
export const validClanId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||""));
export function projectCurrentPlayer(raw,requestedTag,checkedAt){
 const tag=cleanPlayerTag(raw?.tag),wanted=cleanPlayerTag(requestedTag);
 const th=Number(raw?.townHallLevel);
 if(!validPlayerTag(tag)||tag!==wanted||
   !Number.isInteger(th)||th<1||th>25)return null;
 const clanTag=cleanPlayerTag(raw?.clan?.tag);
 return {
   tag,name:String(raw?.name||"").slice(0,80),
   townHallLevel:th,
   clan:validPlayerTag(clanTag)?{
     tag:clanTag,name:String(raw?.clan?.name||"").slice(0,80)
   }:null,
   checkedAt
 };
}
