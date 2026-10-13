import "server-only";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { configuration } from "../config";
import { authorize } from "./authorize";
import { ApiError } from "../http";
import { translate } from "@/lib/i18n";
export async function protectedPage(role:"admin"|"doctor",path:string,children:ReactNode){
  if(configuration().APP_MODE==="offline")return children;
  try{await authorize(role);return children;}
  catch(error){
    if(error instanceof ApiError&&error.status===401)redirect("/login?next="+encodeURIComponent(path));
    const key=error instanceof ApiError&&error.status===403?"forbidden":"integrationUnavailable";
    return <div className="container empty-state"><h1>{translate(key,"ar")}</h1><p>{translate(key,"en")}</p><Link className="btn btn-dark" href="/">{translate("returnHome","ar")}</Link></div>;
  }
}
