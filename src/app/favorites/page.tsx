"use client";
import { useApp } from "@/lib/app-context";
import { DoctorCard, CompareBar } from "@/components/doctors/doctor-card";
import { EmptyState, PageHeading } from "@/components/ui/primitives";
export default function FavoritesPage(){
  const {t,favorites,doctors}=useApp(),saved=doctors.filter(d=>d.active&&favorites.includes(d.id));
  return <div className="container favorites-page"><PageHeading title={t("favorites")} description={t("favoritesSub")}/>{saved.length?<><p className="small muted" style={{marginBottom:20}}>{t("compareHint")}</p><div className="doctor-grid">{saved.map(d=><DoctorCard doctor={d} key={d.id} compare/>)}</div><CompareBar/></>:<EmptyState title={t("noFavorites")} description={t("noFavoritesSub")} action={t("seeAll")}/>}</div>;
}
