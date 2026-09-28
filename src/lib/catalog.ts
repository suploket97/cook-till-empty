import type { Category, Region, Unit } from "./types";

export interface CatalogEntry {
  id: string;
  en: string;
  th: string;
  cat: Category;
  u: Unit;
  /** Usual pack you buy, in `u`. */
  pack: number;
  /** What one recipe for two people uses, in `u`. */
  use: number;
  /** Pack price in THB and GBP (rough, for estimates only). */
  thb: number;
  gbp: number;
  aliases: string[];
}

type Row = [string, string, string, Category, Unit, number, number, number, number, string];

// id, English, Thai, category, unit, pack, portion, THB/pack, GBP/pack, aliases (Thai + English, comma-separated)
const RAW: Row[] = [
  ["egg", "Eggs", "ไข่ไก่", "chilled", "egg", 10, 2, 45, 2.6, "egg,eggs,ไข่,ไข่ไก่,ไข่เป็ด"],
  ["chicken", "Chicken", "เนื้อไก่", "meat", "g", 500, 300, 70, 3.2, "chicken,chicken breast,chicken breasts,chicken thighs,chicken thigh,ไก่,อกไก่,สะโพกไก่,เนื้อไก่"],
  ["pork_mince", "Minced pork", "หมูสับ", "meat", "g", 500, 250, 80, 2.8, "minced pork,pork mince,ground pork,หมูสับ,หมูบด"],
  ["pork", "Pork", "เนื้อหมู", "meat", "g", 500, 300, 85, 3.5, "pork,pork belly,pork chop,pork chops,หมู,หมูสามชั้น,เนื้อหมู"],
  ["beef", "Beef", "เนื้อวัว", "meat", "g", 500, 300, 180, 5, "beef,beef mince,steak,เนื้อวัว,เนื้อ"],
  ["shrimp", "Prawns", "กุ้ง", "meat", "g", 300, 200, 120, 4, "prawn,prawns,shrimp,shrimps,กุ้ง"],
  ["fish", "Fish", "ปลา", "meat", "g", 400, 250, 110, 4.5, "fish,salmon,cod,basa,haddock,ปลา,ปลาแซลมอน"],
  ["bacon", "Bacon", "เบคอน", "chilled", "g", 200, 100, 90, 2.5, "bacon,เบคอน"],
  ["ham", "Ham", "แฮม", "chilled", "g", 150, 60, 60, 1.9, "ham,แฮม"],
  ["tofu", "Tofu", "เต้าหู้", "chilled", "block", 1, 1, 15, 1.5, "tofu,เต้าหู้"],
  ["milk", "Milk", "นมสด", "chilled", "ml", 1000, 200, 50, 1.15, "milk,นม,นมสด"],
  ["cheese", "Cheese", "ชีส", "chilled", "g", 250, 60, 150, 2.6, "cheese,cheddar,mozzarella,parmesan,ชีส,เนยแข็ง"],
  ["butter", "Butter", "เนย", "chilled", "g", 250, 20, 110, 2.2, "butter,เนย,เนยจืด,เนยเค็ม"],
  ["yogurt", "Yogurt", "โยเกิร์ต", "chilled", "g", 500, 150, 60, 1.3, "yogurt,yoghurt,โยเกิร์ต"],
  ["cream", "Cream", "ครีม", "chilled", "ml", 300, 150, 90, 1.5, "cream,double cream,single cream,วิปปิ้งครีม,ครีม"],
  ["spinach", "Spinach", "ผักโขม", "produce", "g", 250, 150, 30, 1.4, "spinach,baby spinach,ผักโขม"],
  ["morning_glory", "Morning glory", "ผักบุ้ง", "produce", "bunch", 1, 1, 15, 2, "morning glory,water spinach,ผักบุ้ง"],
  ["chinese_kale", "Chinese kale", "คะน้า", "produce", "bunch", 1, 1, 20, 1.8, "chinese kale,gai lan,kai lan,คะน้า"],
  ["cabbage", "Cabbage", "กะหล่ำปลี", "produce", "head", 1, 0.5, 30, 0.8, "cabbage,savoy,กะหล่ำ,กะหล่ำปลี"],
  ["broccoli", "Broccoli", "บรอกโคลี", "produce", "head", 1, 1, 40, 0.8, "broccoli,tenderstem,บร็อคโคลี่,บรอกโคลี,บล็อคโคลี่"],
  ["carrot", "Carrots", "แครอท", "produce", "tuber", 5, 2, 25, 0.5, "carrot,carrots,แครอท,แคร์รอต"],
  ["onion", "Onions", "หอมใหญ่", "produce", "tuber", 3, 1, 20, 0.6, "onion,onions,red onion,red onions,หอมใหญ่,หัวหอม"],
  ["shallot", "Shallots", "หอมแดง", "produce", "tuber", 6, 3, 15, 1, "shallot,shallots,หอมแดง"],
  ["garlic", "Garlic", "กระเทียม", "produce", "clove", 20, 3, 20, 0.6, "garlic,กระเทียม"],
  ["chilli", "Chillies", "พริกสด", "produce", "g", 50, 10, 15, 0.8, "chilli,chillies,chili,chilies,bird eye chilli,พริก,พริกขี้หนู,พริกสด"],
  ["tomato", "Tomatoes", "มะเขือเทศ", "produce", "fruit", 4, 2, 25, 0.9, "tomato,tomatoes,cherry tomatoes,มะเขือเทศ"],
  ["potato", "Potatoes", "มันฝรั่ง", "produce", "tuber", 6, 2, 30, 1, "potato,potatoes,spuds,มันฝรั่ง"],
  ["mushroom", "Mushrooms", "เห็ด", "produce", "g", 250, 150, 40, 1.1, "mushroom,mushrooms,เห็ด,เห็ดฟาง,เห็ดนางฟ้า,เห็ดหอม"],
  ["bell_pepper", "Peppers", "พริกหวาน", "produce", "fruit", 3, 1, 45, 1.4, "pepper,peppers,bell pepper,bell peppers,red pepper,green pepper,พริกหวาน,พริกหยวก"],
  ["cucumber", "Cucumber", "แตงกวา", "produce", "fruit", 2, 1, 15, 0.8, "cucumber,cucumbers,แตงกวา"],
  ["lime", "Limes", "มะนาว", "produce", "fruit", 4, 1, 20, 1, "lime,limes,lemon,lemons,มะนาว,เลมอน"],
  ["holy_basil", "Holy basil", "กะเพรา", "produce", "bunch", 1, 1, 10, 1.5, "holy basil,kra pao,krapow,กะเพรา,กระเพรา,ใบกะเพรา"],
  ["thai_basil", "Thai sweet basil", "โหระพา", "produce", "bunch", 1, 1, 10, 1.5, "thai basil,thai sweet basil,โหระพา"],
  ["sweet_basil", "Basil", "ใบเบซิล", "produce", "bunch", 1, 1, 25, 0.9, "basil,sweet basil,italian basil,เบซิล,ใบเบซิล"],
  ["coriander", "Coriander", "ผักชี", "produce", "bunch", 1, 0.5, 10, 0.8, "coriander,cilantro,ผักชี"],
  ["spring_onion", "Spring onions", "ต้นหอม", "produce", "bunch", 1, 0.5, 10, 0.5, "spring onion,spring onions,scallion,scallions,green onion,ต้นหอม"],
  ["lemongrass", "Lemongrass", "ตะไคร้", "produce", "stalk", 3, 2, 10, 1.2, "lemongrass,lemon grass,ตะไคร้"],
  ["galangal", "Galangal", "ข่า", "produce", "g", 100, 20, 15, 1.5, "galangal,ข่า"],
  ["ginger", "Ginger", "ขิง", "produce", "g", 100, 20, 15, 0.6, "ginger,ขิง"],
  ["kaffir", "Makrut lime leaves", "ใบมะกรูด", "produce", "leaf", 20, 4, 10, 1.5, "kaffir lime leaves,makrut lime leaves,lime leaves,ใบมะกรูด"],
  ["rice", "Rice", "ข้าวสาร", "pantry", "g", 1000, 300, 45, 1.8, "rice,jasmine rice,basmati,ข้าว,ข้าวสาร,ข้าวหอมมะลิ,ข้าวสวย"],
  ["noodles", "Rice noodles", "เส้นก๋วยเตี๋ยว", "pantry", "g", 400, 200, 30, 1.5, "noodles,rice noodles,egg noodles,ก๋วยเตี๋ยว,เส้นใหญ่,เส้นก๋วยเตี๋ยว,บะหมี่,เส้น"],
  ["pasta", "Pasta", "พาสต้า", "pantry", "g", 500, 200, 45, 0.8, "pasta,spaghetti,penne,linguine,fusilli,พาสต้า,สปาเกตตี้,สปาเก็ตตี้"],
  ["bread", "Bread", "ขนมปัง", "pantry", "slice", 16, 4, 45, 1.4, "bread,toast,sourdough,ขนมปัง"],
  ["coconut_milk", "Coconut milk", "กะทิ", "pantry", "ml", 400, 250, 30, 1.3, "coconut milk,coconut cream,กะทิ,หัวกะทิ"],
  ["green_curry_paste", "Green curry paste", "พริกแกงเขียวหวาน", "pantry", "g", 100, 50, 25, 1.8, "green curry paste,พริกแกงเขียวหวาน"],
  ["red_curry_paste", "Red curry paste", "พริกแกงเผ็ด", "pantry", "g", 100, 50, 25, 1.8, "red curry paste,curry paste,พริกแกงเผ็ด,พริกแกง"],
  ["tinned_tomato", "Chopped tomatoes (tin)", "มะเขือเทศกระป๋อง", "pantry", "tin", 1, 1, 35, 0.55, "chopped tomatoes,tinned tomatoes,canned tomatoes,tins tomatoes,tin tomatoes,tins of tomatoes,tin of tomatoes,passata,มะเขือเทศกระป๋อง"],
  ["tuna", "Tinned tuna", "ทูน่ากระป๋อง", "pantry", "tin", 1, 1, 40, 1.1, "tuna,tinned tuna,canned tuna,ทูน่า,ทูน่ากระป๋อง"],
  ["stock", "Stock cubes", "ซุปก้อน", "pantry", "cube", 8, 1, 20, 1, "stock,stock cube,stock cubes,chicken stock,veg stock,ซุปก้อน,คนอร์"],
  ["fish_sauce", "Fish sauce", "น้ำปลา", "pantry", "ml", 700, 15, 35, 1.8, "fish sauce,น้ำปลา"],
  ["soy_sauce", "Soy sauce", "ซีอิ๊ว", "pantry", "ml", 500, 15, 35, 1.5, "soy sauce,soy,light soy,ซีอิ๊ว,ซีอิ๊วขาว,ซอสถั่วเหลือง"],
  ["oyster_sauce", "Oyster sauce", "ซอสหอยนางรม", "pantry", "ml", 300, 15, 40, 1.8, "oyster sauce,ซอสหอยนางรม,น้ำมันหอย"],
  ["sugar", "Sugar", "น้ำตาล", "pantry", "g", 1000, 10, 25, 1, "sugar,น้ำตาล,น้ำตาลทราย"],
  ["oil", "Cooking oil", "น้ำมันพืช", "pantry", "ml", 1000, 30, 55, 2, "oil,vegetable oil,cooking oil,sunflower oil,น้ำมัน,น้ำมันพืช"],
  ["olive_oil", "Olive oil", "น้ำมันมะกอก", "pantry", "ml", 500, 30, 250, 4.5, "olive oil,น้ำมันมะกอก"],
  ["salt", "Salt", "เกลือ", "pantry", "g", 500, 5, 10, 0.7, "salt,sea salt,เกลือ"],
  ["pepper", "Black pepper", "พริกไทย", "pantry", "g", 50, 2, 30, 1.2, "black pepper,white pepper,พริกไทย,พริกไทยดำ"],
  ["garlic_powder", "Garlic powder", "กระเทียมผง", "pantry", "g", 50, 3, 35, 1, "garlic powder,กระเทียมผง"],
  // international cooking and desserts
  ["lamb", "Lamb", "เนื้อแกะ", "meat", "g", 500, 300, 250, 5.5, "lamb,lamb mince,lamb chops,เนื้อแกะ,ลูกแกะ"],
  ["sausage", "Sausages", "ไส้กรอก", "chilled", "pc", 6, 3, 60, 2.2, "sausage,sausages,ไส้กรอก"],
  ["squid", "Squid", "ปลาหมึก", "meat", "g", 300, 200, 90, 3.5, "squid,calamari,ปลาหมึก,หมึก"],
  ["feta", "Feta", "ชีสเฟต้า", "chilled", "g", 200, 100, 120, 1.6, "feta,ชีสเฟต้า,เฟต้า"],
  ["puff_pastry", "Puff pastry", "แป้งพัฟ", "chilled", "g", 320, 320, 90, 1.5, "puff pastry,แป้งพัฟ"],
  ["aubergine", "Aubergine", "มะเขือยาว", "produce", "fruit", 2, 1, 25, 1, "aubergine,aubergines,eggplant,มะเขือยาว,มะเขือม่วง"],
  ["thai_eggplant", "Thai eggplant", "มะเขือเปราะ", "produce", "g", 200, 100, 20, 2, "thai eggplant,thai aubergine,มะเขือเปราะ,มะเขือพวง"],
  ["courgette", "Courgette", "ซูกินี", "produce", "fruit", 2, 1, 40, 0.8, "courgette,courgettes,zucchini,ซูกินี"],
  ["green_beans", "Green beans", "ถั่วฝักยาว", "produce", "g", 200, 150, 20, 1.2, "green beans,long beans,runner beans,ถั่วฝักยาว,ถั่วแขก"],
  ["bean_sprouts", "Bean sprouts", "ถั่วงอก", "produce", "g", 200, 100, 10, 0.9, "bean sprouts,beansprouts,ถั่วงอก"],
  ["sweetcorn", "Sweetcorn", "ข้าวโพด", "pantry", "tin", 1, 1, 30, 0.7, "sweetcorn,sweet corn,corn,ข้าวโพด"],
  ["peas", "Peas", "ถั่วลันเตา", "pantry", "g", 500, 150, 60, 1.2, "peas,frozen peas,garden peas,ถั่วลันเตา"],
  ["avocado", "Avocado", "อะโวคาโด", "produce", "fruit", 2, 1, 80, 1.5, "avocado,avocados,อะโวคาโด"],
  ["lettuce", "Lettuce", "ผักกาดหอม", "produce", "head", 1, 0.5, 25, 0.7, "lettuce,salad leaves,iceberg,romaine,ผักกาดหอม,ผักสลัด"],
  ["banana", "Bananas", "กล้วยหอม", "produce", "fruit", 6, 2, 40, 1, "banana,bananas,กล้วย,กล้วยหอม,กล้วยน้ำว้า"],
  ["apple", "Apples", "แอปเปิล", "produce", "fruit", 6, 2, 90, 1.8, "apple,apples,แอปเปิล,แอปเปิ้ล"],
  ["mango", "Mango", "มะม่วง", "produce", "fruit", 2, 1, 60, 1.5, "mango,mangoes,มะม่วง,มะม่วงสุก"],
  ["berries", "Berries", "เบอร์รี่", "produce", "g", 250, 150, 120, 2.5, "berries,strawberries,blueberries,raspberries,สตรอว์เบอร์รี,สตรอเบอร์รี่,บลูเบอร์รี่,เบอร์รี่"],
  ["pumpkin", "Pumpkin", "ฟักทอง", "produce", "g", 1000, 400, 40, 1.5, "pumpkin,squash,butternut squash,ฟักทอง"],
  ["sweet_potato", "Sweet potatoes", "มันเทศ", "produce", "tuber", 3, 2, 30, 1.2, "sweet potato,sweet potatoes,มันเทศ,มันหวาน"],
  ["celery", "Celery", "ขึ้นฉ่าย", "produce", "stalk", 8, 2, 20, 0.8, "celery,ขึ้นฉ่าย,คื่นฉ่าย"],
  ["mint", "Mint", "สะระแหน่", "produce", "bunch", 1, 0.5, 10, 0.8, "mint,สะระแหน่"],
  ["parsley", "Parsley", "พาร์สลีย์", "produce", "bunch", 1, 0.5, 30, 0.8, "parsley,พาร์สลีย์"],
  ["pak_choi", "Pak choi", "กวางตุ้ง", "produce", "g", 250, 200, 20, 1.5, "pak choi,bok choy,choy sum,กวางตุ้ง,ผักกวางตุ้ง"],
  ["cauliflower", "Cauliflower", "กะหล่ำดอก", "produce", "head", 1, 0.5, 40, 1, "cauliflower,กะหล่ำดอก"],
  ["pandan", "Pandan leaves", "ใบเตย", "produce", "bunch", 1, 0.5, 10, 1.5, "pandan,pandan leaves,ใบเตย"],
  ["taro", "Taro", "เผือก", "produce", "g", 500, 300, 40, 2, "taro,เผือก"],
  ["flour", "Plain flour", "แป้งสาลี", "pantry", "g", 1000, 200, 40, 0.9, "flour,plain flour,self-raising flour,all-purpose flour,แป้งสาลี,แป้งอเนกประสงค์,แป้ง"],
  ["glutinous_rice_flour", "Glutinous rice flour", "แป้งข้าวเหนียว", "pantry", "g", 500, 200, 25, 1.5, "glutinous rice flour,sticky rice flour,rice flour,แป้งข้าวเหนียว,แป้งข้าวเจ้า"],
  ["sticky_rice", "Sticky rice", "ข้าวเหนียว", "pantry", "g", 1000, 300, 45, 2, "sticky rice,glutinous rice,ข้าวเหนียว"],
  ["cornflour", "Cornflour", "แป้งข้าวโพด", "pantry", "g", 250, 15, 25, 0.9, "cornflour,cornstarch,corn starch,แป้งข้าวโพด"],
  ["baking_powder", "Baking powder", "ผงฟู", "pantry", "g", 100, 5, 20, 0.9, "baking powder,baking soda,bicarbonate,ผงฟู,เบกกิ้งโซดา"],
  ["cocoa", "Cocoa powder", "ผงโกโก้", "pantry", "g", 250, 30, 120, 2.5, "cocoa,cocoa powder,ผงโกโก้,โกโก้"],
  ["chocolate", "Chocolate", "ช็อกโกแลต", "pantry", "g", 100, 100, 60, 1.2, "chocolate,dark chocolate,milk chocolate,chocolate chips,ช็อกโกแลต,ช็อคโกแลต"],
  ["vanilla", "Vanilla extract", "กลิ่นวานิลลา", "pantry", "ml", 38, 5, 60, 2, "vanilla,vanilla extract,vanilla essence,วานิลลา,กลิ่นวานิลลา"],
  ["honey", "Honey", "น้ำผึ้ง", "pantry", "g", 340, 20, 120, 2.2, "honey,น้ำผึ้ง"],
  ["condensed_milk", "Condensed milk", "นมข้นหวาน", "pantry", "ml", 397, 100, 30, 1.4, "condensed milk,sweetened condensed milk,นมข้นหวาน,นมข้น"],
  ["palm_sugar", "Palm sugar", "น้ำตาลปี๊บ", "pantry", "g", 500, 30, 40, 2, "palm sugar,coconut sugar,น้ำตาลปี๊บ,น้ำตาลมะพร้าว"],
  ["oats", "Oats", "ข้าวโอ๊ต", "pantry", "g", 1000, 80, 120, 1.5, "oats,porridge oats,rolled oats,oatmeal,ข้าวโอ๊ต"],
  ["chickpeas", "Chickpeas (tin)", "ถั่วลูกไก่", "pantry", "tin", 1, 1, 45, 0.7, "chickpeas,garbanzo,ถั่วลูกไก่"],
  ["lentils", "Lentils", "ถั่วเลนทิล", "pantry", "g", 500, 200, 70, 1.2, "lentils,red lentils,green lentils,dal,dhal,ถั่วเลนทิล"],
  ["kidney_beans", "Kidney beans (tin)", "ถั่วแดง", "pantry", "tin", 1, 1, 45, 0.6, "kidney beans,red beans,black beans,tinned beans,ถั่วแดง,ถั่วดำ"],
  ["baked_beans", "Baked beans (tin)", "ถั่วอบซอสมะเขือเทศ", "pantry", "tin", 1, 1, 40, 0.8, "baked beans,ถั่วอบ,ถั่วอบซอสมะเขือเทศ"],
  ["tortillas", "Tortilla wraps", "แผ่นตอร์ติญ่า", "pantry", "pc", 8, 4, 90, 1.5, "tortilla,tortillas,wraps,flour tortillas,ตอร์ติญ่า,แผ่นตอร์ติญ่า"],
  ["instant_noodles", "Instant noodles", "บะหมี่กึ่งสำเร็จรูป", "pantry", "pc", 5, 2, 35, 1.5, "instant noodles,ramen noodles,ramen,มาม่า,บะหมี่กึ่งสำเร็จรูป"],
  ["glass_noodles", "Glass noodles", "วุ้นเส้น", "pantry", "g", 200, 100, 25, 1.5, "glass noodles,mung bean noodles,vermicelli,วุ้นเส้น"],
  ["breadcrumbs", "Breadcrumbs", "เกล็ดขนมปัง", "pantry", "g", 200, 50, 40, 1, "breadcrumbs,panko,เกล็ดขนมปัง"],
  ["peanuts", "Peanuts", "ถั่วลิสง", "pantry", "g", 200, 50, 30, 1.2, "peanuts,roasted peanuts,ถั่วลิสง,ถั่วลิสงคั่ว"],
  ["peanut_butter", "Peanut butter", "เนยถั่ว", "pantry", "g", 340, 40, 90, 1.8, "peanut butter,เนยถั่ว"],
  ["sesame_oil", "Sesame oil", "น้ำมันงา", "pantry", "ml", 250, 10, 80, 2, "sesame oil,น้ำมันงา"],
  ["vinegar", "Vinegar", "น้ำส้มสายชู", "pantry", "ml", 500, 15, 20, 0.8, "vinegar,rice vinegar,white vinegar,wine vinegar,น้ำส้มสายชู"],
  ["miso", "Miso paste", "มิโซะ", "pantry", "g", 400, 30, 120, 2.5, "miso,miso paste,มิโซะ"],
  ["gochujang", "Gochujang", "โคชูจัง", "pantry", "g", 250, 30, 120, 2.5, "gochujang,korean chilli paste,โคชูจัง"],
  ["kimchi", "Kimchi", "กิมจิ", "chilled", "g", 400, 150, 120, 3, "kimchi,กิมจิ"],
  ["ketchup", "Ketchup", "ซอสมะเขือเทศ", "pantry", "ml", 460, 30, 40, 1.2, "ketchup,tomato ketchup,tomato sauce,ซอสมะเขือเทศ"],
  ["mayonnaise", "Mayonnaise", "มายองเนส", "pantry", "g", 400, 30, 60, 1.5, "mayonnaise,mayo,มายองเนส"],
  ["curry_powder", "Curry powder", "ผงกะหรี่", "pantry", "g", 100, 10, 40, 1.2, "curry powder,garam masala,ผงกะหรี่,ผงมาซาล่า"],
  ["cumin", "Ground cumin", "ยี่หร่าป่น", "pantry", "g", 50, 5, 40, 1, "cumin,ground cumin,ยี่หร่า,ยี่หร่าป่น"],
  ["paprika", "Paprika", "ปาปริก้า", "pantry", "g", 50, 5, 50, 1, "paprika,smoked paprika,ปาปริก้า"],
  ["dried_herbs", "Dried herbs", "สมุนไพรแห้ง", "pantry", "g", 20, 2, 60, 1, "dried herbs,mixed herbs,oregano,thyme,italian herbs,ออริกาโน่,สมุนไพรแห้ง"],
  ["cinnamon", "Cinnamon", "อบเชย", "pantry", "g", 50, 3, 40, 1, "cinnamon,ground cinnamon,อบเชย"],
  ["tamarind", "Tamarind paste", "มะขามเปียก", "pantry", "g", 200, 30, 25, 1.5, "tamarind,tamarind paste,มะขามเปียก,น้ำมะขามเปียก"],
  ["shrimp_paste", "Shrimp paste", "กะปิ", "pantry", "g", 100, 10, 30, 1.5, "shrimp paste,กะปิ"],
  ["dried_shrimp", "Dried shrimp", "กุ้งแห้ง", "pantry", "g", 50, 15, 60, 2.5, "dried shrimp,กุ้งแห้ง"],
  ["massaman_paste", "Massaman curry paste", "พริกแกงมัสมั่น", "pantry", "g", 100, 50, 30, 1.8, "massaman paste,massaman curry paste,พริกแกงมัสมั่น"],
  ["agar", "Agar powder", "ผงวุ้น", "pantry", "g", 50, 10, 30, 2, "agar,agar agar,agar powder,ผงวุ้น"],
  ["mung_beans", "Split mung beans", "ถั่วเขียวเราะเปลือก", "pantry", "g", 500, 150, 40, 1.5, "mung beans,split mung beans,ถั่วเขียว,ถั่วเขียวเราะเปลือก"],
  ["tapioca_pearls", "Tapioca pearls", "สาคู", "pantry", "g", 250, 80, 25, 1.5, "tapioca pearls,sago,สาคู"],
  ["couscous", "Couscous", "คูสคูส", "pantry", "g", 500, 150, 90, 1.2, "couscous,คูสคูส"],
  ["sweet_chilli_sauce", "Sweet chilli sauce", "น้ำจิ้มไก่", "pantry", "ml", 300, 30, 35, 1.3, "sweet chilli sauce,sweet chili sauce,น้ำจิ้มไก่"],
];

