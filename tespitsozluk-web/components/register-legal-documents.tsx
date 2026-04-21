"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type LegalDoc = "privacy" | "terms"

export interface RegisterLegalModalsProps {
  open: LegalDoc | null
  onOpenChange: (open: LegalDoc | null) => void
}

function PrivacyPolicyBody() {
  return (
    <div className="space-y-4 text-left">
      <h2 className="text-xl font-bold mb-4">TESPİT SÖZLÜK GİZLİLİK POLİTİKASI</h2>
      <p className="leading-relaxed text-sm text-muted-foreground">Son Güncelleme Tarihi: 23 Nisan 2026</p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük olarak gizliliğinize ve kişisel verilerinizin güvenliğine büyük önem veriyoruz. Bu Gizlilik
        Politikası, Tespit Sözlük mobil uygulamasını (&quot;Tespit Sözlük&quot;) ve web platformumuzu (bilgisayar veya
        mobil tarayıcı üzerinden tüm kullanımlar dahil) kullanırken hangi bilgilerinizi topladığımızı, bu bilgileri
        nasıl kullandığımızı ve koruduğumuzu açıklamaktadır. Platformumuzu kullanarak bu politikada belirtilen
        uygulamaları kabul etmiş olursunuz.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">1. Topladığımız Veriler</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Hizmetlerimizi sunabilmek ve platform bütünlüğünü sağlamak amacıyla aşağıdaki verileri toplamaktayız:
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Kayıt Bilgileri: Platforma kayıt olurken verdiğiniz e-posta adresi, kullanıcı adı ve şifreniz (şifreniz
        sistemlerimizde kriptolu olarak saklanır).
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Kullanıcı Tarafından Oluşturulan İçerikler: Platform içerisinde açtığınız başlıklar, yazdığınız entry&apos;ler
        ve diğer kullanıcılarla olan tüm etkileşimleriniz.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Cihaz ve Bağlantı Bilgileri: Yasal yükümlülüklerimizi yerine getirmek ve platform işleyişini sağlamak
        amacıyla; IP adresiniz, cihaz/tarayıcı bilgileriniz ve kullanım tarih/saat log kayıtlarınız.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">2. Verilerin Kullanım Amacı</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">Topladığımız kişisel verileri şu amaçlarla kullanmaktayız:</p>
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-sm text-muted-foreground">
        <li>Platformun temel işlevlerini (hesap oluşturma, giriş yapma, içerik paylaşma) yerine getirmek.</li>
        <li>Kullanıcılar arası güvenli bir ortam sağlamak ve platform kurallarına aykırı durumları tespit edip engellemek.</li>
        <li>
          Yasal mevzuattan doğan yükümlülüklerimizi yerine getirmek ve yetkili resmi makamlardan gelebilecek yasal ve
          usulüne uygun taleplere yanıt vermek.
        </li>
        <li>Teknik hataları gidermek, kullanıcı deneyimini iyileştirmek ve platformu geliştirmek.</li>
        <li>
          Kullanıcılar tarafından platformda oluşturulan içerikleri (entry&apos;ler), platformun tanıtımını yapmak ve
          erişimini artırmak amacıyla ayrıca bir onay alınmaksızın Tespit Sözlük&apos;e ait resmi sosyal medya
          hesaplarında (Instagram, X (Twitter), TikTok, YouTube vb.) paylaşmak.
        </li>
      </ul>

      <h3 className="font-semibold text-primary mt-6 mb-2">3. Verilerin Paylaşımı ve Üçüncü Taraflar</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük, kişisel verilerinizi kesinlikle satmaz veya reklam amacıyla üçüncü taraflarla paylaşmaz. Verileriniz
        yalnızca şu durumlarda paylaşılabilir:
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Yasal Zorunluluklar: Mahkeme kararı veya yetkili mercilerin resmi talebi doğrultusunda, yasal
        yükümlülüklerimizi yerine getirmek amacıyla.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Hizmet Sağlayıcılar: Veritabanı barındırma ve sunucu altyapımızı sağlayan güvenilir iş ortaklarımızla
        (verileriniz standartlara uygun ve güvenli sunucularda tutulmaktadır).
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">4. Kullanıcı İçeriklerinin Denetimi</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük, platform kurallarının (Tespit Sözlük Anayasası) ihlal edilmemesi adına içerik moderasyonu yapma
        hakkını saklı tutar. Platform kurallarına aykırı içerikler tespit edildiğinde veya şikayet edildiğinde, bu
        içerikler kaldırılabilir ve ilgili kullanıcının hesabı askıya alınabilir veya silinebilir. Kullanıcılar, kural
        ihlali yaptığını düşündükleri içerikleri uygulama ve web sitesi içerisindeki bildirim araçları ile
        raporlayabilirler.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">5. Veri Saklama, Hesap ve Veri Silme İşlemleri</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Kullanıcılarımız, kendi verileri ve içerikleri üzerinde tam kontrole sahiptir.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Hesap Silme İşlemi: İstediğiniz zaman platform içindeki Ayarlar &gt; Hesabımı Sil menüsünden veya
        tespitsozluk@gmail.com adresine talebinizi ileterek hesabınızı kalıcı olarak silebilirsiniz.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Verilerin Yok Edilmesi: Hesap silme işlemi yapıldığında tüm profil bilgileriniz, yazdığınız bütün
        entry&apos;ler, açtığınız bütün başlıklar ve tüm etkileşimleriniz sistemlerimizden eksiksiz ve kalıcı olarak
        silinir.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        İstisnai Durum (Başlık Bütünlüğü): Eğer platformda açmış olduğunuz bir başlığa, sizden başka kullanıcılar da
        entry girmişse; platformun işleyişi ve diğer kullanıcıların içerik bütünlüğünü korumak adına söz konusu başlık
        silinmez. Ancak, başlığı açan kişi kısmındaki kullanıcı bilginiz tamamen anonim hale getirilerek profilinizle
        olan tüm bağı kalıcı olarak koparılır.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Yasal mevzuat gereği saklamakla yükümlü olduğumuz dijital iz (IP) kayıtları, ilgili yasal sürenin bitiminde
        otomatik olarak imha edilir.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">6. Veri Güvenliği</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Kullanıcı verilerinin yetkisiz erişime, değiştirilmeye veya ifşa edilmesine karşı korunması için güncel güvenlik
        önlemleri (şifreleme, güvenli veritabanı mimarisi) uygulanmaktadır. İnternet üzerinden yapılan hiçbir veri
        aktarımının mutlak güvenli garantisi olmasa da, verilerinizi korumak için azami özeni göstermekteyiz.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">7. Değişiklikler ve İletişim</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Bu gizlilik politikasında zaman zaman platformun ihtiyaçlarına veya yasal düzenlemelere göre güncellemeler
        yapabiliriz. Gizlilik politikamız, verilerinizin kullanımı veya hesap silme işlemleriyle ilgili her türlü soru,
        talep ve şikayetiniz için aşağıdaki adres üzerinden bizimle iletişime geçebilirsiniz:
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">E-posta: tespitsozluk@gmail.com</p>
    </div>
  )
}

