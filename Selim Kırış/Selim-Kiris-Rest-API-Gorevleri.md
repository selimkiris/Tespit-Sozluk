\# Selim Kırış'ın REST API Metotları



\*\*API Test Videosu:\*\* \[YouTube Video](https://youtu.be/bkJRcK9z8Os)



\---



\### 1. Kullanıcı Kayıt Ol (POST)

\* \*\*Endpoint:\*\* `/api/Auth/register`

\* \*\*Request Body:\*\*

&#x20; ```json

&#x20; {

&#x20;   "username": "ornek\_kullanici",

&#x20;   "email": "ornek@gmail.com",

&#x20;   "password": "GizliSifre123!"

&#x20; }

Path Parameters: Yok



Authentication: Yok



Response: 200 OK (Başarılı kayıt mesajı döner)



2\. Kullanıcı Giriş Yap (POST)

Endpoint: /api/Auth/login



Request Body:



JSON

{

&#x20; "email": "ornek@gmail.com",

&#x20; "password": "GizliSifre123!"

}

Path Parameters: Yok



Authentication: Yok



Response: 200 OK (JWT Bearer Token döner)



3\. Başlık Oluştur (POST)

Endpoint: /api/Topics



Request Body:



JSON

{

&#x20; "title": "Yazılım Mühendisliği Dersleri"

}

Path Parameters: Yok



Authentication: Bearer Token (Gerekli)



Response: 201 Created (Oluşturulan başlığın bilgileri döner)



4\. Başlıkları Listele (GET)

Endpoint: /api/Topics



Request Body: Yok



Path Parameters: Yok



Authentication: Yok



Response: 200 OK (Mevcut başlıkların JSON dizisi döner)



5\. Başlık İçeriklerini Getir (GET)

Endpoint: /api/Topics/{id}/entries



Request Body: Yok



Path Parameters: id (integer) - Başlığın benzersiz ID'si



Authentication: Yok



Response: 200 OK (İlgili başlığa ait entry'lerin listesi döner)



6\. Entry (İçerik) Gir (POST)

Endpoint: /api/Entries



Request Body:



JSON

{

&#x20; "topicId": 1,

&#x20; "content": "Bu ders gerçekten çok öğretici geçti."

}

Path Parameters: Yok



Authentication: Bearer Token (Gerekli)



Response: 201 Created (Oluşturulan entry'nin bilgileri döner)



7\. Kendi Entry'sini Sil (DELETE)

Endpoint: /api/Entries/{id}



Request Body: Yok



Path Parameters: id (integer) - Silinecek entry'nin ID'si



Authentication: Bearer Token (Gerekli)



Response: 204 No Content (Başarılı silme, içerik dönmez)



8\. Profil Bilgilerini Güncelle (PUT)

Endpoint: /api/Users/{id}



Request Body:



JSON

{

&#x20; "bio": "Full-Stack Geliştirici",

&#x20; "avatarUrl": "\[https://example.com/avatar.jpg](https://example.com/avatar.jpg)"

}

Path Parameters: id (integer) - Güncellenecek kullanıcının ID'si



Authentication: Bearer Token (Gerekli)



Response: 200 OK (Güncel profil bilgileri döner)



9\. Entry Beğen (POST)

Endpoint: /api/Entries/{id}/like



Request Body: Yok



Path Parameters: id (integer) - Beğenilecek/Beğenisi alınacak entry'nin ID'si



Authentication: Bearer Token (Gerekli)



Response: 200 OK (Beğeni durumunun güncellendiğine dair mesaj döner)



10\. Kullanıcının Girdiği Entry'leri Listele (GET)

Endpoint: /api/Users/{id}/entries



Request Body: Yok



Path Parameters: id (integer) - Entry'leri getirilecek kullanıcının ID'si



Authentication: Yok



Response: 200 OK (Kullanıcının yazdığı entry'lerin listesi döner)



11\. Beğenilen Entry'leri Listele (GET)

Endpoint: /api/Users/{id}/liked-entries



Request Body: Yok



Path Parameters: id (integer) - Kullanıcının ID'si



Authentication: Yok



Response: 200 OK (Kullanıcının beğendiği entry'lerin listesi döner)



12\. Trend Başlıkları Getir (GET)

Endpoint: /api/Topics/trending



Request Body: Yok



Path Parameters: Yok



Authentication: Yok



Response: 200 OK (En çok etkileşim alan başlıkların listesi döner)



13\. Başlıkları Ara (GET)

Endpoint: /api/Topics/search



Request Body: Yok



Path Parameters: query (string) - Aranacak kelime (Query Parameter olarak)



Authentication: Yok



Response: 200 OK (Arama sonucuna uyan başlıkların listesi döner)



14\. Kullanıcı Profilini Görüntüle (GET)

Endpoint: /api/Users/{id}



Request Body: Yok



Path Parameters: id (integer) - Görüntülenecek kullanıcının ID'si



Authentication: Yok



Response: 200 OK (Kullanıcının genel profil bilgileri döner)

