import Foundation

/// One block of a running session.
struct RunBlock: Equatable {
    var id: String
    var kind: String
    var role: String
    var secs: Int? = nil
    var reps: [Bool] = []
    var target = 5
    var lv: [String: Int] = [:]
    var raise: String? = nil
    var before = 0
    var plays = 0
    var rated = false
    var yds: [Int?] = []
    var breakEnd: Date? = nil
}

/// A session is a short playlist of blocks.
struct Run: Equatable {
    var blocks: [RunBlock]
    var i = 0
    var fromPlan: Bool
    var start: Date? = nil
    var marks = 0
}

extension AppModel {
    var block: RunBlock? { run.flatMap { $0.blocks[safe: $0.i] } }
    func updateBlock(_ change: (inout RunBlock) -> Void) {
        guard var r = run, r.blocks.indices.contains(r.i) else { return }
        change(&r.blocks[r.i]); run = r
    }
    var blockSkill: Skill { Catalog.any(block?.id ?? "free") }
    /// marker: the YES pad · outcome: Clean / Needed help / No go · sound: the ladder · break: a countdown
    var mode: String {
        guard let b = block else { return "marker" }
        if b.kind == "sound" { return "sound" }
        if b.kind == "break" { return "break" }
        return Catalog.any(b.id).isOutcome ? "outcome" : "marker"
    }
    func roundSize(_ s: Skill) -> Int { s.isOutcome ? 3 : 5 }
    func targetFor(_ b: RunBlock) -> Int {
        if b.kind == "free" || b.kind == "sound" { return Int.max }
        if Catalog.any(b.id).isOutcome { return b.kind == "learn" ? 6 : 3 }
        return b.kind == "learn" ? (stage == "puppy" ? 5 : 10) : 5
    }

    // MARK: Starting

    func startPlan() {
        let p = plan
        st.plan = p
        if p.blocks.first?.kind == "charge" { route = .charge; return }
        begin(p.blocks, fromPlan: true)
    }
    func startSingle(_ id: String) {
        if !st.charged && id != "free" { toast("Charge Yes first: 2 minutes so Yes means food."); route = .charge; return }
        let kind = id == "free" ? "free" : id.hasPrefix("snd:") ? "sound" : kindFor(id)
        begin([PlanBlock(id: id, kind: kind, role: "only")], fromPlan: false)
    }
    private func begin(_ blocks: [PlanBlock], fromPlan: Bool) {
        coach = nil
        run = Run(blocks: blocks.map { RunBlock(id: $0.id, kind: $0.kind, role: $0.role, secs: $0.secs, before: level($0.id)) }, fromPlan: fromPlan)
        route = .training
        enterBlock()
    }
    func enterBlock() {
        cancelHold(); breakTask?.cancel(); coach = nil; undoSnap = nil
        updateBlock { b in
            b.target = targetFor(b)
            if b.kind == "proof" {
                if let t = proofTarget(b.id), t.raise != nil { b.lv = t.lv; b.raise = t.raise } else { b.kind = "practice" }
            }
            if b.kind == "review" || b.kind == "practice" { b.lv = bestLevels(b.id) }
            if b.kind == "break" { b.breakEnd = Date().addingTimeInterval(Double(b.secs ?? 120)) }
        }
        if block?.kind == "break" { runBreak() }
        if block?.kind == "learn", let id = block?.id { stepHowto(id) }
    }
    /// A new step brings new setup, so its how-to opens the first time it is reached.
    func stepHowto(_ id: String) {
        let key = "\(id):\(prog(id).step)"
        if !st.seen.contains(key) { st.seen.append(key); howtoOpen = true }
    }

