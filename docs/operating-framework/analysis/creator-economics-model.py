#!/usr/bin/env python3
"""
NOF-002 — Creator economics stress test for MODEL A (actual consideration).

Analysis only. No runtime or product effect; imports nothing from the app.
Regenerate the dataset with:  python3 creator-economics-model.py

Model: a token's gross basis is the actual consideration attributable to it
(PO-010) and travels with the token from issuance. Allocations (PO-007) apply to
that basis at qualifying redemption (PO-008).
"""
from decimal import Decimal as D, getcontext
import csv, os

getcontext().prec = 28

# ── Canonical inputs (PO-006 pricing; token allocations per PRD/plans table) ──
# Family SEATS remain contradictory (C-02) but do not enter these economics;
# tokensPerCycle and maxProfiles are separate fields.
PLANS = {
    # key: (price, tokens per year, cadence)
    "individual_monthly": (D("8.99")  * 12, 12, "monthly"),
    "individual_annual":  (D("83.99"),      12, "annual"),
    "duo_monthly":        (D("13.99") * 12, 24, "monthly"),
    "duo_annual":         (D("129.99"),     24, "annual"),
    "family_monthly":     (D("18.99") * 12, 36, "monthly"),
    "family_annual":      (D("179.99"),     36, "annual"),
}
# Per-token basis = annual cash / annual tokens (PO-010).
BASIS = {k: (cash / D(tok)) for k, (cash, tok, _) in PLANS.items()}

PACKAGES = {           # price, tokens
    "pkg_1":  (D("9.99"),  1),
    "pkg_3":  (D("24.99"), 3),
    "pkg_5":  (D("39.99"), 5),
    "pkg_10": (D("74.99"), 10),
}
PKG_BASIS = {k: (p / D(t)) for k, (p, t) in PACKAGES.items()}

# ── Allocation (PO-007) ──
ALLOC = {
    "noetia":    D("0.45"),
    "author":    D("0.36"),
    "narrator":  D("0.09"),
    "marketing": D("0.0778"),
    "causas":    D("0.0222"),
}
assert sum(ALLOC.values()) == D("1.00")

BASE_MIX = {
    "individual_monthly": D("0.45"), "individual_annual": D("0.15"),
    "duo_monthly": D("0.15"),        "duo_annual": D("0.07"),
    "family_monthly": D("0.13"),     "family_annual": D("0.05"),
}
BASE_PKG_MIX = {"pkg_1": D("0.40"), "pkg_3": D("0.35"), "pkg_5": D("0.15"), "pkg_10": D("0.10")}


def scenario(name, mix, redemption, addon_pen, pkg_mix=None,
             self_narrated=D("0.30"), subs=10_000, addon_pkgs_per_buyer=D("1")):
    """One scenario, normalized per year at `subs` subscriptions."""
    pkg_mix = pkg_mix or BASE_PKG_MIX
    subs = D(subs)
    r = D(str(redemption))

    sub_cash = D("0"); tokens_issued = D("0"); redeemed_basis = D("0"); expired_basis = D("0")
    for plan, share in mix.items():
        cash, tok, _ = PLANS[plan]
        n = subs * share
        sub_cash += cash * n
        issued = D(tok) * n
        tokens_issued += issued
        redeemed_basis += issued * r * BASIS[plan]
        expired_basis  += issued * (D("1") - r) * BASIS[plan]

    # Add-ons. Assumption: each buyer purchases `addon_pkgs_per_buyer` packages/year.
    addon_cash = D("0"); addon_tokens = D("0")
    buyers = subs * D(str(addon_pen)) * addon_pkgs_per_buyer
    for pkg, share in pkg_mix.items():
        price, tok = PACKAGES[pkg]
        n = buyers * share
        addon_cash += price * n
        issued = D(tok) * n
        addon_tokens += issued
        redeemed_basis += issued * r * PKG_BASIS[pkg]
        expired_basis  += issued * (D("1") - r) * PKG_BASIS[pkg]

    gross_cash = sub_cash + addon_cash
    tokens_total = tokens_issued + addon_tokens
    tokens_redeemed = tokens_total * r
    tokens_expired = tokens_total - tokens_redeemed

    author = redeemed_basis * ALLOC["author"]
    narrator = redeemed_basis * ALLOC["narrator"]
    creator_total = author + narrator          # 45% combined, however split
    marketing = redeemed_basis * ALLOC["marketing"]
    causas = redeemed_basis * ALLOC["causas"]
    noetia = redeemed_basis * ALLOC["noetia"]

    avg_basis = (redeemed_basis / tokens_redeemed) if tokens_redeemed else D("0")

    return {
        "scenario": name,
        "subscribers": int(subs),
        "redemption_rate": float(r),
        "addon_penetration": float(D(str(addon_pen))),
        "self_narrated_share": float(self_narrated),
        "subscription_cash": float(sub_cash),
        "addon_cash": float(addon_cash),
        "gross_cash": float(gross_cash),
        "tokens_issued": float(tokens_total),
        "tokens_redeemed": float(tokens_redeemed),
        "tokens_expired": float(tokens_expired),
        "avg_basis_per_redeemed_token": float(avg_basis),
        "redeemed_basis_total": float(redeemed_basis),
        "expired_basis_total": float(expired_basis),
        "author_obligation": float(author),
        "narrator_obligation": float(narrator),
        "creator_obligation_total": float(creator_total),
        "creator_pct_of_gross_cash": float(creator_total / gross_cash * 100) if gross_cash else 0.0,
        "avg_creator_per_redemption": float(creator_total / tokens_redeemed) if tokens_redeemed else 0.0,
        "marketing_alloc": float(marketing),
        "causas_alloc": float(causas),
        "noetia_alloc_from_redemptions": float(noetia),
        "unallocated_expired_value": float(expired_basis),
        "noetia_plus_expired": float(noetia + expired_basis),
        "noetia_pct_of_gross_cash": float((noetia + expired_basis) / gross_cash * 100) if gross_cash else 0.0,
    }


