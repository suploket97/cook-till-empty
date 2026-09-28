import { CLASSIC } from "./classic";
import { DESSERTS } from "./desserts";
import { EUROPE } from "./europe";
import { THAI } from "./thai";
import type { Cuisine, Course, Recipe } from "./types";
import { WORLD } from "./world";

export type { Cuisine, Course, Recipe } from "./types";

/** The built-in recipe library used when AI is off (and always, for the A/B/C matcher). */
export const RECIPES: Recipe[] = [...CLASSIC, ...THAI, ...EUROPE, ...WORLD, ...DESSERTS];

export const CUISINES: { id: Cuisine; en: string; th: string }[] = [
  { id: "thai", en: "Thai", th: "ไทย" },
  { id: "british", en: "British", th: "อังกฤษ" },
  { id: "italian", en: "Italian", th: "อิตาเลียน" },
  { id: "french", en: "French", th: "ฝรั่งเศส" },
  { id: "spanish", en: "Spanish", th: "สเปน" },
  { id: "greek_middle_eastern", en: "Greek & Middle Eastern", th: "กรีกและตะวันออกกลาง" },
  { id: "indian", en: "Indian", th: "อินเดีย" },
  { id: "chinese", en: "Chinese", th: "จีน" },
  { id: "japanese", en: "Japanese", th: "ญี่ปุ่น" },
  { id: "korean", en: "Korean", th: "เกาหลี" },
  { id: "southeast_asian", en: "Southeast Asian", th: "เอเชียตะวันออกเฉียงใต้" },
  { id: "mexican", en: "Mexican", th: "เม็กซิกัน" },
  { id: "american", en: "American", th: "อเมริกัน" },
];

/** Course filters shown as chips; "mains" also covers soups, salads and sides. */
export const COURSE_GROUPS: { id: "all" | "meals" | "breakfast" | "sweet"; en: string; th: string; courses: Course[] }[] = [
  { id: "all", en: "Everything", th: "ทั้งหมด", courses: ["main", "soup", "salad", "side", "breakfast", "snack", "dessert"] },
  { id: "meals", en: "Meals", th: "มื้อหลัก", courses: ["main", "soup", "salad", "side"] },
  { id: "breakfast", en: "Breakfast & snacks", th: "มื้อเช้าและของว่าง", courses: ["breakfast", "snack"] },
  { id: "sweet", en: "Desserts", th: "ของหวาน", courses: ["dessert"] },
];

// Tips shown with a substitution, keyed "from>to": [English, Thai].
export const TIPS: Record<string, [string, string]> = {
 'holy_basil>thai_basil':['Sweeter and more aniseed than holy basil; add it right at the end.','หอมหวานกว่ากะเพรา ใส่ตอนปิดไฟ'],
 'holy_basil>sweet_basil':['Italian basil is milder: use a double handful and extra black pepper for bite.','เบซิลอิตาเลียนกลิ่นอ่อนกว่า ใส่เพิ่มเป็นสองเท่าและเติมพริกไทยให้เผ็ดร้อน'],
 'fish_sauce>soy_sauce':['Soy sauce plus a pinch of salt stands in for the fish sauce.','ใช้ซีอิ๊วขาวบวกเกลือเล็กน้อยแทนน้ำปลา'],
 'galangal>ginger':['Ginger is hotter and less piney; use about two-thirds as much.','ขิงเผ็ดร้อนกว่าข่า ใช้ราวสองในสาม'],
 'lemongrass>lime':['Lime zest brings the citrus note; add the juice at the end.','ใช้ผิวมะนาวให้กลิ่นซิตรัส บีบน้ำตอนท้าย'],
 'morning_glory>spinach':['Spinach wilts faster: add it last and toss for 30 seconds.','ผักโขมสลดเร็ว ใส่ท้ายสุด ผัดแค่ 30 วินาที'],
 'morning_glory>chinese_kale':['Slice the kale stems thin so they cook as fast as the leaves.','หั่นก้านคะน้าบาง ๆ ให้สุกพร้อมใบ'],
 'chinese_kale>broccoli':['Slice broccoli stems thinly; they char just like gai lan.','หั่นก้านบรอกโคลีบาง ๆ ไหม้หอมได้เหมือนคะน้า'],
 'green_curry_paste>red_curry_paste':['Red paste is smokier; extra basil and lime leaf push it back towards green.','พริกแกงเผ็ดหอมควันกว่า เพิ่มโหระพาและใบมะกรูดให้ใกล้แกงเขียวหวาน'],
 'noodles>pasta':['Linguine or spaghetti, cooked a minute past al dente, holds a soy glaze well.','ใช้ลิงกวินีหรือสปาเกตตี้ ต้มนานกว่าปกติ 1 นาที เคลือบซีอิ๊วได้ดี'],
 'stock>soy_sauce':['A splash of soy gives the savoury depth a stock cube would.','เติมซีอิ๊วเล็กน้อยให้รสกลมกล่อมแทนซุปก้อน'],
 'chicken>pork':['Pork shoulder or chops roast in the same time.','หมูสันคอหรือหมูชิ้นอบได้ในเวลาเท่ากัน'],
 'sweet_basil>parsley':['Parsley makes a fresher, grassier pesto; add a little lemon.','ใช้พาร์สลีย์ได้เพสโต้กลิ่นสดกว่า เติมมะนาวเล็กน้อย'],
 'sweet_basil>spinach':['Spinach gives colour but little flavour: add more garlic and cheese.','ผักโขมให้สีแต่กลิ่นน้อย เพิ่มกระเทียมและชีส'],
 'tamarind>lime':['Lime gives the sourness; add a little extra sugar to round it out.','ใช้มะนาวแทนความเปรี้ยว เติมน้ำตาลอีกนิดให้กลมกล่อม'],
 'massaman_paste>curry_powder':['Fry curry powder with garlic and shallot, plus a pinch of cinnamon.','ผัดผงกะหรี่กับกระเทียมและหอมแดง เติมอบเชยเล็กน้อย'],
 'massaman_paste>red_curry_paste':['Add cinnamon, peanuts and a little extra sugar to push red paste towards massaman.','เติมอบเชย ถั่วลิสง และน้ำตาลเล็กน้อยให้ใกล้รสมัสมั่น'],
 'peanuts>peanut_butter':['A spoon of peanut butter in the sauce gives the nutty taste without the crunch.','ใส่เนยถั่วหนึ่งช้อนในซอสได้กลิ่นถั่วแต่ไม่กรุบ'],
 'mayonnaise>yogurt':['Yogurt is lighter and tangier; add a pinch of salt.','โยเกิร์ตเบากว่าและเปรี้ยวกว่า เติมเกลือเล็กน้อย'],
 'sugar>honey':['Use a little less honey than sugar; it is sweeter.','ใช้น้ำผึ้งน้อยกว่าน้ำตาลเล็กน้อย เพราะหวานกว่า'],
 'vinegar>lime':['Lime juice works as the acid; add it at the end.','ใช้น้ำมะนาวแทนความเปรี้ยว ใส่ตอนท้าย'],
 'broccoli>chinese_kale':['Slice kale stems thinly so they cook as fast as the leaves.','หั่นก้านคะน้าบาง ๆ ให้สุกพร้อมใบ'],
};