function TermsOfServiceBody() {
  return (
    <div className="space-y-4 text-left">
      <h2 className="text-xl font-bold mb-4">TESPİT SÖZLÜK KULLANIM KOŞULLARI</h2>
      <p className="leading-relaxed text-sm text-muted-foreground">Son Güncelleme Tarihi: 23 Nisan 2026</p>

      <h3 className="font-semibold text-primary mt-6 mb-2">1. Kayıt ve Yaş Sınırı</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük, içeriği ve yapısı gereği yetişkinlere yönelik bir platformdur. Platforma kayıt olabilmek ve
        kullanabilmek için 18 yaşını doldurmuş olmanız gerekmektedir. 18 yaşından küçük olduğu tespit edilen hesaplar
        uyarısız olarak kapatılır. Hesabınızın güvenliği tamamen sizin sorumluluğunuzdadır.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">2. İçerik Üretimi (UGC) ve Sınırlar</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük Anayasası&apos;nda da belirttiğimiz gibi, özgünlük ve özgürlük esastır. Argo kelimeler lisanın bir
        parçası olarak kabul edilebilir; ancak diğer kullanıcıların güvenliği ve platform sağlığı için aşağıdaki
        içerikler kesinlikle yasaktır:
      </p>
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-sm text-muted-foreground">
        <li>
          Hedef Gösterme ve Hakaret: Dini, milli, kutsal değerlere, doğrudan bir yazara veya üçüncü şahıslara yönelik
          saldırılar, aşağılama, zorbalık ve ağır/sinkaflı küfürler.
        </li>
        <li>
          Nefret Söylemi: Irk, din, cinsiyet, cinsel yönelim veya engellilik durumuna dayalı ayrımcılık ve nefret
          söylemleri.
        </li>
        <li>
          Gizlilik İhlali (Doxxing): Yazarların veya başka bireylerin gerçek kimliklerini, iletişim bilgilerini veya
          özel hayatlarını rızaları dışında ifşa etmek.
        </li>
        <li>
          Yasadışı Faaliyetler: Uyuşturucu kullanımını özendirme, yasadışı şiddet eylemlerini teşvik etme ve terör
          övgüsü.
        </li>
      </ul>

      <h3 className="font-semibold text-primary mt-6 mb-2">3. Hassas İçerikler (+18)</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Şiddet, korku veya cinsellik barındıran (ancak yasadışı olmayan) paylaşımlarda, kimseyi hazırlıksız yakalamamak
        adına &quot;+18&quot; ibaresi kullanmak zorunludur. Ancak açık pornografik materyaller, çocuk istismarı içeren
        görsel/metinler ve aşırı vahşet/kan içeren (gore) paylaşımlar platformda barındırılamaz ve tespiti halinde
        derhal silinir.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">4. Moderasyon, Şikayet ve Sıfır Tolerans Politikası</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük, bilgi kirliliğini (örneğin; içi boş &quot;+1&quot;, &quot;rez&quot; entry&apos;leri veya
        spam/fake news girişimleri) ve kural ihlallerini önlemek adına moderasyon hakkını saklı tutar.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Kullanıcılar, rahatsız edici buldukları içerikleri veya kişileri uygulama içindeki &quot;Şikayet Et&quot; ve
        &quot;Engelle&quot; araçlarıyla bildirmelidir.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Yukarıda 2. ve 3. maddelerde belirtilen ihlalleri gerçekleştiren kullanıcılara karşı sıfır tolerans politikası
        izlenir. Bu kişilerin içerikleri derhal kaldırılır ve hesapları kalıcı olarak sistemden uzaklaştırılır.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">5. İçerik Hakları ve Hesap Silme İşlemleri</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Platformda paylaştığınız tüm içeriklerin (entry, başlık vb.) yasal sorumluluğu ve mülkiyeti size aittir.
        İçeriklerin Türkiye Cumhuriyeti yasalarına uygun olması zorunludur.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        İçeriklerinizi platformda paylaşarak Tespit Sözlük&apos;e; bu içerikleri platformun işleyişi amacıyla kullanma
        ve görüntüleme izni vermiş olursunuz.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Ayrıca, platformda oluşturduğunuz içeriklerin (entry&apos;lerin), platformun tanıtımını yapmak amacıyla ayrıca
        bir onay alınmaksızın Tespit Sözlük&apos;e ait resmi sosyal medya hesaplarında (Instagram, X (Twitter), TikTok,
        YouTube vb.) paylaşılmasına, yayınlanmasına ve kullanılmasına bedelsiz olarak izin vermiş sayılırsınız.
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Hesabınızı kalıcı olarak sildiğinizde, diğer kullanıcıların da katılım sağladığı ve entry girdiği başlıklar
        (platformun ve diğer yazarların içerik bütünlüğünü korumak adına) silinmez. Ancak bu başlıkları açan kişi olarak
        sizin profil bilginiz kalıcı ve geri döndürülemez şekilde anonim hale getirilir.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">6. Sorumluluk Reddi</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Tespit Sözlük, kullanıcıların kendi zihinlerinden geçenleri aktardıkları bir yerdir. Platform, kullanıcılar
        tarafından oluşturulan içeriklerin doğruluğunu veya hukuka uygunluğunu önceden denetlemez ve garanti etmez.
        Doğabilecek her türlü maddi/manevi veya hukuki zarardan, içeriği oluşturan kullanıcı şahsen sorumludur.
      </p>

      <h3 className="font-semibold text-primary mt-6 mb-2">7. İletişim</h3>
      <p className="leading-relaxed text-sm text-muted-foreground">
        Bu Kullanım Koşulları veya Tespit Sözlük Anayasası ile ilgili her türlü soru, öneri veya şikayetiniz için tek
        iletişim kanalımız üzerinden bize ulaşabilirsiniz:
      </p>
      <p className="leading-relaxed text-sm text-muted-foreground">E-posta: tespitsozluk@gmail.com</p>
    </div>
  )
}

export function RegisterLegalModals({ open, onOpenChange }: RegisterLegalModalsProps) {
  return (
    <Dialog
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null)
      }}
    >
      <DialogContent className="flex max-h-[min(90vh,880px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">
          {open === "privacy" ? "TESPİT SÖZLÜK GİZLİLİK POLİTİKASI" : open === "terms" ? "TESPİT SÖZLÜK KULLANIM KOŞULLARI" : "Yasal metin"}
        </DialogTitle>
        <div className="min-h-0 max-h-[70vh] overflow-y-auto px-6 pb-5 pl-6 pr-12 pt-3 sm:pt-4">
          {open === "privacy" ? <PrivacyPolicyBody /> : null}
          {open === "terms" ? <TermsOfServiceBody /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
