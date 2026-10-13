import type { Doctor, Localized, Specialty, Governorate } from "@/types";
const l = (ar: string, en: string): Localized => ({ ar, en });
const seeds: [string,string,Specialty,Governorate,string,number][] = [
  ["سلمى منصور","Salma Mansour","ophthalmology","cairo","maadi",450],
  ["عمر نادر","Omar Nader","general","cairo","nasr",350],
  ["ليلى عادل","Laila Adel","dermatology","cairo","newcairo",500],
  ["يوسف حازم","Youssef Hazem","orthopedics","giza","dokki",400],
  ["نور شريف","Nour Sherif","cardiology","cairo","maadi",650],
  ["كريم أمين","Karim Amin","dentistry","alexandria","smouha",300],
  ["هنا ياسين","Hana Yassin","general","giza","mohandessin",300],
  ["آدم طارق","Adam Tarek","ent","cairo","nasr",450],
  ["مريم فؤاد","Mariam Fouad","ophthalmology","giza","dokki",400],
  ["مروان سامح","Marwan Sameh","dermatology","alexandria","sidi",350],
  ["دينا هشام","Dina Hesham","orthopedics","cairo","newcairo",550],
  ["أحمد وليد","Ahmed Walid","cardiology","giza","mohandessin",500],
  ["رانيا نبيل","Rania Nabil","dentistry","cairo","maadi",400],
  ["زياد عاصم","Ziad Asem","ent","alexandria","smouha",300],
  ["بسمة خالد","Basma Khaled","ophthalmology","alexandria","sidi",350],
  ["محمود إيهاب","Mahmoud Ehab","general","cairo","maadi",400],
];
const subs: Record<Specialty,Localized> = {
  general:l("متابعة صحية عامة","General health follow-up"),dermatology:l("العناية بالبشرة","Skin care"),
  orthopedics:l("المفاصل والحركة","Joints and mobility"),ophthalmology:l("فحص العين والإبصار","Eye and vision checks"),
  cardiology:l("متابعة صحة القلب","Heart health follow-up"),dentistry:l("صحة الفم والأسنان","Oral health"),
  ent:l("السمع والجيوب الأنفية","Hearing and sinus care")
};
export const doctors: Doctor[] = seeds.map(([ar,en,specialty,governorate,area,fee],i) => ({
  id:"doctor-"+(i+1), name:l("د. "+ar,"Dr. "+en),specialty,subspecialty:subs[specialty],governorate,area,fee,
  gender:i%2===0?"female":"male",portrait:i,active:true,dayOffset:1+(i%3),slots:i%2?["10:00","11:30","17:00"]:["09:30","16:00","18:30"],
  bio:l("ملف خيالي لتجربة البحث والحجز. البيانات والخدمات هنا توضيحية، ولا تمثل طبيبًا أو عيادة حقيقية.","A fictional profile for exploring discovery and booking. These details and services are illustrative and do not represent an actual doctor or clinic."),
  services:[subs[specialty],l("زيارة متابعة — مثال تجريبي","Follow-up visit — demo example")],
}));