    /// The step shown on screen: the current ladder step while learning; afterwards the hold step (or the last).
    /// Where the step on screen sits in its skill's ladder (the animation is looked up by this).
    var currentStepIndex: Int {
        guard let b = block else { return 0 }
        let steps = Catalog.any(b.id).steps
        if b.kind == "learn" { return prog(b.id).step }
        return steps.firstIndex(where: { $0.hold != nil }) ?? max(0, steps.count - 1)
    }
    var currentStep: Step? {
        guard let b = block else { return nil }
        let s = Catalog.any(b.id)
        guard !s.steps.isEmpty else { return nil }
        if b.kind == "learn" { return s.steps[prog(b.id).step] }
        return s.steps.first(where: { $0.hold != nil }) ?? s.steps.last
    }
    var markText: String {
        guard let b = block else { return "" }
        let s = Catalog.any(b.id)
        let m = b.kind == "learn" ? currentStep?.mark ?? "" : s.proofMark ?? s.steps.last?.mark ?? ""
        return m.prefix(1).uppercased() + m.dropFirst()
    }
    /// A hold step uses its own range while learning; once proofing, the duration level sets it.
    var holdRange: ClosedRange<Int>? {
        guard let b = block, let step = b.kind == "learn" ? currentStep : Catalog.any(b.id).steps.first(where: { $0.hold != nil }),
              let h = step.hold, h.count == 2 else { return nil }
        let s = Catalog.any(b.id)
        if b.kind != "learn", s.proof?.dur != nil, let d = b.lv["dur"] { let v = Int(s.value("dur", d)); return v...Int((Double(v) * 1.3).rounded()) }
        return h[0]...max(h[0], h[1])
    }

    // MARK: Marks

    private func snapshot() {
        if let r = run { undoSnap = (root, r, recorder.markCount) }
    }
    private func startClock() {
        guard run?.start == nil else { return }
        run?.start = Date()
    }
    func mark(_ kind: MarkKind, at uptime: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        guard run != nil else { return }
        // Sound first: everything else can wait a few microseconds.
        switch kind {
        case .yes: audio.play(.yes)
        case .toss: audio.play(.toss)
        case .keep: audio.play(.keep)
        case .free: audio.play(.free)
        case .miss: break
        }
        feedback()
        snapshot(); startClock()
        recorder.addMark(kind.rawValue, at: uptime)
        switch kind {
        case .miss: cancelHold(); logRep(false)
        case .yes, .toss: cancelHold(); run?.marks += 1; useTreat(); logRep(true)
        case .free: cancelHold()
        case .keep: break
        }
        saveLive()
    }
    /// Field reps are judged after the fact: Clean, Needed help, or No go.
    func outcome(_ i: Int, at uptime: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        guard let b = block, b.kind != "sound", b.kind != "break" else { return }
        let s = Catalog.any(b.id)
        feedback()
        snapshot(); startClock()
        recorder.addMark(i == 0 ? "yes" : "miss", at: uptime)
        if i == 0 { run?.marks += 1; useTreat() }
        updateBlock { $0.yds.append(gps.yards) }
        if s.startle == true && i == 2 { startleStop(s); saveLive(); return }
        logRep(i == 0); saveLive()
    }
    func undo() {
        guard let u = undoSnap else { return }
        let sameBlock = run?.i == u.run.i
        root = u.root; run = u.run; recorder.trimMarks(to: max(0, u.recMarks))
        undoSnap = nil; coach = nil
        if !sameBlock { enterBlock() }
        toast("Last mark undone.")
    }
    private func saveLive() {
        guard let r = run, let start = r.start else { return }
        st.live = LiveSession(start: start, at: Date(), marks: r.marks, blocks: r.blocks.map(\.id))
    }

    // MARK: Rounds

