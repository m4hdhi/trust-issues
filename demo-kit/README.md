# Trust Issues demo kit

Everything needed to try the platform in a few minutes. Every expected result below was checked on the live site on 25 November 2026.

Live site: https://trust-issues-xlzv.onrender.com

None of the files here can harm a computer. The "scam" files are harmless stand-ins that only carry the features the checker looks for.

## 1. Links

Open the site, stay on **Link or message**, paste a link and tap **Check**. The full list is in [links/links.txt](links/links.txt).

| Link | Expected |
|---|---|
| `https://etisallat.com` | SCAM, fake e& (etisalat) |
| `https://emiratesnb.com` | SCAM, fake Emirates NBD |
| `https://adpolice-fines-pay.com/pay` | SCAM, fake Abu Dhabi Police |
| `https://salik-pay.com` | SCAM, fake Salik |
| `https://parkin.vip` | SCAM, fake Parkin |
| `https://www.adcb.com` | SAFE, official ADCB |
| `https://www.tamm.abudhabi` | SAFE, official TAMM |
| `https://www.dubaipolice.gov.ae` | SAFE, official Dubai Police |

**Several at once:** paste the last line of `links.txt`. Up to five links are checked, each with its own result.

**A whole list:** in the police console (`/console`, **Batch test**), upload [links/links.csv](links/links.csv). It has 7 scam and 8 safe links with labels, so the page also shows precision and recall.

## 2. Messages

Paste the text of a file from [messages/](messages/) into the same box. The message itself is judged, and the link inside is checked.

| File | Expected |
|---|---|
| `scam-sms-english.txt` | Scam message (fake fine, asks for an OTP) |
| `scam-sms-arabic.txt` | Scam message, in Arabic (fake Salik fee) |
| `scam-whatsapp-parcel.txt` | Scam message (fake parcel fee) |
| `safe-message.txt` | Not a scam |

## 3. QR codes

On the home page tap **Scan QR** and point the camera at an image from [qr-codes/](qr-codes/) on another screen.

| Image | Expected |
|---|---|
| `qr-scam-fake-parking.png` | SCAM, fake Parkin (the parking-meter sticker trick) |
| `qr-scam-fake-etisalat.png` | SCAM, fake e& |
| `qr-scam-fake-police-fine.png` | SCAM, fake Abu Dhabi Police |
| `qr-safe-adcb.png` | SAFE, official ADCB |
| `qr-safe-tamm.png` | SAFE, official TAMM |

## 4. Phone numbers

Tap **Phone number**, type a number and tap **Check**. The full list is in [phone-numbers/phone-numbers.csv](phone-numbers/phone-numbers.csv).

| Number | Expected |
|---|---|
| `8002626` | Verified official number, Abu Dhabi Police (Aman) |
| `999` | Verified official number, police emergency |
| `901` | Verified official number, Dubai Police |
| `600540000` | Verified official number, Emirates NBD |
| `600502030` | Verified official number, ADCB |
| `+1 202 555 0143` | Unknown number, with a warning that it is foreign |
| `12345` | Be careful: not a valid number |

**Show the community report:** check `+1 202 555 0143` and tap **Report this number as a scam**. It becomes "Be careful" with one report. Do the same from a second phone or another browser and it becomes "Reported scam number" for everyone. This number is fictional (the US 555-01xx range is reserved for examples), so no real person is reported. An official number such as `8002626` cannot be reported.

## 5. Files

Tap **File** and choose a file from [files/](files/).

| File | Expected | What it shows |
|---|---|---|
| `1-scam-fine-notice.txt` | Dangerous file | Scam wording, and the link inside is sent for a full check |
| `2-scam-statement-with-script.pdf` | Dangerous file | A PDF that runs a script by itself, with a look-alike bank link |
| `3-scam-invoice.pdf.exe` | Dangerous file | A program named like a document |
| `4-scam-salary-with-macros.docm` | Dangerous file | An Office document with macros |
| `5-scam-bank-login.html` | Dangerous file | A sign-in page sent as an attachment |
| `6-scam-parcel.zip` | Be careful with this file | A program hidden inside a ZIP |
| `7-safe-meeting-notes.txt` | Nothing dangerous found | An ordinary note |
| `8-safe-restaurant-menu.pdf` | Nothing dangerous found | An ordinary PDF |
| `9-antivirus-test-file.txt` | Dangerous file | Flagged by about 60 antivirus engines |

Two things to know before a live demo:

- **Pace the files.** The free antivirus lookup allows 4 files a minute. Past that, a file shows "No virus verdict yet"; wait a minute and choose it again. For file 9, make sure it is one of the first four in that minute.
- **File 9 is not in the repository.** It is the standard EICAR antivirus test string: harmless by design, but every antivirus flags it, so a computer's own antivirus may remove it. It is kept out of git for that reason. To recreate it, save this one line as a text file: `X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`
- A browser or mail app may warn about `3-scam-invoice.pdf.exe` because of its name. It contains only a two-letter marker and empty bytes and cannot run.

## 6. Phone protection and Family Shield

- **Test page:** with protection on, open `testsafebrowsing.appspot.com`. It loads on other phones and is blocked on the protected one.
- **Blocked scam:** on a protected phone open `etisallat.com`.
- **Held for approval:** on a family member's phone with strict mode, open `salik-pay.com` or `parcel-delivery.com`. The guardian gets "Keep blocked" or "Allow".

## 7. Police console

`https://trust-issues-xlzv.onrender.com/console` (passcode from the team). Radar, Cases, Network, Hunt, Batch test, Feeds and Metrics. Search for `emirates` on Radar or Cases to see the look-alikes caught.
