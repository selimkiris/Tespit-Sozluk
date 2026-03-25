# Selim Kırış'ın Web Frontend Görevleri

**Front-end Test Videosu:** [YouTube Video](https://youtu.be/j4hWTF5d-jk)

## 1. Üye Olma (Kayıt) Sayfası
* **API Endpoint:** `POST /api/Auth/register`
* **Görev:** Kullanıcı kayıt işlemi için modern ve duyarlı web sayfası tasarımı.
* **UI Bileşenleri:**
  - Responsive kayıt formu (desktop ve mobile uyumlu Shadcn UI Card yapısı).
  - Kullanıcı adı (username) input alanı.
  - Email input alanı (`type="email"`, `autocomplete="email"`).
  - Şifre input alanı (`type="password"`, Shadcn UI şifre göster/gizle ikonu).
  - "Kayıt Ol" butonu (Primary button style).
  - "Zaten hesabınız var mı? Giriş Yap" yönlendirme linki.
  - Loading spinner (Kayıt işlemi sırasında buton üzerinde animasyon).
* **Form Validasyonu:**
  - Zod & React Hook Form ile şema tabanlı doğrulama.
  - Email format kontrolü (Regex pattern).
  - Şifre güvenlik kuralları (Minimum 8 karakter).
  - Kullanıcı adı boş olamaz ve özel karakter içeremez kontrolü.
* **Kullanıcı Deneyimi:**
  - Form hatalarının input altında anlık gösterilmesi (Inline validation).
  - Başarılı kayıt sonrası "Sonner" toast bildirimi ve Login sayfasına yönlendirme.
  - Hata durumlarında (409 Conflict) kullanıcı dostu uyarı mesajları.
  - Klavye navigasyon desteği (Tab ile geçiş).
* **Teknik Detaylar:**
  - Framework: Next.js (App Router).
  - Form Library: React Hook Form & Zod.
  - Styling: Tailwind CSS & Shadcn UI.

## 2. Kullanıcı Giriş Yapma Sayfası
* **API Endpoint:** `POST /api/Auth/login`
* **Görev:** Mevcut kullanıcılar için kimlik doğrulama arayüzü.
* **UI Bileşenleri:**
  - Email ve Şifre giriş alanları.
  - "Beni Hatırlat" onay kutusu (Optional).
  - "Giriş Yap" butonu.
* **Form Validasyonu:**
  - Email format doğruluğu.
  - Şifre alanının boş bırakılamaması.
* **Kullanıcı Deneyimi:**
  - Giriş yapıldıktan sonra JWT Token'ın tarayıcıda (Cookies) güvenli saklanması.
  - Başarılı giriş sonrası ana sayfaya (Feed) otomatik yönlendirme.
* **Teknik Detaylar:**
  - State management ile loading ve error durumlarının yönetimi.

## 3. Ana Sayfa (Feed) ve Trend Başlıklar Paneli
* **API Endpoints:** `GET /api/Topics` ve `GET /api/Topics/trending`
* **Görev:** Sistemdeki başlıkların kronolojik ve popülerliğe göre listelenmesi.
* **UI Bileşenleri:**
  - Sayfa ortasında sonsuz kaydırma (Infinite Scroll) veya liste yapısında başlık akışı.
  - Sağ panelde "Trend Başlıklar" (Side Sidebar) bileşeni.
  - Başlık kartları (Başlık adı, entry sayısı ve son aktivite zamanı).
* **Kullanıcı Deneyimi:**
  - Veri yüklenirken "Skeleton Screen" (Hayalet yükleme) kullanımı.
  - Mobil cihazlarda alt menü üzerinden erişim kolaylığı.
* **Teknik Detaylar:**
  - Fetch API ve Next.js Server Components ile hızlı veri çekme.

## 4. Gelişmiş Arama Çubuğu (Search)
* **API Endpoint:** `GET /api/Topics/search`
* **Görev:** Başlıklar arasında anahtar kelimeye göre arama yapma.
* **UI Bileşenleri:**
  - Üst menüde yer alan büyüteç ikonlu arama kutusu.
  - Yazmaya başlandığında açılan "Arama Önerileri" (Dropdown) listesi.
* **Kullanıcı Deneyimi:**
  - **Debouncing:** Her tuş vuruşunda değil, yazma bittikten 300ms sonra API isteği atılması (Performans için).
  - Sonuç bulunamadığında "Aradığınız tespiti kimse yapmamış" empty state mesajı.

## 5. Yeni Başlık Oluşturma Modalı
* **API Endpoint:** `POST /api/Topics`
* **Görev:** Henüz açılmamış bir konuyu tartışmaya açma arayüzü.
* **UI Bileşenleri:**
  - "Başlık Aç" butonu ile tetiklenen Shadcn UI Dialog (Modal).
  - Başlık adı için karakter limitli input alanı.
* **Form Validasyonu:**
  - Başlık isminin minimum 3 karakter olması zorunluluğu.
* **Kullanıcı Deneyimi:**
  - Başarılı oluşturma sonrası doğrudan yeni açılan başlık sayfasına yönlendirme.
  - Yetkisiz girişlerde modalın açılmaması veya uyarı vermesi.

## 6. Başlık Detayı ve Entry Akışı
* **API Endpoints:** `GET /api/Topics/{id}/entries` ve `POST /api/Entries`
* **Görev:** Seçilen başlığın altındaki tüm entry'lerin okunması ve yeni entry girilmesi.
* **UI Bileşenleri:**
  - Başlık ismi (H1 başlık).
  - Entry kartları (İçerik, yazar adı, tarih).
  - En altta "Senin Tespitin Nedir?" metin alanı (Textarea).
* **Kullanıcı Deneyimi:**
  - Yeni entry girildiğinde listenin anında güncellenmesi (Revalidation).
  - Uzun entry'lerde "Devamını Oku" özelliği.

## 7. Entry Etkileşimleri (Beğenme ve Silme)
* **API Endpoints:** `POST /api/Entries/{id}/like` ve `DELETE /api/Entries/{id}`
* **Görev:** Entry'leri oylama ve kullanıcıya ait içerikleri kaldırma.
* **UI Bileşenleri:**
  - Beğeni (Kalp) ikonu ve sayaç.
  - Sadece entry sahibine görünen "Sil" (Çöp Kutusu) ikonu.
  - Silme işlemi için "Emin misiniz?" onay dialog kutusu (AlertDialog).
* **Kullanıcı Deneyimi:**
  - **Optimistic UI:** Beğeniye basıldığında API sonucu beklemeden kalbin dolması.
  - Silme işlemi sonrası entry'nin sayfadan akıcı bir animasyonla kalkması.

## 8. Kullanıcı Profil Sayfası
* **API Endpoints:** `GET /api/Users/{id}`, `GET /api/Users/{id}/entries`, `GET /api/Users/{id}/liked-entries`
* **Görev:** Kullanıcının kimliğini ve geçmiş aktivitelerini görüntüleme.
* **UI Bileşenleri:**
  - Profil başlığı (Kullanıcı adı, avatar, bio).
  - Shadcn UI Tabs ile "Yazdığı Entry'ler" ve "Beğendiği Entry'ler" sekmeleri.
* **Kullanıcı Deneyimi:**
  - Sekmeler arasında gezerken sayfa yenilenmeden veri değişimi.

## 9. Profil Düzenleme ve Ayarlar
* **API Endpoint:** `PUT /api/Users/{id}`
* **Görev:** Kullanıcı bilgilerinin (Biyografi, Avatar) güncellenmesi.
* **UI Bileşenleri:**
  - Mevcut verilerin yüklü geldiği düzenleme formu.
  - "Değişiklikleri Kaydet" ve "İptal" butonları.
* **Form Validasyonu:**
  - Biyografi için maksimum 200 karakter sınırı.
  - Avatar linki için URL formatı kontrolü.
* **Kullanıcı Deneyimi:**
  - Başarılı güncelleme sonrası "Profiliniz güncellendi" bildirimi (Toast).