    // 5 tries for marker skills (4-5 right = harder, 3 = stay, 0-2 = easier);
    // 3 reps for field outcome skills (2-3 clean = harder, 1 = stay, 0 = easier). Applied automatically; Easier/Harder override.
    private func logRep(_ ok: Bool) {
        guard let b = block, b.kind != "free" else { return }
        let s = Catalog.any(b.id), size = roundSize(s)
        updateBlock { $0.reps.append(ok) }
        if b.kind == "learn" { updateProg(b.id) { $0.reps.append(ok) } }
        let r = block?.reps ?? []
        if size == 5 && !ok && r.count >= 2 && !r[r.count - 2] && r.count % 5 != 0 {
            coach = Coach(text: "Two misses in a row. Make it easier for a few reps: closer, shorter, quieter.", actions: [dismiss("OK")])
        }
        guard r.count % size == 0 else { return }
        let hits = r.suffix(size).filter { $0 }.count
        let msg = roundResult(s, hits: hits, size: size)
        if r.count < (block?.target ?? 0) { coach = Coach(text: msg, actions: [dismiss("OK")]); return }
        endBlockCoach(msg, more: { [weak self] in self?.updateBlock { $0.target += size } })
    }
    func dismiss(_ label: String, solid: Bool = true) -> CoachAction { CoachAction(label: label, solid: solid) {} }
    func endBlockCoach(_ msg: String, more: (() -> Void)? = nil) {
        guard let r = run else { return }
        let nxt = r.blocks[safe: r.i + 1]
        var acts = [CoachAction(label: nxt.map { "Next: " + ($0.kind == "break" ? "a break" : Catalog.any($0.id).name) } ?? "Finish session", solid: true) { [weak self] in self?.nextBlock() }]
        if let more { acts.append(CoachAction(label: "One more round", solid: false, run: more)) }
        coach = Coach(text: msg, actions: acts)
    }
    private func roundResult(_ s: Skill, hits: Int, size: Int) -> String {
        guard let b = block else { return "" }
        let id = b.id, p = prog(id)
        let up = size == 3 ? hits >= 2 : hits >= 4, down = size == 3 ? hits == 0 : hits <= 2
        let score = "\(hits) of \(size)"
        if b.kind == "learn" {
            let last = p.step == s.steps.count - 1
            // Long retrieves on hard ground wait for the growth plates.
            if up, let capStep = s.youngCap, !platesClosed, p.step >= capStep {
                return "\(score). Longer ones wait until \(dogName)'s growth plates close (about \(platesMonths) months). Keep this distance and vary the place and cover."
            }
            if up && last {
                let was = p.done
                updateProg(id) { q in if !q.passDays.contains(today) { q.passDays.append(today) }; q.done = q.passDays.count >= 2; q.reps = [] }
                let q = prog(id)
                if q.done && !was {
                    updateBlock { nb in
                        if let t = proofTarget(id), t.raise != nil { nb.kind = "proof"; nb.lv = t.lv; nb.raise = t.raise } else { nb.kind = "practice"; nb.lv = bestLevels(id) }
                        nb.reps = []; nb.target = targetFor(nb)
                    }
                    return "\(score) on the last step, on \(q.passDays.count) different days: \(s.name) is Fluent! Next it gets proofed: \(s.dims.isEmpty ? "practice in new places." : "longer, farther, busier, one at a time.")"
                }
                return "\(score) on the last step. Pass it again on another day, ideally somewhere new, to make it Fluent."
            }
            if up { updateProg(id) { $0.step += 1; $0.reps = [] }; stepHowto(id); return "\(score). \(dogName) has this step. On to step \(prog(id).step + 1): \(s.steps[prog(id).step].t)." }
            if !down { return "\(score). Same step for another round." }
            if p.step > 0 { updateProg(id) { $0.step -= 1; $0.reps = [] }; stepHowto(id); return "\(score). Too hard right now, so back to step \(prog(id).step + 1) to build it up again." }
            return "\(score). Make it easier: quieter place, closer, better treats. Is Yes charged?"
        }
        var extra = ""
        if b.kind == "proof" {
            if up {
                updateProg(id) { q in for d in s.dims { q.best[d] = max(q.best[d] ?? 0, b.lv[d] ?? 0) } }
                if level(id) >= 2 { extra = "\(s.name) is Proofed! Now pass it in 3 kinds of place." }
                else if let t = proofTarget(id) { extra = "Passed at \(describe(s, b.lv)). Next time: \(describe(s, t.lv))." }
                if level(id) >= 2 { logPlace(id) }
            } else { extra = down ? "Too big a jump. Next time eases off, then builds back." : "Same level next time." }
        } else if b.kind == "review" {
            let r = reviewResult(id, up)
            extra = r == "pass" ? "Still solid. Next review in \(prog(id).interval) days." : r == "drop" ? "Two reviews missed in a row, so it goes back to Proofed for some practice in different places." : "Rusty: it comes back sooner for practice."
            updateBlock { $0.kind = "practice" }
        } else if up && level(id) >= 2 {
            extra = logPlace(id) ? "\(s.name) is Reliable! It goes on a review schedule now so it never fades." : level(id) == 2 ? nextText(id) : ""
        }
        if extra.isEmpty && up { extra = b.role == "warm" ? "Good warm-up." : b.role == "finish" ? "Calm finish. Session done." : "Solid." }
        if extra.isEmpty { extra = !down ? "Close. Keep it easy and go again." : "Make it easier next round: closer, shorter, quieter." }
        return "\(score). \(extra)"
    }
    func setStep(_ n: Int) {
        guard let b = block else { return }
        let s = Catalog.any(b.id)
        cancelHold()
        updateProg(b.id) { $0.step = min(max(0, n), s.steps.count - 1); $0.reps = [] }
        stepHowto(b.id)
    }
    func resetSkill(_ id: String) {
        cancelHold(); coach = nil
        st.progress[id] = SkillProgress()
        if block?.id == id { updateBlock { $0.kind = "learn"; $0.reps = []; $0.target = targetFor($0) } }
    }

