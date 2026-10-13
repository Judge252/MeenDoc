"use client";
import { useEffect, useId, useRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { X, ArrowLeft, Search, ShieldCheck, CircleAlert } from "lucide-react";
import { useApp } from "@/lib/app-context";
export function Button({variant="primary",className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"dark"|"outline"|"ghost"}) {
  return <button type="button" {...props} className={"btn btn-"+variant+" "+className}/>;
}
export function Modal({open,onClose,title,children,wide=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  const {t}=useApp();
  useEffect(()=>{
    const dialog=ref.current;
    if(!dialog)return;
    if(open&&!dialog.open)dialog.showModal();
    if(!open&&dialog.open)dialog.close();
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous;};
  },[open]);
  return <dialog ref={ref} className={"modal "+(wide?"modal-wide":"")} aria-labelledby={id} onCancel={onClose} onClose={onClose}
    onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(element=>element.getClientRects().length>0&&element.tabIndex>=0);
      const first=controls[0],last=controls[controls.length-1];
      if(!first){event.preventDefault();return;}
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }}
    onClick={event=>{if(event.target===event.currentTarget){const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}}>
    <div className="modal-heading"><h2 id={id}>{title}</h2><button type="button" className="icon-btn" aria-label={t("close")} onClick={onClose}><X size={20}/></button></div>
    {open&&children}
  </dialog>;
}
export function EmptyState({title,description,action,href="/doctors"}:{title:string;description:string;action?:string;href?:string}) {
  return <div className="empty-state"><span className="empty-icon"><Search size={30}/></span><h2>{title}</h2><p>{description}</p>{action&&<Link className="btn btn-dark" href={href}>{action}<ArrowLeft size={16} className="directional"/></Link>}</div>;
}
export function Notice({children,warning=false}:{children:ReactNode;warning?:boolean}) {
  return <div className={"notice "+(warning?"notice-warning":"")}><span>{warning?<CircleAlert size={18}/>:<ShieldCheck size={18}/>}</span><p>{children}</p></div>;
}
export function Skeleton({count=4}:{count?:number}) {
  const {t}=useApp();
  return <div className="doctor-grid" role="status" aria-busy="true" aria-label={t("loading")}>{Array.from({length:count},(_,i)=><div className="skeleton-card" key={i}><div className="skeleton-image"/><div className="skeleton-line"/><div className="skeleton-line short"/></div>)}</div>;
}
export function PageHeading({title,description,eyebrow}:{title:string;description?:string;eyebrow?:string}) {
  return <div className="page-heading">{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>;
}