export const CATALOG: Record<string, CatalogEntry> = {};
/** [alias, id], longest alias first so "coconut milk" wins over "milk". */
export const ALIASES: [string, string][] = [];

for (const [id, en, th, cat, u, pack, use, thb, gbp, al] of RAW) {
  const aliases = al.split(",").map((a) => a.trim().toLowerCase());
  CATALOG[id] = { id, en, th, cat, u, pack, use, thb, gbp, aliases };
  for (const a of aliases) ALIASES.push([a, id]);
}
ALIASES.sort((a, b) => b[0].length - a[0].length);

export const STAPLES: Record<Region, string[]> = {
  th: ["fish_sauce", "soy_sauce", "oyster_sauce", "sugar", "oil"],
  uk: ["salt", "pepper", "olive_oil", "garlic_powder", "soy_sauce"],
};

export const QUICK_ADD = ["egg", "chicken", "garlic", "cheese", "pork_mince", "rice", "onion", "milk", "tomato", "spinach"];

export type AisleKey = "fresh_market" | "supermarket" | "produce" | "chilled" | "pantry";

export const AISLES: Record<Region, [AisleKey, { th: string; en: string }][]> = {
  th: [
    ["fresh_market", { th: "ตลาดสด", en: "Fresh Market" }],
    ["supermarket", { th: "ซูเปอร์มาร์เก็ต / ของแห้ง", en: "Supermarket / Dry Goods" }],
  ],
  uk: [
    ["produce", { th: "ผักผลไม้สด", en: "Fresh Produce" }],
    ["chilled", { th: "แช่เย็นและเนื้อสัตว์", en: "Chilled & Meat" }],
    ["pantry", { th: "ของแห้งในตู้", en: "Pantry / Cupboard" }],
  ],
};

