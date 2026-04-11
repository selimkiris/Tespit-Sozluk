/**
 * Hakkımızda sayfası içerikleri — yalnızca bu dosyayı düzenleyerek metinleri güncelleyin.
 */

export const aboutConfig = {
  nedir: {
    baslik: "Tespit Sözlük nedir?",
    paragraf:
      "Tespit Sözlük, internetin gürültüsünden, sıradanlıktan, trollükten, kopyala-yapıştır mizahlardan sıkılmış; yazmayı seven, düşünmeyi seven, farklı ve özgün fikirlere meraklı, eğlenmeyi bilen, çokça saçmalayan insanlar için kurulmuş bir platform. Burası ne bir haber sitesi, ne de bir forum. Burası bir sözlük ama o bildiğin sıkıcı ve kalabalık içinde kaybolmuş türden değil.",
  },
  nedenKuruldu: {
    baslik: "Tespit Sözlük’te Neler Yapılır, Ne İçin Kullanılır?",
    paragraf:
      `Öncelikle ne yapmak istersen onu yaparsın. Ama sana birkaç fikir verelim. 

Bugün başından ilginç bir şey geçtiyse onu yazabilirsin. Büyük bir edebi eser veya sağlam bir mizahi içerik olmak zorunda değil, sadece senin olsun yeter.

Hayata dair kafanda dönüp duran, daha önce kimselere söyleyemediğin bir Tespit'i buraya uzun uzun yazabilirsin, kısa kısa da yazabilirsin; bu da bir edebi eylemdir, en azından biz öyle kabul ediyoruz.

Bir konuyu gerçekten iyi biliyorsan (tıp, hukuk, sinema, aşçılık, psikoloji, hayvancılık vb.) konu fark etmeksizin bu konuda başlık açıp tüm derinliğiyle bu bilgileri diğer insanlarla paylaşabilirsin, hem belki birilerine de faydalı olur.

Bir kitabı, filmi, diziyi, oyunu öyle dümdüz "iyiydi", "bok gibiydi" demeden analiz edebilir, eleştirebilir, fark ettiğin bir detayı paylaşabilir, bir Tespit yapabilirsin.

Daha henüz kimseyle paylaşmadığın, belki çekindiğin, belki de çoktan paylaştığın bir şiiri, denemeyi, öyküyü, resmi, eskiz çalışmasını vb. burada paylaşabilirsin.

Ve tabii ki okuldaki hocanız, çalıştığınız iş yeri, yaşadığınız mahalle, sevdiğiniz çiçek, yediğiniz çikolata, gittiğiniz tuvalet hakkında da başlık açıp dilediğinizce içinizden geçenleri yazabilirsiniz.

Ya da sadece başkalarını okuyabilirsiniz; bu da tamamen geçerli bir kullanım biçimi.

Kısacası Tespit Sözlük'ün sınırını kategoriler değil, içeriğin ruhu belirler.
`,
  },
  iletisim: {
    email: "tespitsozluk@gmail.com",
  },
} as const

export type AboutConfig = typeof aboutConfig
