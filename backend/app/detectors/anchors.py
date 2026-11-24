from __future__ import annotations

from dataclasses import dataclass

from ..registry import Brand, get_registry
from ..urlutil import ParsedUrl

SHORTENERS = {
    "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "t.ly",
    "shorturl.at", "rb.gy", "tiny.cc", "bl.ink", "s.id", "v.gd", "lnkd.in", "shorte.st", "adf.ly", "qrco.de",
    "qr.codes", "short.io", "trib.al", "wa.link", "bit.do", "x.co", "urlz.fr", "clck.ru", "u.to", "surl.li",
    "linktr.ee", "tr.ee", "beacons.ai", "msha.ke", "l.ead.me", "me-qr.com", "qr.page", "goo.su", "to.lk", "e.vg",
    "bitly.com", "tiny.one", "tinu.be", "gg.gg", "short.gy", "shrtco.de", "dub.sh", "dub.co", "kutt.it", "1url.com",
    "2u.pw", "rebrand.ly", "shorturl.asia", "t2m.io", "y2u.be", "lnk.to", "spoo.me", "urlr.me", "zpr.io", "shor.by",
    "tiny.pl", "cli.re", "han.gl", "vo.la", "j.mp", "ift.tt", "fb.me", "amzn.to", "q.me-qr.com", "qrco.de", "qrfy.io",
}

USER_CONTENT_HOSTS = {
    "sites.google.com", "docs.google.com", "drive.google.com", "forms.gle", "storage.googleapis.com",
    "firebasestorage.googleapis.com", "script.google.com", "googleusercontent.com", "blogspot.com",
    "github.io", "gitlab.io", "pages.dev", "workers.dev", "vercel.app", "netlify.app", "herokuapp.com",
    "web.app", "firebaseapp.com", "glitch.me", "repl.co", "replit.app", "replit.dev", "onrender.com",
    "fly.dev", "railway.app", "up.railway.app", "azurewebsites.net", "blob.core.windows.net", "web.core.windows.net",
    "s3.amazonaws.com", "amplifyapp.com", "cloudfront.net", "wixsite.com", "wix.com", "weebly.com",
    "weeblysite.com", "square.site", "godaddysites.com", "webflow.io", "framer.app", "framer.website",
    "notion.site", "carrd.co", "000webhostapp.com", "ngrok.io", "ngrok-free.app", "ngrok.app", "trycloudflare.com",
    "ipfs.io", "dweb.link", "cloudflare-ipfs.com", "mybluehost.me", "hostingersite.com", "wordpress.com",
    "tilda.ws", "jimdosite.com", "strikingly.com", "my.canva.site", "canva.site", "typedream.app", "surge.sh",
    "bitbucket.io", "codesandbox.io", "csb.app", "stackblitz.io", "deno.dev", "web.val.run", "lovable.app",
    "bolt.new", "durable.co", "mystrikingly.com", "telegra.ph", "t.me", "wa.me", "linktr.ee",
    "gitbook.io", "r2.dev", "secureserver.net", "amazonaws.com", "appspot.com", "run.app", "cloudfunctions.net",
    "koyeb.app", "b-cdn.net", "azureedge.net", "windows.net", "sharepoint.com", "my.sharepoint.com", "1drv.ms",
    "onedrive.live.com", "forms.office.com", "forms.microsoft.com", "dropbox.com", "dropboxusercontent.com",
    "box.com", "typeform.com", "jotform.com", "wufoo.com", "myshopify.com", "wpengine.com", "wpenginepowered.com",
    "yolasite.com", "site123.me", "webnode.page", "zohosites.com", "mailchimpsites.com", "hubspotpagebuilder.com",
    "tumblr.com", "translate.goog", "pinata.cloud", "fleek.co", "on.fleek.co", "4everland.app", "qrcodechimp.page",
    "taplink.cc", "bio.link", "lnk.bio", "linkin.bio", "flowcode.com", "cprapid.com", "simdif.com", "webwave.dev",
    "ukit.me", "bitrix24.site", "teachable.com", "kajabi.com", "gamma.site", "super.site", "framer.ai", "softr.app",
    "glide.page", "adalo.com", "bubbleapps.io", "thinkific.com", "mobirisesite.com", "wixstudio.com", "editorx.io",
    "webflow.com", "hpage.com", "beget.tech", "000webhost.com", "infinityfree.net", "epizy.com", "rf.gd",
    "great-site.net", "free.nf", "42web.io", "lovable.dev", "github.dev", "gitpod.io", "codeanyway.com",
    "ai.studio", "squarespace.com", "craftum.io", "builder.ai", "wixsite.net", "netlify.com", "pantheonsite.io",
    "duckdns.org", "ddns.net", "no-ip.org", "no-ip.biz", "hopto.org", "zapto.org", "sytes.net", "servebeer.com",
    "dynv6.net", "mooo.com", "us.to", "dyndns.org", "dynu.net", "myddns.me", "ddnsfree.com", "linkpc.net",
    "webhop.me", "gotdns.ch", "kozow.com", "ooguy.com", "chickenkiller.com", "crabdance.com", "ignorelist.com",
    "strangled.net", "twilightparadox.com", "ydns.eu", "freeddns.org", "duckdns.net", "serveo.net", "loca.lt",
}

COMMON_SUBDOMAINS = {"", "www", "m", "mobile", "mail", "login", "accounts", "account", "app", "apps", "api", "shop", "store",
                     "support", "help", "docs", "blog", "news", "en", "ar", "online", "my", "secure", "portal", "cdn", "static"}

FREE_HOST_SUFFIXES = tuple("." + h for h in USER_CONTENT_HOSTS)


@dataclass
class TrustResult:
    official: bool
    brand: Brand | None
    gov: bool
    tranco_rank: int | None
    user_content: bool
    shortener: bool
    unusual_subdomain: bool = False

    @property
    def anchored(self) -> bool:
        return self.official and not self.user_content


def is_plain_host(hostname: str, registrable: str) -> bool:
    sub = hostname[: -len(registrable)].rstrip(".") if hostname.endswith(registrable) else hostname
    return "." not in sub and sub in COMMON_SUBDOMAINS


def is_user_content(p: ParsedUrl) -> bool:
    h = p.hostname
    return h in USER_CONTENT_HOSTS or h.endswith(FREE_HOST_SUFFIXES) or p.registrable in {"blogspot.com", "wixsite.com"}


def check(p: ParsedUrl, tranco_rank: int | None) -> TrustResult:
    reg = get_registry()
    user_content = is_user_content(p)
    official = reg.is_official(p.registrable, p.hostname) and not user_content
    plain_subdomain = p.subdomain.split(".")[0] in COMMON_SUBDOMAINS and p.subdomain.count(".") == 0
    return TrustResult(
        official=official,
        brand=reg.official_brand(p.registrable, p.hostname) if official else None,
        gov=p.hostname.endswith(".gov.ae"),
        tranco_rank=None if user_content else tranco_rank,
        unusual_subdomain=not plain_subdomain,
        user_content=user_content,
        shortener=p.hostname in SHORTENERS or p.registrable in SHORTENERS,
    )