export function aisleOf(cat: Category, region: Region): AisleKey {
  if (region === "th") return cat === "produce" || cat === "meat" ? "fresh_market" : "supermarket";
  if (cat === "produce") return "produce";
  if (cat === "meat" || cat === "chilled") return "chilled";
  return "pantry";
}

/**
 * Typical shelf life from purchase, used to estimate dates when none are entered.
 * "use_by" = safety date (meat, fish, dairy); "best_before" = quality date (produce, dry goods).
 * Rough UK/Thai household guidance for a fridge at 0–5°C; the packet always wins.
 */
export type DateKind = "use_by" | "best_before";
const S = (days: number, kind: DateKind = "best_before") => ({ days, kind });
export const SHELF_LIFE: Record<string, { days: number; kind: DateKind }> = {
  egg: S(21), chicken: S(2, "use_by"), pork_mince: S(2, "use_by"), pork: S(3, "use_by"), beef: S(3, "use_by"),
  shrimp: S(2, "use_by"), fish: S(2, "use_by"), bacon: S(7, "use_by"), ham: S(5, "use_by"), tofu: S(5, "use_by"),
  milk: S(7, "use_by"), cheese: S(21), butter: S(30), yogurt: S(10, "use_by"), cream: S(7, "use_by"),
  spinach: S(4), morning_glory: S(3), chinese_kale: S(4), cabbage: S(14), broccoli: S(5), carrot: S(14),
  onion: S(30), shallot: S(30), garlic: S(30), chilli: S(7), tomato: S(7), potato: S(21), mushroom: S(5),
  bell_pepper: S(7), cucumber: S(7), lime: S(14), holy_basil: S(4), thai_basil: S(4), sweet_basil: S(4),
  coriander: S(4), spring_onion: S(6), lemongrass: S(14), galangal: S(14), ginger: S(21), kaffir: S(14),
  rice: S(365), noodles: S(180), pasta: S(365), bread: S(5), coconut_milk: S(365), green_curry_paste: S(180),
  red_curry_paste: S(180), tinned_tomato: S(540), tuna: S(720), stock: S(365), fish_sauce: S(365),
  soy_sauce: S(365), oyster_sauce: S(365), sugar: S(720), oil: S(365), olive_oil: S(365), salt: S(1800),
  pepper: S(365), garlic_powder: S(365),
  lamb: S(3, "use_by"), sausage: S(7, "use_by"), squid: S(2, "use_by"), feta: S(21), puff_pastry: S(14, "use_by"), aubergine: S(7), thai_eggplant: S(5), courgette: S(7), green_beans: S(5), bean_sprouts: S(2), sweetcorn: S(540), peas: S(180), avocado: S(4), lettuce: S(5), banana: S(5), apple: S(21), mango: S(5), berries: S(4), pumpkin: S(30), sweet_potato: S(21), celery: S(10), mint: S(5), parsley: S(7), pak_choi: S(4), cauliflower: S(7), pandan: S(5), taro: S(14), flour: S(365), glutinous_rice_flour: S(365), sticky_rice: S(365), cornflour: S(365), baking_powder: S(365), cocoa: S(365), chocolate: S(180), vanilla: S(720), honey: S(720), condensed_milk: S(365), palm_sugar: S(365), oats: S(365), chickpeas: S(720), lentils: S(365), kidney_beans: S(720), baked_beans: S(720), tortillas: S(10), instant_noodles: S(180), glass_noodles: S(365), breadcrumbs: S(180), peanuts: S(180), peanut_butter: S(180), sesame_oil: S(365), vinegar: S(720), miso: S(180), gochujang: S(180), kimchi: S(30), ketchup: S(180), mayonnaise: S(60), curry_powder: S(365), cumin: S(365), paprika: S(365), dried_herbs: S(365), cinnamon: S(365), tamarind: S(180), shrimp_paste: S(365), dried_shrimp: S(60), massaman_paste: S(180), agar: S(365), mung_beans: S(365), tapioca_pearls: S(365), couscous: S(365), sweet_chilli_sauce: S(180),
};
