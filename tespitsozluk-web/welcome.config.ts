/**
 * Merkezi hoş geldin / duyuru modal ayarları.
 * `version` değiştiğinde localStorage anahtarı da değişir; böylece yeni bir duyuru gösterebilirsiniz.
 */

export const welcomeConfig = {
  isActive: true,
  version: 'v5',
  maxViews: 5,

  /** localStorage anahtarı: `tespit_welcome_${version}` */
  storageKeyPrefix: 'tespit_welcome',

  title: 'Tespit Sözlük’e Hoş Gelidiniz :)',

  content: {
    nedir: {
      heading: 'Tespit Sözlük Nedir?',
      body: `Tespit Sözlük, internetin gürültüsünden, sıradanlıktan, trollükten, kopyala-yapıştır mizahlardan sıkılmış; yazmayı seven, düşünmeyi seven, farklı ve özgün fikirlere meraklı, eğlenmeyi bilen, çokça saçmalayan insanlar için kurulmuş bir platform. Burası ne bir haber sitesi, ne de bir forum. Burası bir sözlük — ama o bildiğin sıkıcı ve kalabalık içinde kaybolmuş türden değil.`,
    },
    nedenKuruldu: {
      heading: 'Tespit Sözlük’te Neler Yapılır, Ne İçin Kullanılır?',
      body: `Öncelikle ne yapmak istersen onu yaparsın. Ama sana birkaç fikir verelim.

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
    kurallar: {
      heading: 'Tespit Sözlük Ne Yapmak, Nereye Varmak İstemektedir!',
      body: `Tespit Sözlük, o büyük ve çok kalabalık sözlüklere rakip veya ileride rakip olmayı hedefleyerek çıkmış bir platform değil; aksine bu sözlüklerin ilk zamanlarını hasretle anan, o küçük ama kaliteli kitleyi özleyen ve şu an hâlâ böyle bir kitlenin var olduğuna inanan bir platform.

Bu sebepledir ki amacımız hiçbir zaman çok büyük kitlelere ulaşmak ve parayı kırmak değil; bizim amacımız bizim gibi düşünen, üretmeyi, faydalı olmayı, paylaşmayı seven, mizahı anlayan, hayata farklı bir yerden bakmaya cesaret edebilen insanlarla birlikte bu platformda birleşmek ve bu çizgide büyümek.

`,
    },
    guncellemeler: {
      heading: 'Tespit Sözlük’ün Kuralları',
      body: `Tespit Sözlük'ün kuralları aslında senin kuralların; çünkü olgun insanlar kendi kurallarını zaten koymuş ve içselleştirmiş olur. Sen kendi kurallarına uyarsan burası dünyanın en güzel platformu olur.
`,
    },
    iletisim: {
     heading: '',
     body: ``,
    },
  },
} as const

export type WelcomeConfig = typeof welcomeConfig

export function getWelcomeStorageKey(version: string): string {
  return `${welcomeConfig.storageKeyPrefix}_${version}`
}
