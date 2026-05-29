# ავტომატური დღიური რეპორტის მეილი

ეს სკრიპტი აგზავნის აუზების დღიურ რეპორტს მეილზე **ავტომატურად, 10:00-სა და 18:00-ზე
(თბილისის დროით)** — ბრაუზერის გახსნა საჭირო **არ არის**. გაშვება ხდება GitHub Actions-ით
(`.github/workflows/daily-report-email.yml`).

რას აკეთებს:
1. კითხულობს Firestore-დან (`pool_reports`) **დღევანდელ** რეპორტებს.
2. აგებს HTML ცხრილს + ქიმიკატების ჯამს (**ლიტრი ცალკე, კილოგრამი ცალკე**).
3. აგზავნის იმავე EmailJS შაბლონით, რომელსაც აპლიკაცია იყენებს.

---

## ერთჯერადი დაყენება — GitHub Secrets

GitHub-ზე გადადი: **Settings → Secrets and variables → Actions → New repository secret**
და დაამატე ორი secret:

### 1. `FIREBASE_SERVICE_ACCOUNT`
Firestore-დან კითხვისთვის საჭიროა Firebase service account გასაღები:
1. გახსენი [Firebase Console](https://console.firebase.google.com/) → პროექტი `pool-tracker-82049`.
2. ⚙️ **Project settings → Service accounts → Generate new private key**.
3. ჩამოტვირთული **JSON ფაილის მთლიანი შიგთავსი** ჩასვი secret-ის მნიშვნელობად.

### 2. `EMAILJS_PRIVATE_KEY`
სერვერიდან გაგზავნისთვის EmailJS-ის Private Key გჭირდება:
1. გახსენი [EmailJS Dashboard](https://dashboard.emailjs.com/) → **Account → General / API Keys**.
2. დააკოპირე **Private Key** და ჩასვი secret-ის მნიშვნელობად.
3. იქვე ჩართე **"Allow EmailJS API for non-browser applications"**
   (Account → Security), რომ სერვერული გაგზავნა დაიშვას.

> Service ID, Template ID, Public Key და მიმღების მისამართი უკვე ჩაშენებულია სკრიპტში
> (იგივე, რაც აპლიკაციაში). მათი შეცვლა გინდა? დაამატე არასავალდებულო secret-ები:
> `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `REPORT_EMAIL`.

---

## შემოწმება

ხელით გაშვება secret-ების დაყენების შემდეგ:
**Actions ტაბი → „დღიური რეპორტის მეილი" → Run workflow**.

ლოგებში დაინახავ შედეგს. თუ დღეს რეპორტი არ არის — მეილი არ გაიგზავნება (ეს ნორმაა).

## ლოკალური ტესტი (არასავალდებულო)

```bash
cd scripts
npm install
FIREBASE_SERVICE_ACCOUNT="$(cat path/to/serviceAccount.json)" \
EMAILJS_PRIVATE_KEY="შენი_private_key" \
node send-daily-report.js
```

## დროის შესახებ

cron-ი GitHub Actions-ში **UTC**-ში იწერება. თბილისი = UTC+4, ამიტომ workflow-ში:
`06:00 UTC = 10:00 თბილისი` და `14:00 UTC = 18:00 თბილისი`.
GitHub-ის განრიგი ზოგჯერ რამდენიმე წუთით შეიძლება დაიგვიანოს (ეს ნორმალურია).
