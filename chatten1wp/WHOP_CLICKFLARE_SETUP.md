# Whop + ClickFlare Setup

Diese Landingpage macht nur:

- Seitenaufruf: `whop.track("page")`
- CTA-Klick: `whop.track("lead")`
- Finaler CTA geht weiter ueber ClickFlare

Die echte Conversion darf nicht im Browser feuern. Sie kommt ueber:

Affiliate Network -> ClickFlare Postback -> Netlify Function -> Whop `complete_registration`

## Dateien

Die Function liegt hier:

```text
netlify/functions/whop-conversion.js
```

Wichtig: Wenn deine Website im GitHub-Repo unter `/tanken1wp` liegt, muss der Ordner `netlify` trotzdem in den Repo-Root:

```text
netlify/
  functions/
    whop-conversion.js
tanken1wp/
  index.html
  css/
  js/
  assets/
```

## Netlify Environment Variables

In Netlify unter Site settings -> Environment variables:

```text
WHOP_API_KEY=dein_whop_api_key
WHOP_ACCOUNT_ID=biz_hAcPEVvW8oStv7
CLICKFLARE_POSTBACK_SECRET=ein_langes_geheimes_passwort
```

`WHOP_API_KEY` niemals in GitHub, HTML oder JS einfuegen.

## ClickFlare Postback URL

In ClickFlare als Traffic Source S2S Postback / Conversion Webhook:

```text
https://DEINE-DOMAIN.com/.netlify/functions/whop-conversion?secret=DEIN_SECRET&event_name=complete_registration&txid={txid}&cf_click_id={cf_click_id}&external_id={external_id}&payout={payout}&currency=usd&fbclid={fbclid}&fbc={fbc}&fbp={fbp}&lpurl={lpurl}
```

Falls ClickFlare andere Macro-Namen anzeigt, nimm die Macro-Namen aus deinem ClickFlare-Dashboard. Wichtig sind vor allem eine eindeutige ID (`txid`, `cf_click_id` oder `external_id`) und die gespeicherten Meta/Whop-Attributionswerte (`fbclid`, `fbc`, `fbp`, `lpurl`).

## Kurztest

Nach dem Deploy kannst du testen:

```text
https://DEINE-DOMAIN.com/.netlify/functions/whop-conversion?secret=DEIN_SECRET&event_name=complete_registration&txid=test123&value=0&currency=usd
```

Wenn alles passt, kommt eine JSON-Antwort mit:

```json
{
  "ok": true,
  "whop_event_id": "..."
}
```
