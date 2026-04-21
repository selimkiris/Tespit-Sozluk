/**
 * Hakkımızda ve karşılama modalı — manifesto metni (tek kaynak).
 * Yalnızca bu dosyayı düzenleyerek içeriği güncelleyin.
 */

export const manifesto = {
  nedir: {
    baslik: "Tespit Sözlük nedir?",
    giris:
      "Tespit Sözlük, sıradanlıktan, kopyala-yapıştır mizahlardan, sığ düşüncelerden, trol içeriklerden bıkmış; yazmaktan, okumaktan ve bir şeyler anlatmaktan keyif alan, farklı ve özgün fikirlere meraklı, eğlenmeyi bilen, absürtlükle dans edebilen insanlar için kurulmuş sosyal bir platform.",
    burasi: [
      "Burası ne bir haber sitesi ne bir forum ne de o bildiğin sözlüklerden biri.",
      "Burası anlatacak bir şeyleri olanların, zihnindeki düşünceleri paylaşmak isteyenlerin yeri.",
      "Burası Tespit Sözlük | Zihnin Kayda Geçtiği Yer.",
    ],
  },
  nelerYapilir: {
    baslik: "Tespit Sözlük'te Neler Yapılır?",
    giris: [
      "Öncelikle ne yapmak istersen onu yaparsın. Ama sana birkaç fikir verelim.",
    ],
    maddeler: [
      "Bugün başından ilginç bir şey geçtiyse onu yazabilirsin. Büyük bir edebî eser veya sağlam bir mizahi içerik olmak zorunda değil, sadece senin olsun yeter.",
      "Hayata dair kafanda dönüp duran bir tespiti buraya uzun uzun yazabilirsin, kısa kısa da yazabilirsin; bu da bir edebî eylemdir, en azından biz öyle kabul ediyoruz.",
      "Bir konuyu gerçekten iyi biliyorsan (tıp, hukuk, sinema, aşçılık, psikoloji, hayvancılık vb.) konu fark etmeksizin bu konuda başlık açıp tüm derinliğiyle bu bilgileri diğer insanlarla paylaşabilirsin, hem belki birilerine de faydalı olur.",
      "Bir kitabı, filmi, diziyi, oyunu öyle dümdüz \"güzeldi\", \"berbattı\" deyip geçmeden dilediğin gibi analiz edebilir, eleştirebilir, sende uyandırdığı hissiyatı paylaşabilirsin.",
      "Henüz kimseyle paylaşmadığın, belki çekindiğin, belki de çoktan paylaştığın bir şiiri, denemeyi, öyküyü, resmi, eskiz çalışmasını vb.ni burada paylaşabilirsin.",
      "Absürtlük ve mizahın dibine vurabilirsin, kendi mantıksızlığında mantık arayabilir ve dilediğince saçmalayabilirsin. Emin ol, burada seni anlayacak başka saçma zihinler de bulacaksın.",
      "Ve tabii ki okuldaki hocan, çalıştığın iş yeri, yaşadığın mahalle, sevdiğin çiçek, yediğin çikolata, girdiğin tuvalet hakkında da başlık açıp dilediğince içinden geçenleri yazabilirsin.",
      "Ya da sadece başkalarını okuyabilirsin; bu da tamamen geçerli bir kullanım biçimi.",
    ],
    ozet:
      "Kısacası, Tespit Sözlük'ün sınırını kategoriler değil, içeriğin ruhu belirler.",
  },
  amac: {
    baslik: "Tespit Sözlük'ün Amacı Nedir?",
    paragraflar: [
      "Tespit Sözlük olarak o büyük sözlükler gibi milyonlarca tık alalım, herkes buraya dolsun, ana akım olalım gibi dertlerimiz asla yok. Tam aksine, biz o sözlüklerin eski zamanlarını, herkesin birbirinin zekâsına saygı duyduğu o butik ve kaliteli ortamı hasretle anıyoruz. Kalabalık bir stadyumda bağırıp sesini duyuramamak yerine, şömine başında zeki insanlarla derin sohbet etmeyi ve gerçek bağlar kurmayı tercih ediyoruz.",
      "Bizim amacımız, bizim gibi düşünen, yazmaktan ve anlatmaktan keyif alan, kafasının içi biraz kalabalık olan, mizahı anlayan ve hayata farklı bir pencereden bakmaya cesaret edebilen insanlarla bu platformda buluşmak.",
    ],
    kapanisGiris:
      "Çevrende kendi kafa yapında, kendi frekansında insanlar bulamıyor olabilirsin. Biz de bulamıyorduk ve burayı bu yüzden kurduk.",
    kapanisVurgu:
      "Eğer şu an bu satırları okurken içinde ufak da olsa bir yazma ve anlatma dürtüsü oluştuysa... Biliyoruz, kafanın içinde paylaşılmayı bekleyen muazzam şeyler var. Evine hoş geldin. Kapıyı arkadan kapat, çayı yeni demledik, içerisi çok güzel.",
  },
} as const

export const aboutConfig = {
  manifesto,
  iletisim: {
    email: "tespitsozluk@gmail.com",
  },
} as const

export type AboutConfig = typeof aboutConfig