def heavy(primary, rest=D("0.10")):
    """Mix concentrated on one plan, remainder spread over the others."""
    mix = {k: rest / D(len(PLANS) - 1) for k in PLANS}
    mix[primary] = D("1") - rest
    return mix


SCENARIOS = [
    ("S1 individual-heavy",  {"individual_monthly": D("0.70"), "individual_annual": D("0.10"),
                              "duo_monthly": D("0.12"), "duo_annual": D("0.03"),
                              "family_monthly": D("0.04"), "family_annual": D("0.01")}, 0.75, 0.15, None, D("0.30")),
    ("S2 annual-heavy",      {"individual_monthly": D("0.15"), "individual_annual": D("0.45"),
                              "duo_monthly": D("0.08"), "duo_annual": D("0.17"),
                              "family_monthly": D("0.05"), "family_annual": D("0.10")}, 0.75, 0.15, None, D("0.30")),
    ("S3 family-heavy",      {"individual_monthly": D("0.15"), "individual_annual": D("0.05"),
                              "duo_monthly": D("0.15"), "duo_annual": D("0.05"),
                              "family_monthly": D("0.40"), "family_annual": D("0.20")}, 0.75, 0.15, None, D("0.30")),
    ("S4 high redemption",   BASE_MIX, 0.95, 0.15, None, D("0.30")),
    ("S5 high breakage",     BASE_MIX, 0.50, 0.15, None, D("0.30")),
    ("S6 add-on intensive",  BASE_MIX, 0.75, 0.50, None, D("0.30")),
    ("S7 creator-intensive", BASE_MIX, 0.95, 0.15, None, D("0.80")),
    ("S8 lowest-basis",      heavy("family_annual", D("0.0")), 1.00, 0.00, None, D("0.30")),
    ("S9 max creator load",  BASE_MIX, 1.00, 0.50, None, D("0.80")),
    ("S10 noetia-favorable", BASE_MIX, 0.40, 0.50, None, D("0.30")),
    ("S11 balanced base",    BASE_MIX, 0.75, 0.15, None, D("0.30")),
]

if __name__ == "__main__":
    out = os.path.dirname(os.path.abspath(__file__))
    rows = []
    for name, mix, r, p, pm, sn in SCENARIOS:
        rows.append(scenario(name, mix, r, p, pm, sn))
    # Scale sweep on the balanced base case.
    for n in (2_500, 10_000, 50_000, 100_000):
        rows.append(scenario(f"S11 balanced @ {n:,}", BASE_MIX, 0.75, 0.15, None, D("0.30"), subs=n))

    with open(os.path.join(out, "creator-economics-scenarios.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print("── Per-token gross basis (PO-010) ──")
    for k, v in BASIS.items():
        print(f"  {k:22} ${v:.6f}")
    for k, v in PKG_BASIS.items():
        print(f"  {k:22} ${v:.6f}")

    print("\n── Creator dollars per redemption (self-narrated, 45%) ──")
    allb = {**BASIS, **PKG_BASIS}
    for k, v in sorted(allb.items(), key=lambda x: x[1]):
        print(f"  {k:22} ${v * D('0.45'):.4f}   author ${v*D('0.36'):.4f} | narrator ${v*D('0.09'):.4f}")
    lo, hi = min(allb.values()), max(allb.values())
    print(f"\n  spread: ${lo*D('0.45'):.4f} → ${hi*D('0.45'):.4f}  ({(hi/lo - 1)*100:.1f}% higher)")

    print("\n── Scenarios ──")
    hdr = f"{'scenario':24} {'gross cash':>13} {'creator':>12} {'%cash':>7} {'$/redeem':>9} {'noetia%':>8}"
    print(hdr); print("-" * len(hdr))
    for r in rows:
        print(f"{r['scenario']:24} {r['gross_cash']:>13,.0f} {r['creator_obligation_total']:>12,.0f} "
              f"{r['creator_pct_of_gross_cash']:>6.2f}% {r['avg_creator_per_redemption']:>9.4f} "
              f"{r['noetia_pct_of_gross_cash']:>7.2f}%")