    // MARK: Gun safety, the sound ladder, breaks

    /// Fear is never trained through: back off 2 steps, log it against the gun ladder (which locks this skill), stop for today.
    private func startleStop(_ s: Skill) {
        guard let b = block else { return }
        updateBlock { $0.reps.append(false) }
        updateProg(b.id) { $0.step = max(0, $0.step - 2); $0.reps = [] }
        updateSound("gun") { $0.log.append(SoundLog(day: today, r: "startled")); $0.level = max(0, $0.level - 2); $0.calm = 0 }
        let p = prog(b.id)
        endBlockCoach("Worried: stop gun work for today. It restarts at step \(p.step + 1) (\(s.steps[p.step].t)) after a few calm days back on the gunshot sound ladder. Never fire closer to a nervous dog.")
    }
    var soundStep: Int {
        guard let b = block, b.kind == "sound" else { return 1 }
        return min(soundCap, sound(String(b.id.dropFirst(4))).level + 1)
    }
    func playLadder() {
        guard let b = block, b.kind == "sound" else { return }
        audio.play(named: String(b.id.dropFirst(4)), volume: AppModel.ladderVolume(soundStep))
        feedback(); startClock()
        updateBlock { $0.plays += 1 }
        run?.marks += 1; useTreat(); saveLive()
    }
    func rateLadder(_ r: String) {
        guard let b = block, b.kind == "sound", !b.rated, r == "startled" || b.plays >= 5 else { return }
        let sid = String(b.id.dropFirst(4)), name = Catalog.sounds.first { $0.id == sid }?.name ?? sid
        startClock()
        updateBlock { $0.rated = true; $0.reps.append(r == "relaxed") }
        var msg = ""
        updateSound(sid) { sd in
            sd.log.append(SoundLog(day: today, r: r)); sd.log = Array(sd.log.suffix(30))
            if r == "relaxed" {
                // The four quietest steps move up after 2 relaxed sessions, the louder ones after 3.
                let need = calmNeed(sd)
                sd.calm += 1
                if sd.calm >= need && sd.level < soundCap { sd.level += 1; sd.calm = 0; msg = "Relaxed \(need) sessions running: \(name) moves up to step \(min(10, sd.level + 1)) next time." }
                else if sd.level >= soundCap { msg = "Relaxed at the top step\(sd.level < 10 ? " for a puppy" : "")." }
                else { let left = need - sd.calm; msg = "Relaxed. \(left) more relaxed session\(left == 1 ? "" : "s") at this step, then it moves up." }
            } else if r == "noticed" { msg = "Noticed but recovered: the same step next time." }
            else { sd.level = max(0, sd.level - 2); sd.calm = 0; msg = "Startled: stop for today. Next time starts 2 steps quieter (step \(sd.level + 1)), after a day off. Never push a scared dog closer to a sound." }
        }
        saveLive()
        endBlockCoach(msg)
    }
    private func runBreak() {
        breakTask?.cancel()
        guard let end = block?.breakEnd, let i = run?.i else { return }
        breakTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 500_000_000)
                guard let self, !Task.isCancelled else { return }
                if Date() >= end { if self.run?.i == i { self.audio.play(.free); self.nextBlock() }; return }
                self.objectWillChange.send()
            }
        }
    }

    // MARK: Hold timer

    /// A random target inside the range so the dog can't predict the end, then marks Yes.
    func toggleHold() {
        if holdEnd != nil { cancelHold(); return }
        guard let range = holdRange else { return }
        audio.ensureRunning()
        let end = Date().addingTimeInterval(Double(Int.random(in: range)))
        holdEnd = end
        holdTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(max(0, end.timeIntervalSinceNow) * 1_000_000_000))
            guard !Task.isCancelled, let self, self.holdEnd == end else { return }
            self.holdEnd = nil
            self.mark(.yes)
        }
    }
    func cancelHold() { holdTask?.cancel(); holdTask = nil; holdEnd = nil }

    // MARK: Moving on and finishing

    func nextBlock() {
        cancelHold(); breakTask?.cancel()
        if let b = block, !b.reps.isEmpty, Catalog.skill(b.id) != nil { updateProg(b.id) { $0.last = today } }
        guard let r = run else { return }
        if r.i < r.blocks.count - 1 { run?.i += 1; enterBlock() } else { closeRun() }
    }

    private func fileSession(_ ids: [String], start: Date, secs: Int, marks: Int, video: String?, blocks: [RunBlock]) {
        st.history.insert(HistoryEntry(at: start.addingTimeInterval(Double(secs)), secs: secs, marks: marks, blocks: ids), at: 0)
        if st.history.count > 100 { st.history.removeLast(st.history.count - 100) }
        if !st.days.contains(today) { st.days.append(today) }
        st.days = Array(st.days.suffix(120))
        let names = ids.map { Catalog.any($0).name }
        let hits = blocks.reduce(0) { $0 + $1.reps.filter { $0 }.count }, tries = blocks.reduce(0) { $0 + $1.reps.count }
        st.last = Summary(title: names.count > 2 ? "\(names[0]) + \(names.count - 1) more" : names.joined(separator: " + "), secs: secs, marks: marks,
                          rate: secs >= 20 ? Int((Double(marks) / (Double(secs) / 60)).rounded()) : nil,
                          round: tries > 0 ? "\(hits) of \(tries) tries right" : "",
                          treats: "\(treatsUsedToday) of \(root.settings.budget) treats used today", video: video)
    }
    /// A session cut off by iOS closing the app is filed on the next launch.
    func recoverLive() {
        guard let s = st.live else { return }
        st.live = nil
        if s.marks > 0 { fileSession(s.blocks, start: s.start, secs: max(1, Int(s.at.timeIntervalSince(s.start))), marks: s.marks, video: nil, blocks: []) }
    }
    func closeRun() {
        guard let r = run else { route = nil; return }
        cancelHold(); breakTask?.cancel(); coach = nil; gps.stop()
        let video = recorder.sessionVideo
        recorder.stop(); recorder.sessionVideo = nil
        run = nil; undoSnap = nil
        let worked = r.blocks.filter { !$0.reps.isEmpty || ($0.kind == "free" && r.marks > 0) }
        if let start = r.start, r.marks > 0 {
            let secs = Int(Date().timeIntervalSince(start).rounded())
            for b in worked where Catalog.skill(b.id) != nil { updateProg(b.id) { $0.last = today } }
            fileSession(worked.map(\.id), start: start, secs: secs, marks: r.marks, video: video, blocks: worked)
            if r.fromPlan && r.marks >= 5 { st.plan?.done = true }
            st.live = nil
            let rows = worked.filter { $0.id != "free" }.map { b in
                (id: b.id, name: Catalog.any(b.id).name, before: b.before, after: level(b.id), hits: b.reps.filter { $0 }.count, tries: b.reps.count, next: nextText(b.id))
            }
            pendingFinished = FinishedSession(secs: secs, marks: r.marks, rows: rows, field: worked.contains { AppModel.fieldTracks.contains(Catalog.any($0.id).track) })
        } else { st.live = nil }
        route = nil
    }
    func rateSession(_ r: String) {
        st.ratings.append(r); st.ratings = Array(st.ratings.suffix(10))
        if !st.history.isEmpty { st.history[0].rating = r }
    }

    // MARK: Recording

    func toggleRecording() {
        if recorder.isRecording { recorder.stop(); return }
        Task {
            switch await recorder.start() {
            case .started: break
            case .denied: cameraDenied = true
            case .noCamera: toast("This phone's back camera isn't available right now.")
            }
        }
    }
}
