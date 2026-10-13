"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, SlidersHorizontal, Grid2X2, List, Stethoscope, Eye, Bone, HeartPulse, Ear, Sparkles, Smile } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { specialtyKeys } from "@/lib/i18n";
import { emptyPreferences, filterDoctors } from "@/lib/mock-service";
import type { Preferences } from "@/types";
import { DoctorCard, CompareBar } from "./doctor-card";
import { PreferenceFields } from "./preferences-form";
import { Button, Modal, EmptyState, PageHeading, Skeleton } from "@/components/ui/primitives";
import { api,type SearchResult } from "@/lib/api/client";
const icons=[Stethoscope,Sparkles,Bone,Eye,HeartPulse,Smile,Ear];
function readPreferences(params:URLSearchParams):Preferences {
  const s=params.get("specialty"),g=params.get("gov"),gender=params.get("gender"),timing=params.get("timing"),sub=params.get("sub");
  return {...emptyPreferences,
    specialty:s&&/^[a-z][a-z0-9-]{1,70}$/.test(s)?s:"all",
    governorate:g&&["cairo","giza","alexandria"].includes(g)?g as Preferences["governorate"]:"all",
    area:params.get("area")||"all",maxFee:Math.max(100,Math.min(5000,Number(params.get("fee")||2000)||2000)),
    subspecialty:sub&&/^[a-z][a-z0-9-]{1,70}$/.test(sub)?sub:"all",
    maxDays:[1,3].includes(Number(params.get("days")))?Number(params.get("days")):30,
    gender:gender==="female"||gender==="male"?gender:"all",timing:timing==="morning"||timing==="evening"?timing:"all"};
}
export function Discovery() {
  const {t,doctors,lang,l,integration,cacheDoctors,specialties}=useApp(),router=useRouter(),params=useSearchParams();
  const value=readPreferences(params);
  const categories=integration?.mode==="demo"?specialties.filter(s=>s.active).map(s=>s.slug):specialtyKeys;
  const [filterOpen,setFilterOpen]=useState(false),[draft,setDraft]=useState(value),[view,setView]=useState<"grid"|"list">("grid");
  const [pending,startTransition]=useTransition();
  const sort=params.get("sort")||"availability";
  const queryKey=params.toString()+"|"+lang,page=Math.max(1,Number(params.get("page")||1));
  const [remote,setRemote]=useState<{key:string;result:SearchResult}|null>(null),[remoteError,setRemoteError]=useState("");
  useEffect(()=>{
    if(integration?.mode!=="demo")return;
    const controller=new AbortController();
    api.doctors(value,params.get("q")||"",sort,page,lang,controller.signal).then(result=>{setRemote({key:queryKey,result});cacheDoctors(result.doctors);}).catch(error=>{if(error.name!=="AbortError")setRemoteError(queryKey);});
    return()=>controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[queryKey,integration?.mode]);
  // Form text is keyed to URL below, so back/forward restores the visible search.
  useEffect(()=>{document.title=t("doctors")+" | MEENDOC";},[t]);
  const update=(preferences:Preferences,query=params.get("q")||"",nextSort=sort)=>{
    const next=new URLSearchParams();
    if(query)next.set("q",query);
    if(preferences.specialty!=="all")next.set("specialty",preferences.specialty);
    if(preferences.governorate!=="all")next.set("gov",preferences.governorate);
    if(preferences.area!=="all")next.set("area",preferences.area);
    if(preferences.maxFee!==2000)next.set("fee",String(preferences.maxFee));
    if(preferences.gender!=="all")next.set("gender",preferences.gender);
    if(preferences.timing!=="all")next.set("timing",preferences.timing);
    if(preferences.subspecialty!=="all")next.set("sub",preferences.subspecialty);
    if(preferences.maxDays!==30)next.set("days",String(preferences.maxDays));
    if(nextSort!=="availability")next.set("sort",nextSort);
    startTransition(()=>router.replace("/doctors"+(next.size?"?"+next.toString():""),{scroll:false}));
  };
  const results=integration?.mode==="demo"?remote?.key===queryKey?remote.result.doctors:[]:filterDoctors(doctors,value,params.get("q")||"");
  if(integration?.mode!=="demo"&&sort==="price")results.sort((a,b)=>a.fee-b.fee);
  if(integration?.mode!=="demo"&&sort==="name")results.sort((a,b)=>l(a.name).localeCompare(l(b.name),lang));
  const total=integration?.mode==="demo"&&remote?.key===queryKey?remote.result.total:results.length;
  const remoteLoading=integration?.mode==="demo"&&remote?.key!==queryKey&&remoteError!==queryKey;
  const filtered=Object.keys(value).some(k=>value[k as keyof Preferences]!==emptyPreferences[k as keyof Preferences])||params.has("q");
  return <div className="container discovery-page"><PageHeading title={t("discoveryTitle")} description={t("discoverySub")} eyebrow={t("demo")}/>
    <form className="search-capsule" onSubmit={e=>{e.preventDefault();update(value,String(new FormData(e.currentTarget).get("q")||"").trim());}}><label className="search-name"><span><Search size={17}/>{t("search")}</span><input key={params.get("q")||""} name="q" aria-label={t("search")} placeholder={t("searchPlaceholder")} defaultValue={params.get("q")||""}/></label><label className="search-location"><span><MapPin size={17}/>{t("location")}</span><select disabled={pending} aria-label={t("governorate")} value={value.governorate} onChange={e=>update({...value,governorate:e.target.value as Preferences["governorate"],area:"all"})}><option value="all">{t("all")}</option>{(["cairo","giza","alexandria"] as const).map(g=><option key={g} value={g}>{t(g)}</option>)}</select></label><button type="submit" disabled={pending} className="search-submit" aria-label={t("searchAction")}><Search size={23}/></button></form>
    <nav className="specialty-categories" aria-label={t("specialties")}><button type="button" disabled={pending} className={value.specialty==="all"?"selected":""} onClick={()=>update({...value,specialty:"all",subspecialty:"all"})}><Grid2X2 size={25}/>{t("allSpecialties")}</button>{categories.map((s,i)=>{const Icon=icons[i]||Stethoscope;return <button type="button" disabled={pending} key={s} className={value.specialty===s?"selected":""} onClick={()=>update({...value,specialty:s,subspecialty:"all"})}><Icon size={25}/>{t(s)}</button>;})}</nav>
    <div className="discovery-toolbar"><div className="result-count"><strong>{new Intl.NumberFormat(lang).format(total)}</strong> {t("results")}{filtered&&<button type="button" className="text-link" disabled={pending} onClick={()=>{update(emptyPreferences,"","availability");}}>{t("clearFilters")}</button>}</div><div className="discovery-actions"><label className="sort-select"><span>{t("sort")}</span><select disabled={pending} aria-label={t("sort")} value={sort} onChange={e=>update(value,params.get("q")||"",e.target.value)}><option value="availability">{t("sortRecommended")}</option><option value="price">{t("sortPrice")}</option><option value="name">{t("sortName")}</option></select></label><div className="view-toggle"><button type="button" className={view==="grid"?"selected":""} aria-label={t("grid")} aria-pressed={view==="grid"} onClick={()=>setView("grid")}><Grid2X2 size={19}/></button><button type="button" className={view==="list"?"selected":""} aria-label={t("list")} aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={20}/></button></div><Button disabled={pending} variant="outline" onClick={()=>{setDraft(value);setFilterOpen(true);}}><SlidersHorizontal size={17}/>{t("filters")}</Button></div></div>
    {pending||remoteLoading?<Skeleton/>:results.length?<div className={"doctor-grid "+(view==="list"?"doctor-list":"")}>{results.map(d=><DoctorCard doctor={d} key={d.id} compare/>)}</div>:<EmptyState title={t("noResults")} description={t("noResultsSub")}/>}
    {integration?.mode==="demo"&&remote&&total>16&&<div className="button-row"><Button variant="outline" disabled={page===1} onClick={()=>{const p=new URLSearchParams(params);p.set("page",String(page-1));router.replace("/doctors?"+p.toString());}}>{t("back")}</Button><span>{page}</span><Button variant="outline" disabled={page*16>=total} onClick={()=>{const p=new URLSearchParams(params);p.set("page",String(page+1));router.replace("/doctors?"+p.toString());}}>{t("next")}</Button></div>}<CompareBar/><Modal open={filterOpen} onClose={()=>setFilterOpen(false)} title={t("filters")}><PreferenceFields value={draft} onChange={setDraft}/><div className="modal-actions"><Button variant="ghost" onClick={()=>setDraft({...emptyPreferences})}>{t("clearFilters")}</Button><Button onClick={()=>{update(draft);setFilterOpen(false);}}>{t("applyFilters")}</Button></div></Modal>
  </div>;
}
