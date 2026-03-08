1\. Kullanıcı Kaydı

\* API Metodu: POST /api/auth/register

\* Açıklama: Yeni kullanıcıların sisteme hesap oluşturması sağlanır.



2\. Kullanıcı Girişi

\* API Metodu: POST /api/auth/login

\* Açıklama: Kayıtlı kullanıcıların sisteme kimlik doğrulaması yaparak giriş yapması sağlanır.



3\. Profil Görüntüleme

\* API Metodu: GET /api/users/{userId}

\* Açıklama: Yazarların kendi veya diğer kullanıcıların profil bilgilerini görebilmesi sağlanır.



4\. Başlıkları Listeleme

\* API Metodu: GET /api/topics/latest

\* Açıklama: Sol panelde, son entry girilen başlıkların kronolojik listelenmesi sağlanır.



5\. Alfabetik Başlık Listeleme

\* API Metodu: GET /api/topics/alphabetical

\* Açıklama: Kullanıcıların sistemdeki tüm başlıkları alfabetik olarak sıralanmış şekilde görmesi sağlanır.



6\. Yeni Başlık Açma

\* API Metodu: POST /api/topics

\* Açıklama: Yazarların mevcut olmayan bir konu hakkında ilk içeriği girerek başlık oluşturması sağlanır.



7\. Başlık Silme

\* API Metodu: DELETE /api/topics/{topicId}

\* Açıklama: Yetkili bir kullanıcının hatalı açılan bir başlığı sistemden kaldırması sağlanır.



8\. Entry Girme

\* API Metodu: POST /api/entries

\* Açıklama: Yazarların mevcut başlıklar altına metin içeriği eklemesi sağlanır.



9\. Entry Düzenleme

\* API Metodu: PUT /api/entries/{entryId}

\* Açıklama: Yazarların kendi yazdıkları entry'lerin içeriğini güncelleyebilmesi sağlanır.



10\. Entry Silme

\* API Metodu: DELETE /api/entries/{entryId}

\* Açıklama: Yazarların kendi yazdıkları bir entry'yi sistemden tamamen kaldırması sağlanır.



11\. Entry Oylama

\* API Metodu: POST /api/entries/{entryId}/vote

\* Açıklama: Yazarların entry'lere olumlu veya olumsuz puan vererek etkileşimde bulunması sağlanır.



12\. Arama Yapma

\* API Metodu: GET /api/search?q={keyword}

\* Açıklama: Kullanıcıların başlıklar veya yazarlar arasında kelime bazlı arama yapması sağlanır.



13\. Rastgele İçerik Listeleme

\* API Metodu: GET /api/entries/random

\* Açıklama: Ana sayfada farklı başlıklardan seçilen rastgele içeriklerin kullanıcıya sunulması sağlanır.



14\. Çıkış Yapma

\* API Metodu: POST /api/auth/logout

\* Açıklama: Kullanıcının aktif oturumunun güvenli bir şekilde sonlandırılması sağlanır.

