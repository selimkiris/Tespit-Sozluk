\# Selim Kırış'ın Web Frontend Görevleri



\*\*Front-end Test Videosu:\*\* \[YouTube Video](https://youtu.be/j4hWTF5d-jk)



\## 1. Üye Olma (Kayıt) Sayfası

\* \*\*API Endpoint:\*\* `POST /api/Auth/register`

\* \*\*Görev:\*\* Kullanıcı kayıt işlemi için modern ve duyarlı web sayfası tasarımı.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Responsive kayıt formu (desktop ve mobile uyumlu Shadcn UI Card yapısı).

&#x20; - Kullanıcı adı (username) input alanı.

&#x20; - Email input alanı (`type="email"`, `autocomplete="email"`).

&#x20; - Şifre input alanı (`type="password"`, Shadcn UI şifre göster/gizle ikonu).

&#x20; - "Kayıt Ol" butonu (Primary button style).

&#x20; - "Zaten hesabınız var mı? Giriş Yap" yönlendirme linki.

&#x20; - Loading spinner (Kayıt işlemi sırasında buton üzerinde animasyon).

\* \*\*Form Validasyonu:\*\*

&#x20; - Zod \& React Hook Form ile şema tabanlı doğrulama.

&#x20; - Email format kontrolü (Regex pattern).

&#x20; - Şifre güvenlik kuralları (Minimum 8 karakter).

&#x20; - Kullanıcı adı boş olamaz ve özel karakter içeremez kontrolü.

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Form hatalarının input altında anlık gösterilmesi (Inline validation).

&#x20; - Başarılı kayıt sonrası "Sonner" toast bildirimi ve Login sayfasına yönlendirme.

&#x20; - Hata durumlarında (409 Conflict) kullanıcı dostu uyarı mesajları.

&#x20; - Klavye navigasyon desteği (Tab ile geçiş).

\* \*\*Teknik Detaylar:\*\*

&#x20; - Framework: Next.js (App Router).

&#x20; - Form Library: React Hook Form \& Zod.

&#x20; - Styling: Tailwind CSS \& Shadcn UI.



\## 2. Kullanıcı Giriş Yapma Sayfası

\* \*\*API Endpoint:\*\* `POST /api/Auth/login`

\* \*\*Görev:\*\* Mevcut kullanıcılar için kimlik doğrulama arayüzü.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Email ve Şifre giriş alanları.

&#x20; - "Beni Hatırlat" onay kutusu (Optional).

&#x20; - "Giriş Yap" butonu.

\* \*\*Form Validasyonu:\*\*

&#x20; - Email format doğruluğu.

&#x20; - Şifre alanının boş bırakılamaması.

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Giriş yapıldıktan sonra JWT Token'ın tarayıcıda (Cookies) güvenli saklanması.

&#x20; - Başarılı giriş sonrası ana sayfaya (Feed) otomatik yönlendirme.

\* \*\*Teknik Detaylar:\*\*

&#x20; - State management ile loading ve error durumlarının yönetimi.



\## 3. Ana Sayfa (Feed) ve Trend Başlıklar Paneli

\* \*\*API Endpoints:\*\* `GET /api/Topics` ve `GET /api/Topics/trending`

\* \*\*Görev:\*\* Sistemdeki başlıkların kronolojik ve popülerliğe göre listelenmesi.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Sayfa ortasında sonsuz kaydırma (Infinite Scroll) veya liste yapısında başlık akışı.

&#x20; - Sağ panelde "Trend Başlıklar" (Side Sidebar) bileşeni.

&#x20; - Başlık kartları (Başlık adı, entry sayısı ve son aktivite zamanı).

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Veri yüklenirken "Skeleton Screen" (Hayalet yükleme) kullanımı.

&#x20; - Mobil cihazlarda alt menü üzerinden erişim kolaylığı.

\* \*\*Teknik Detaylar:\*\*

&#x20; - Fetch API ve Next.js Server Components ile hızlı veri çekme.



\## 4. Gelişmiş Arama Çubuğu (Search)

\* \*\*API Endpoint:\*\* `GET /api/Topics/search`

\* \*\*Görev:\*\* Başlıklar arasında anahtar kelimeye göre arama yapma.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Üst menüde yer alan büyüteç ikonlu arama kutusu.

&#x20; - Yazmaya başlandığında açılan "Arama Önerileri" (Dropdown) listesi.

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - \*\*Debouncing:\*\* Her tuş vuruşunda değil, yazma bittikten 300ms sonra API isteği atılması (Performans için).

&#x20; - Sonuç bulunamadığında "Aradığınız tespiti kimse yapmamış" empty state mesajı.



\## 5. Yeni Başlık Oluşturma Modalı

\* \*\*API Endpoint:\*\* `POST /api/Topics`

\* \*\*Görev:\*\* Henüz açılmamış bir konuyu tartışmaya açma arayüzü.

\* \*\*UI Bileşenleri:\*\*

&#x20; - "Başlık Aç" butonu ile tetiklenen Shadcn UI Dialog (Modal).

&#x20; - Başlık adı için karakter limitli input alanı.

\* \*\*Form Validasyonu:\*\*

&#x20; - Başlık isminin minimum 3 karakter olması zorunluluğu.

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Başarılı oluşturma sonrası doğrudan yeni açılan başlık sayfasına yönlendirme.

&#x20; - Yetkisiz girişlerde modalın açılmaması veya uyarı vermesi.



\## 6. Başlık Detayı ve Entry Akışı

\* \*\*API Endpoints:\*\* `GET /api/Topics/{id}/entries` ve `POST /api/Entries`

\* \*\*Görev:\*\* Seçilen başlığın altındaki tüm entry'lerin okunması ve yeni entry girilmesi.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Başlık ismi (H1 başlık).

&#x20; - Entry kartları (İçerik, yazar adı, tarih).

&#x20; - En altta "Senin Tespitin Nedir?" metin alanı (Textarea).

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Yeni entry girildiğinde listenin anında güncellenmesi (Revalidation).

&#x20; - Uzun entry'lerde "Devamını Oku" özelliği.



\## 7. Entry Etkileşimleri (Beğenme ve Silme)

\* \*\*API Endpoints:\*\* `POST /api/Entries/{id}/like` ve `DELETE /api/Entries/{id}`

\* \*\*Görev:\*\* Entry'leri oylama ve kullanıcıya ait içerikleri kaldırma.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Beğeni (Kalp) ikonu ve sayaç.

&#x20; - Sadece entry sahibine görünen "Sil" (Çöp Kutusu) ikonu.

&#x20; - Silme işlemi için "Emin misiniz?" onay dialog kutusu (AlertDialog).

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - \*\*Optimistic UI:\*\* Beğeniye basıldığında API sonucu beklemeden kalbin dolması.

&#x20; - Silme işlemi sonrası entry'nin sayfadan akıcı bir animasyonla kalkması.



\## 8. Kullanıcı Profil Sayfası

\* \*\*API Endpoints:\*\* `GET /api/Users/{id}`, `GET /api/Users/{id}/entries`, `GET /api/Users/{id}/liked-entries`

\* \*\*Görev:\*\* Kullanıcının kimliğini ve geçmiş aktivitelerini görüntüleme.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Profil başlığı (Kullanıcı adı, avatar, bio).

&#x20; - Shadcn UI Tabs ile "Yazdığı Entry'ler" ve "Beğendiği Entry'ler" sekmeleri.

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Sekmeler arasında gezerken sayfa yenilenmeden veri değişimi.



\## 9. Profil Düzenleme ve Ayarlar

\* \*\*API Endpoint:\*\* `PUT /api/Users/{id}`

\* \*\*Görev:\*\* Kullanıcı bilgilerinin (Biyografi, Avatar) güncellenmesi.

\* \*\*UI Bileşenleri:\*\*

&#x20; - Mevcut verilerin yüklü geldiği düzenleme formu.

&#x20; - "Değişiklikleri Kaydet" ve "İptal" butonları.

\* \*\*Form Validasyonu:\*\*

&#x20; - Biyografi için maksimum 200 karakter sınırı.

&#x20; - Avatar linki için URL formatı kontrolü.

\* \*\*Kullanıcı Deneyimi:\*\*

&#x20; - Başarılı güncelleme sonrası "Profiliniz güncellendi" bildirimi (Toast).

