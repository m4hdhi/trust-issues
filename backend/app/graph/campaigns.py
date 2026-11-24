"""Link scam domains into campaigns through shared infrastructure (IP, ASN, nameservers, favicon, phones, Telegram bots)."""
from __future__ import annotations

import hashlib
from typing import Any

import networkx as nx
from sqlmodel import select

from .. import db
from ..pipeline import site_key_for
from ..schemas import Campaign, GraphEdge, GraphNode, ScanResult

SHARED_ASNS = {"AS13335", "AS16509", "AS14618", "AS15169", "AS396982", "AS8075", "AS54113", "AS20940", "AS16625", "AS209242",
               "AS26496", "AS46606", "AS22612", "AS19551", "AS32934", "AS8068", "AS36351", "AS24940", "AS63949", "AS14061"}
GENERIC_NS = ("cloudflare.com", "awsdns", "azure-dns", "googledomains.com", "domaincontrol.com", "registrar-servers.com")


def _features(r: dict[str, Any]) -> list[tuple[str, str, str]]:
    feats: list[tuple[str, str, str]] = []
    di = r.get("domain_intel") or {}
    shared_host = any(sig["id"] == "user_content_host" for sig in r.get("signals") or [])
    if di.get("asn") not in SHARED_ASNS and not shared_host:
        for ip in di.get("ips") or []:
            feats.append(("ip", ip, "hosted_on"))
    for ns in di.get("nameservers") or []:
        if not any(g in ns for g in GENERIC_NS):
            feats.append(("nameserver", ns.lower(), "uses_ns"))
    page = r.get("page") or {}
    if page.get("favicon_hash"):
        feats.append(("favicon", str(page["favicon_hash"]), "same_favicon"))
    for lead in r.get("exfil") or []:
        if lead["kind"] == "telegram_bot" and ":" in lead["value"] and not lead["value"].startswith("chat_id"):
            feats.append(("telegram", lead["value"].split(":")[0], "sends_to_bot"))
        elif lead["kind"] in ("phone", "whatsapp"):
            feats.append(("phone", lead["value"].lstrip("+"), "lists_phone"))
    for pv in (r.get("cloaking") or {}).get("personas") or []:
        if pv.get("dom_hash") and pv["name"] == "uae_mobile" and r.get("verdict") == "scam":
            feats.append(("dom", pv["dom_hash"], "same_page_kit"))
    return feats


def _scam_results(limit: int = 3000) -> list[dict[str, Any]]:
    with db.session() as s:
        rows = s.exec(
            select(db.ScanRecord)
            .where(db.ScanRecord.verdict.in_(["scam", "suspicious"]))
            .order_by(db.ScanRecord.created_at.desc())
            .limit(limit)
        ).all()
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row.domain not in latest:
            latest[row.domain] = row.result()
    return list(latest.values())


def _site(r: dict[str, Any]) -> str:
    try:
        return site_key_for(r.get("final_url") or r["url"])
    except ValueError:
        return r["domain"]


def build_graph(results: list[dict[str, Any]]) -> nx.Graph:
    g = nx.Graph()
    for r in results:
        site = _site(r)
        d = f"domain:{site}"
        g.add_node(d, kind="domain", label=site, verdict=r.get("verdict"), brand=(r.get("brand") or {}).get("id"), scan_id=r.get("id"))
        for kind, value, rel in _features(r):
            n = f"{kind}:{value}"
            label = value if kind != "telegram" else f"bot {value}"
            g.add_node(n, kind=kind, label=label)
            g.add_edge(d, n, kind=rel)
    lonely = [n for n, data in g.nodes(data=True) if data["kind"] != "domain" and g.degree(n) < 2]
    g.remove_nodes_from(lonely)
    g.remove_nodes_from([n for n in list(g.nodes) if g.degree(n) == 0])
    return g


def _campaign_id(domains: list[str]) -> str:
    return "C-" + hashlib.sha1("|".join(sorted(domains)).encode()).hexdigest()[:6].upper()


def campaign_for(result: ScanResult) -> Campaign | None:
    if result.verdict == "safe":
        return None
    current = result.model_dump(mode="json")
    others = [r for r in _scam_results() if _site(r) != _site(current)]
    g = build_graph([current, *others])
    me = f"domain:{_site(current)}"
    if me not in g:
        return None
    comp = nx.node_connected_component(g, me)
    domains = [g.nodes[n]["label"] for n in comp if g.nodes[n]["kind"] == "domain"]
    if len(domains) < 2:
        return None
    sub = g.subgraph(comp)
    return Campaign(
        id=_campaign_id(domains),
        size=len(domains),
        nodes=[GraphNode(id=n, kind=d["kind"], label=d["label"], verdict=d.get("verdict")) for n, d in sub.nodes(data=True)][:80],
        edges=[GraphEdge(source=a, target=b, kind=d["kind"]) for a, b, d in sub.edges(data=True)][:160],
    )


def global_graph() -> dict[str, Any]:
    g = build_graph(_scam_results())
    campaigns = []
    for comp in nx.connected_components(g):
        domains = [g.nodes[n]["label"] for n in comp if g.nodes[n]["kind"] == "domain"]
        if len(domains) >= 2:
            brands = sorted({g.nodes[n].get("brand") for n in comp if g.nodes[n].get("brand")})
            campaigns.append({"id": _campaign_id(domains), "size": len(domains), "brands": brands, "domains": sorted(domains)})
    campaigns.sort(key=lambda c: -c["size"])
    return {
        "nodes": [{"id": n, "kind": d["kind"], "label": d["label"], "verdict": d.get("verdict"), "brand": d.get("brand"), "scan_id": d.get("scan_id")} for n, d in g.nodes(data=True)],
        "edges": [{"source": a, "target": b, "kind": d["kind"]} for a, b, d in g.edges(data=True)],
        "campaigns": campaigns,
    }
