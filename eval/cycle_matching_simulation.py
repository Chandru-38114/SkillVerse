"""Cycle-matching simulation (paper Section IX-I).

Question: when members arrive to learn and only some qualified members are
actually free to teach, how many learners can be matched by pairs alone, and
how many by pairs plus three-way cycles?

Model
-----
* A cohort of N members over four skills (Python, Java, Data Structures, Web).
* Each member gets a level 0..4 in every skill, drawn from a per-skill
  distribution meant to resemble third- and fourth-year CS students.
* Each member wants ONE skill: the one where their level is lowest
  (ties broken at random).
* Member u is eligible to teach member v when v wants a skill s in which
  level(u, s) >= level(v, s) + GAP and level(u, s) >= FLOOR.
* An eligible pair becomes an edge u -> v with probability `a` (availability:
  u is free and willing to teach v).  Sampled once per ordered pair.
* A member is "matched by pairs" if they lie on a 2-cycle, and "matched by
  pairs and cycles" if they lie on a 2-cycle or a 3-cycle.

Nothing here touches the application or the database; it is pure Python.

Usage
-----
    python cycle_matching_simulation.py                # full run, seed 2026
    python cycle_matching_simulation.py --trials 50    # quicker, noisier
    python cycle_matching_simulation.py --seed 7
"""
import argparse
import json
import random
import statistics

SKILLS = ["Python", "Java", "DSA", "Web"]
DIST = {
    "Python": [0.05, 0.15, 0.30, 0.30, 0.20],
    "Java":   [0.10, 0.25, 0.30, 0.25, 0.10],
    "DSA":    [0.10, 0.25, 0.30, 0.25, 0.10],
    "Web":    [0.30, 0.30, 0.20, 0.15, 0.05],
}
CUM = {s: [sum(p[: i + 1]) for i in range(5)] for s, p in DIST.items()}
GAP, FLOOR = 2, 2


def draw_level(skill):
    r = random.random()
    for level, c in enumerate(CUM[skill]):
        if r <= c:
            return level
    return 4


def one_run(n, avail, n_wanted=1):
    members = []
    for _ in range(n):
        lv = {s: draw_level(s) for s in SKILLS}
        order = sorted(SKILLS, key=lambda s: (lv[s], random.random()))
        members.append((lv, order[:n_wanted]))

    out = [0] * n   # bitmask of members that i will teach
    inn = [0] * n   # bitmask of members who will teach i
    for i, (li, _) in enumerate(members):
        for j, (lj, wants) in enumerate(members):
            if i == j:
                continue
            for s in wants:
                if li[s] >= lj[s] + GAP and li[s] >= FLOOR:
                    if random.random() < avail:
                        out[i] |= 1 << j
                        inn[j] |= 1 << i
                    break

    pairs = 0
    for i in range(n):
        mutual = out[i] & inn[i]
        if mutual:
            pairs |= (1 << i) | mutual

    triples = 0
    for i in range(n):
        j_mask, idx = out[i], 0
        while j_mask:
            if j_mask & 1:
                closers = out[idx] & inn[i]   # k with j->k and k->i
                if closers:
                    triples |= (1 << i) | (1 << idx) | closers
            j_mask >>= 1
            idx += 1
    return bin(pairs).count("1") / n, bin(pairs | triples).count("1") / n


def sweep(n, avail, trials, n_wanted=1):
    a, b = [], []
    for _ in range(trials):
        p, pc = one_run(n, avail, n_wanted)
        a.append(p)
        b.append(pc)
    return 100 * statistics.mean(a), 100 * statistics.mean(b)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--trials", type=int, default=200)
    ap.add_argument("--n", type=int, default=100)
    args = ap.parse_args()
    random.seed(args.seed)

    grid = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.70, 1.00]
    print(f"N={args.n}, one wanted skill per member, gap>={GAP}, floor>={FLOOR}, "
          f"{args.trials} trials per point, seed {args.seed}\n")
    print(f"{'a':>5} {'pairs only':>11} {'pairs+cycles':>13} {'gain':>8}")
    main = []
    for a in grid:
        p, pc = sweep(args.n, a, args.trials)
        main.append({"a": a, "pairs": round(p, 1), "cycles": round(pc, 1)})
        print(f"{a:>5.2f} {p:>10.1f}% {pc:>12.1f}% {pc - p:>7.1f}pp")

    print("\nSensitivity: two wanted skills per member")
    print(f"{'a':>5} {'pairs only':>11} {'pairs+cycles':>13} {'gain':>8}")
    sens = []
    for a in (0.20, 0.50, 1.00):
        p, pc = sweep(args.n, a, max(50, args.trials // 2), n_wanted=2)
        sens.append({"a": a, "pairs": round(p, 1), "cycles": round(pc, 1)})
        print(f"{a:>5.2f} {p:>10.1f}% {pc:>12.1f}% {pc - p:>7.1f}pp")

    print("\nJSON:", json.dumps({"main": main, "two_wanted": sens}))
