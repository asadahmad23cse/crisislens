"""Stage 4: amplification, copies, spam accounts, and Need Units.

* Amplification: native reposts (is_repost) and "RT @user:" text.
* Copies: manual re-shares ("Sharing: ...", "Please share: ...").
* Spam / bot accounts: donation and giveaway link spam from new, tiny accounts.
* Need Units: near-duplicate clusters (MinHash, 5-char shingles, 32 hashes,
  Jaccard >= 0.85) within blocks of event, unit, need label and 6-hour bucket.
"""
from __future__ import annotations

import hashlib
import re

import numpy as np

SHARE_PREFIX = re.compile(r"^(sharing|please share)\s*:\s*", re.IGNORECASE)
RT_PREFIX = re.compile(r"^RT @\w+:\s*")
SPAM_TEXT = re.compile(r"bit\.ly|giveaway|wallet in bio|usdt|btc|click to donate|donate here",
                       re.IGNORECASE)


def core_text(text: str) -> str:
    return SHARE_PREFIX.sub("", RT_PREFIX.sub("", text)).strip()


def is_amplification(text: str, is_repost) -> bool:
    return bool(is_repost == 1 or RT_PREFIX.match(text))


def is_copy(text: str) -> bool:
    return bool(SHARE_PREFIX.match(RT_PREFIX.sub("", text)))


def spam_account_scores(posts) -> dict[str, float]:
    """Per-author spam score in [0,1] from observable account features.

    Uses only: share of the author's posts that contain link/donation spam,
    account age and follower count. No gold labels.
    """
    g = posts.assign(spam=posts.text.str.contains(SPAM_TEXT)).groupby("author_hash").agg(
        spam=("spam", "mean"), age=("author_account_age_days", "min"),
        followers=("author_followers", "max"))
    score = 0.6 * g.spam + 0.2 * (g.age < 30) + 0.2 * (g.followers < 50)
    return score.to_dict()


# ---------------------------------------------------------------- MinHash ---
N_HASH, SHINGLE, THRESHOLD = 32, 5, 0.85
_P = (1 << 61) - 1
_rng = np.random.default_rng(2026)
_A = _rng.integers(1, _P, N_HASH, dtype=np.int64).astype(object)
_B = _rng.integers(0, _P, N_HASH, dtype=np.int64).astype(object)


def minhash(text: str) -> tuple[int, ...]:
    t = re.sub(r"\s+", " ", text.lower())
    sh = {t[i:i + SHINGLE] for i in range(max(1, len(t) - SHINGLE + 1))}
    hs = [int.from_bytes(hashlib.blake2b(s.encode(), digest_size=8).digest(), "big") for s in sh]
    return tuple(min((a * h + b) % _P for h in hs) for a, b in zip(_A, _B))


def jaccard_est(a, b) -> float:
    return sum(x == y for x, y in zip(a, b)) / N_HASH


def cluster_need_units(df) -> np.ndarray:
    """Greedy leader clustering inside blocks. df needs columns
    block (hashable) and sig (minhash tuple). Returns an int cluster id per row."""
    out = np.full(len(df), -1)
    nxt = 0
    for _, idx in df.groupby("block").indices.items():
        leaders: list[tuple[int, tuple]] = []
        for i in idx:
            s = df.sig.iat[i]
            for cid, ls in leaders:
                if jaccard_est(s, ls) >= THRESHOLD:
                    out[i] = cid
                    break
            else:
                leaders.append((nxt, s))
                out[i] = nxt
                nxt += 1
    return out
