# Web Frontend Görev Dağılımı

**Web Frontend Adresi:** [https://tespitsozluk.com](https://tespitsozluk.com)

Bu dokümanda, web uygulamasının kullanıcı arayüzü (UI) ve kullanıcı deneyimi (UX) görevleri listelenmektedir. Solo Team olarak projedeki sayfaların tasarımı, implementasyonu ve kullanıcı etkileşimlerinden tek üye sorumludur.

## Grup Üyelerinin Web Frontend Görevleri
* [Selim Kırış'ın Web Frontend Görevleri](./Selim%20K%C4%B1r%C4%B1%C5%9F/Selim-Kiris-Web-Frontend-Gorevleri.md)

---

## Genel Web Frontend Prensipleri

### 1. Responsive Tasarım
* **Mobile-First Approach:** Tailwind CSS kullanılarak önce mobil, sonra masaüstü odaklı tasarım geliştirilmiştir.
* **Breakpoints:** Tailwind varsayılan ekran kırılımları kullanılmıştır (sm: 640px, md: 768px, lg: 1024px, xl: 1280px).
* **Flexible Layouts:** Tasarımın tamamında CSS Flexbox ve Grid yapıları kullanılmıştır.
* **Responsive Images:** Next.js `next/image` bileşeni ile ekran boyutuna göre otomatik optimize edilen görseller kullanılmıştır.
* **Touch-Friendly:** Mobil cihazlar için dokunmatik hedefler (buton ve linkler) erişilebilirlik standartlarına uygun padding değerleriyle büyütülmüştür.

### 2. Tasarım Sistemi
* **CSS Framework:** Tailwind CSS
* **Renk Paleti:** CSS Variables (Değişkenler) kullanılarak merkezi renk yönetimi (Aydınlık/Karanlık tema altyapısı) kurulmuştur.
* **Tipografi:** Next.js `next/font` optimizasyonu ile layout seviyesinde entegre edilmiş modern fontlar.
* **Spacing:** Tailwind'in 4px/8px (0.25rem/0.5rem) orantılı grid boşluk sistemi kullanılmıştır.
* **Iconography:** Lucide React (Modern, hafif ve vektörel ikon kütüphanesi).
* **Component Library:** Shadcn UI (Radix Primitives tabanlı, erişilebilir ve özelleştirilebilir bileşen mimarisi).

### 3. Performans Optimizasyonu
* **Code Splitting:** Next.js App Router mimarisi sayesinde otomatik sayfa bazlı (route-based) kod bölme yapılmıştır.
* **Lazy Loading:** `next/dynamic` ve React Suspense ile ağır bileşenler tembel yüklenmektedir.
* **Minification:** Next.js'in yerleşik SWC derleyicisi ile CSS ve JavaScript dosyaları küçültülmüştür.
* **Compression:** Vercel Edge sunucuları üzerinde otomatik Gzip ve Brotli sıkıştırma uygulanmaktadır.
* **Caching:** Next.js Full Route Cache ve Fetch Data Cache özellikleriyle sorgular önbelleğe alınmaktadır.
* **Bundle Size:** Gereksiz modüllerin elendiği Tree-shaking optimizasyonu yerleşiktir.

### 4. SEO (Search Engine Optimization)
* **Meta Tags:** Next.js Metadata API ile sayfalara dinamik title ve description etiketleri atanmıştır.
* **Semantic HTML:** `<main>`, `<nav>`, `<article>`, `<section>` gibi HTML5 semantik etiketleri kullanılmıştır.
* **Alt Text:** Tüm görsellerde SEO ve erişilebilirlik için açıklayıcı `alt` nitelikleri zorunlu tutulmuştur.

### 5. Erişilebilirlik (Accessibility)
* **WCAG Compliance:** Kullanılan Shadcn UI bileşenleri WCAG erişilebilirlik standartlarını desteklemektedir.
* **Keyboard Navigation:** Menüler, formlar ve butonlar "Tab" tuşu ile klavyeden tam kontrol edilebilir durumdadır.
* **Screen Reader Support:** Gerekli form alanlarında ARIA nitelikleri (aria-label, aria-describedby) kullanılmıştır.
* **Focus Indicators:** Klavye ile gezinirken aktif elemanı belirten görünür odaklama (ring/focus) stilleri eklenmiştir.

### 6. Browser Compatibility
* **Modern Browsers:** Chrome, Firefox, Safari ve Edge tarayıcılarının güncel sürümleriyle tam uyumludur.
* **CSS Prefixes:** Tailwind CSS'in arka planında çalışan PostCSS ve Autoprefixer ile eski tarayıcı destekleri otomatik eklenmektedir.

### 7. State Management
* **Global State:** React Context API (Tema ve Oturum/Auth yönetimi için).
* **Local State:** React Hooks (`useState`, `useEffect`, `useRef`).
* **Server State:** Next.js Server Components mimarisi ile sunucu tarafında yönetilen durumlar.
* **Form State:** Kontrollü React bileşenleri (Controlled Components) ile anlık form veri yönetimi.

### 8. Routing
* **Client-Side Routing:** Next.js App Router (`next/link` bileşeni) ile sayfa yenilenmeden geçiş (SPA hissi).
* **Protected Routes:** Sadece giriş yapmış kullanıcıların görebileceği sayfalar için yönlendirme (Redirect) mantığı.
* **404 Handling:** Geçersiz URL'ler için özel Next.js `not-found.tsx` sayfası.
* **Dynamic Routing:** Başlık detayları ve profil sayfaları için dinamik URL parametreleri (Örn: `/topic/[id]`).

### 9. API Entegrasyonu
* **HTTP Client:** Next.js tarafından özellikleri genişletilmiş (Caching destekli) yerleşik `fetch` API.
* **Request Interceptors/Headers:** API'ye atılan korumalı isteklere otomatik olarak `Authorization: Bearer <Token>` başlığı eklenmesi.
* **Error Handling:** Try-catch blokları ve API'den dönen HTTP durum kodlarına göre (400, 401, 500) arayüzde dinamik hata mesajı (Toast) gösterimi.
* **Loading States:** Veri çekilirken arayüzde gösterilen "Loading" (Yükleniyor) durumları.

### 10. Build ve Deployment
* **Build Tool:** Next.js SWC Compiler.
* **Environment Variables:** `.env.local` ve Vercel arayüzü üzerinden yönetilen güvenli ortam değişkenleri.
* **CI/CD:** Vercel ve GitHub entegrasyonu sayesinde her `git push` komutunda otomatik derleme (Build) ve canlıya alma (Deployment).
* **Hosting:** Vercel Global Edge Network altyapısı.