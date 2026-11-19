import AVFoundation
import SwiftUI
import UIKit

struct CoachAction: Identifiable {
    let id = UUID()
    let label: String
    let solid: Bool
    let run: () -> Void
}

struct Coach {
    let text: String
    let actions: [CoachAction]
}

enum Route: Identifiable, Equatable {
    case training, charge
    var id: String { self == .training ? "training" : "charge" }
}

@MainActor
final class Haptics {
    private let gen = UIImpactFeedbackGenerator(style: .rigid)
    init() { gen.prepare() }
    func tap() { gen.impactOccurred(); gen.prepare() }
}

/// The app's brain. The logic mirrors src/app.js in the web app: change both together.
@MainActor
final class AppModel: ObservableObject {
    @Published var root: SavedRoot { didSet { scheduleSave() } }
    @Published var run: Run?
    @Published var coach: Coach?
    @Published var holdEnd: Date?
    @Published var route: Route?
    @Published var showGuide = false
    @Published var showOnboarding: Dog?
    @Published var finished: FinishedSession?
    @Published var toastText: String?
    @Published var flashTick = 0
    @Published var bluetooth = false
    @Published var cameraDenied = false
    @Published var howtoOpen = false

    /// The summary waits for the training screen to finish closing, then shows.
    var pendingFinished: FinishedSession?
    func showPendingSummary() { if let f = pendingFinished { pendingFinished = nil; finished = f } }

    let audio = MarkerAudio.shared
    let recorder = Recorder()
    let gps = DistanceTracker()
    let haptics = Haptics()
    var holdTask: Task<Void, Never>?
    var breakTask: Task<Void, Never>?
    var undoSnap: (root: SavedRoot, run: Run, recMarks: Int)?
    private var toastTask: Task<Void, Never>?
    private var savePending = false
    private let fileURL: URL

    // MARK: Setup and saving

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("state-v2.json")
        var r = (try? Data(contentsOf: fileURL)).flatMap { try? JSONDecoder.app.decode(SavedRoot.self, from: $0) }
            ?? AppModel.migrateV1(dir.appendingPathComponent("state.json")) ?? SavedRoot()
        for k in r.states.keys { r.states[k]?.sanitize() }
        if r.active == nil || !r.dogs.contains(where: { $0.id == r.active }) { r.active = r.dogs.first?.id }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-demo") { r = AppModel.demoRoot() }
        #endif
        root = r
        audio.volume = Float(r.settings.volume)
        showGuide = !r.guideSeen && !r.dogs.isEmpty
        if dog != nil { recoverLive() }
        bluetooth = audio.outputIsBluetooth
        recorder.onFinish = { [weak self] ok, reason in
            guard let self else { return }
            if !ok { self.toast("The video couldn't be saved. Check that the phone has free space.") }
            else if reason == "cap" { self.toast("Filming stopped at 10 minutes. Sessions work best short.") }
        }
        NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.bluetooth = self?.audio.outputIsBluetooth ?? false }
        }
    }

    /// Several changes in one tap become one write.
    private func scheduleSave() {
        guard !savePending else { return }
        savePending = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.savePending = false
            if let data = try? JSONEncoder.app.encode(self.root) { try? data.write(to: self.fileURL, options: .atomic) }
        }
    }

    /// Version 1 of the iPhone app kept one dog in state.json; move it into the first dog profile.
    static func migrateV1(_ url: URL) -> SavedRoot? {
        guard let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        var r = SavedRoot()
        let s = obj["settings"] as? [String: Any] ?? [:]
        r.settings.volume = s["volume"] as? Double ?? 0.8
        r.settings.haptic = s["haptic"] as? Bool ?? true
        r.settings.flash = s["flash"] as? Bool ?? false
        r.settings.budget = s["budget"] as? Int ?? 60
        var dog = Dog()
        dog.name = s["dog"] as? String ?? ""
        dog.legacy = true
        dog.goals = ["foundations", "life"]
        var st = DogState()
        if let prog = obj["progress"], let pd = try? JSONSerialization.data(withJSONObject: prog),
           let p = try? JSONDecoder().decode([String: SkillProgress].self, from: pd) { st.progress = p }
        st.charged = obj["charged"] as? Bool ?? false
        st.seen = obj["seen"] as? [String] ?? []
        r.guideSeen = obj["guideSeen"] as? Bool ?? false
        r.dogs = [dog]; r.active = dog.id; r.states[dog.id] = st
        return r
    }

    // MARK: The active dog

    var dog: Dog? { root.dogs.first { $0.id == root.active } }
    var dogName: String { dog.map { $0.name.isEmpty ? "your dog" : $0.name } ?? "your dog" }
    var st: DogState {
        get { root.states[root.active ?? ""] ?? DogState() }
        set { if let a = root.active { root.states[a] = newValue } }
    }
    func updateDog(_ change: (inout Dog) -> Void) {
        guard let i = root.dogs.firstIndex(where: { $0.id == root.active }) else { return }
        change(&root.dogs[i])
    }
    func switchDog(_ id: String) { root.active = id; coach = nil }
    func saveDog(_ d: Dog) {
        var d = d
        d.legacy = false
        if let i = root.dogs.firstIndex(where: { $0.id == d.id }) { root.dogs[i] = d } else { root.dogs.append(d); root.states[d.id] = DogState() }
        root.active = d.id
        st.plan = nil
        if !root.guideSeen { showGuide = true }
    }
    func removeDog(_ id: String) {
        root.dogs.removeAll { $0.id == id }
        root.states[id] = nil
        root.active = root.dogs.first?.id
    }

    // MARK: Days

    static func day(_ d: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }
    static func date(_ day: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: day + " 12:00")
    }
    var today: String { Self.day() }
    func addDays(_ day: String, _ n: Int) -> String {
        guard let d = Self.date(day), let r = Calendar.current.date(byAdding: .day, value: n, to: d) else { return day }
        return Self.day(r)
    }
    func daysBetween(_ a: String, _ b: String) -> Int {
        guard let x = Self.date(a), let y = Self.date(b) else { return 0 }
        return Int((y.timeIntervalSince(x) / 86400).rounded())
    }
    var weekday: Int { Calendar.current.component(.weekday, from: Date()) - 1 } // 0 = Sunday

    // MARK: Age, stage, size

    var ageWeeks: Int? {
        guard let b = dog?.birth else { return nil }
        return max(0, daysBetween(b, today) / 7)
    }
    var stage: String {
        guard let w = ageWeeks else { return "adult" }
        let giant = dog?.size == "g"
        if w < 16 { return "puppy" }
        if w < 26 { return "juvenile" }
        if w < (giant ? 104 : 78) { return "adolescent" }
        if w >= (giant ? 6 : 8) * 52 { return "senior" }
        return "adult"
    }
    // Growth plates close later in bigger dogs (general guidance; the vet confirms). Until then: no long hard-ground retrieves.
    static let plates: [String: Int] = ["s": 43, "m": 56, "l": 70, "g": 90]
    var platesClosed: Bool { ageWeeks.map { $0 >= Self.plates[dog?.size ?? "l"] ?? 70 } ?? true }
    var platesMonths: Int { Int((Double(Self.plates[dog?.size ?? "l"] ?? 70) / 4.35).rounded()) }
    func hasGoal(_ g: String) -> Bool { dog?.goals.contains(g) ?? false }
    var fieldGoal: Bool { hasGoal("waterfowl") || hasGoal("upland") }

    // MARK: Skills and levels

    func prog(_ id: String) -> SkillProgress { st.progress[id] ?? SkillProgress() }
    func updateProg(_ id: String, _ change: (inout SkillProgress) -> Void) {
        var p = prog(id); change(&p); st.progress[id] = p
    }
    func started(_ id: String) -> Bool {
        guard let p = st.progress[id] else { return false }
        return p.step > 0 || !p.reps.isEmpty || p.last != nil
    }
    func best(_ id: String, _ d: String) -> Int { prog(id).best[d] ?? 0 }
    /// Puppies under 16 weeks hold for 10 s at most.
    func cap(_ s: Skill, _ d: String) -> Int {
        guard d == "dur", stage == "puppy" else { return s.top(d) }
        return max(0, (s.proof?.dur ?? []).filter { $0.v <= 10 }.count - 1)
    }

    /// 0 Learning, 1 Fluent, 2 Proofed, 3 Reliable, 4 Maintained.
    func level(_ id: String) -> Int {
        guard let s = Catalog.skill(id), let p = st.progress[id], p.done else { return 0 }
        if s.dims.contains(where: { best(id, $0) < s.top($0) }) { return 1 }
        if p.places.count < 3 || p.rdays.count < 3 { return 2 }
        return p.reviews > 0 ? 4 : 3
    }

    // Sound ladder: each sound at 10 steps; 2 relaxed sessions to climb steps 1-4, 3 after; a startle drops 2.
    func sound(_ id: String) -> SoundState { st.sound[id] ?? SoundState() }
    func updateSound(_ id: String, _ change: (inout SoundState) -> Void) { var s = sound(id); change(&s); st.sound[id] = s }
    func recentStartle(_ id: String) -> Bool { sound(id).log.suffix(3).contains { $0.r == "startled" } }
    var soundCap: Int { stage == "puppy" ? 5 : 10 }
    func calmNeed(_ s: SoundState) -> Int { s.level < 4 ? 2 : 3 }
    static func ladderVolume(_ step: Int) -> Float { Float(0.01 * pow(100, Double(max(1, step) - 1) / 9)) }

    func needMet(_ n: String) -> Bool {
        if n.contains("|") { return n.split(separator: "|").contains { needMet(String($0)) } }
        if n.hasPrefix("sound:") {
            let p = n.split(separator: ":").map(String.init)
            return sound(p[1]).level >= Int(p[2]) ?? 10 && !recentStartle(p[1])
        }
        let parts = n.split(whereSeparator: { $0 == "@" || $0 == ":" }).map(String.init)
        let id = parts[0]
        if id == "charge" { return st.charged }
        if n.contains("@") { return started(id) && (prog(id).step >= Int(parts[1]) ?? 0 || level(id) >= 1) }
        let want = parts.count > 1 ? (Catalog.levels.firstIndex(where: { $0.lowercased() == parts[1] }) ?? 1) : 1
        return level(id) >= want
    }
    func needText(_ n: String) -> String {
        if n.contains("|") { return n.split(separator: "|").map { needText(String($0)) }.joined(separator: " or ") }
        if n.hasPrefix("sound:") {
            let p = n.split(separator: ":").map(String.init)
            let name = (Catalog.sounds.first { $0.id == p[1] }?.name ?? p[1]).lowercased()
            return sound(p[1]).level >= Int(p[2]) ?? 10 ? "3 calm \(name) sessions since the last startle" : "the \(name) sound ladder to step \(p[2])"
        }
        let parts = n.split(whereSeparator: { $0 == "@" || $0 == ":" }).map(String.init)
        if parts[0] == "charge" { return "Charge Yes" }
        let name = Catalog.any(parts[0]).name
        if n.contains("@") { return "\(name) to step \((Int(parts[1]) ?? 0) + 1)" }
        return "\(name) to \(parts.count > 1 ? parts[1].capitalized : "Fluent")"
    }
    /// A startle relocks gun work even after it was started, until the gunshot ladder is calm again.
    func isOpen(_ id: String) -> Bool {
        (started(id) && !(id == "gun" && recentStartle("gun"))) || Catalog.any(id).needs.allSatisfy(needMet)
    }
    func lockText(_ id: String) -> String {
        "Opens after " + Catalog.any(id).needs.filter { !needMet($0) }.map(needText).joined(separator: " and ")
    }
    func wantsTrack(_ s: Skill) -> Bool {
        if let g = Catalog.track(s.track)?.goals { return g.contains(where: hasGoal) }
        if s.track != "puppy" { return true }
        return (ageWeeks.map { $0 < 30 } ?? false) || hasGoal("puppy")
    }

    // MARK: Proofing

    /// Raise the dimension furthest from its target; ease the others one level below their best.
    func proofTarget(_ id: String) -> (raise: String?, lv: [String: Int])? {
        guard let s = Catalog.skill(id), !s.dims.isEmpty else { return nil }
        var lv: [String: Int] = [:]
        let open = s.dims.filter { best(id, $0) < cap(s, $0) }
        if open.isEmpty { for d in s.dims { lv[d] = best(id, d) }; return (nil, lv) }
        let raise = open.min(by: { Double(best(id, $0)) / Double(max(1, s.top($0))) < Double(best(id, $1)) / Double(max(1, s.top($1))) }) ?? open[0]
        for d in s.dims { lv[d] = d == raise ? best(id, d) + 1 : max(0, best(id, d) - 1) }
        return (raise, lv)
    }
    func bestLevels(_ id: String) -> [String: Int] {
        var lv: [String: Int] = [:]
        for d in Catalog.any(id).dims { lv[d] = best(id, d) }
        return lv
    }
    func describe(_ s: Skill, _ lv: [String: Int]) -> String { s.dims.map { s.label($0, lv[$0] ?? 0) }.joined(separator: " · ") }

    /// One plain sentence on what moves the ring next.
    func nextText(_ id: String) -> String {
        if let snd = Catalog.sound(id) {
            let sd = sound(snd.id)
            if sd.level >= soundCap { return sd.level >= 10 ? "Top of the ladder. A short refresher now and then keeps it there." : "Step \(sd.level) is the puppy limit; the rest waits until 16 weeks." }
            return "Step \(sd.level + 1) of 10 next. Up a step after \(calmNeed(sd)) relaxed sessions\(sd.calm > 0 ? " (\(sd.calm) so far)" : "")."
        }
        let s = Catalog.any(id), p = prog(id), lv = level(id)
        if !isOpen(id) { return lockText(id) + "." }
        if s.steps.isEmpty { return s.goal }
        if lv == 0 { return "Step \(p.step + 1) of \(s.steps.count): \(s.steps[p.step].t). Fluent after the last step is passed on 2 different days." }
        if lv == 1 { if let t = proofTarget(id), t.raise != nil { return "Next proofing level: \(describe(s, t.lv))." }; return "Proofing waits until \(dogName) is older." }
        if lv == 2 {
            let n = max(0, 3 - p.places.count), d = max(0, 3 - p.rdays.count)
            let parts = [n > 0 ? "in \(n) more kind\(n > 1 ? "s" : "") of place" : nil, d > 0 ? "on \(d) more day\(d > 1 ? "s" : "")" : nil].compactMap { $0 }
            return "Pass it \(parts.joined(separator: ", ")) to be Reliable."
        }
        guard let due = p.reviewDue else { return "Kept fresh with reviews." }
        if due <= today { return "Next review is due now." }
        let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("MMM d")
        return "Next review on \(Self.date(due).map { f.string(from: $0) } ?? due)."
    }

    // MARK: Places, reviews, the week

    static let reviewLadder = [2, 5, 10, 21, 45, 90]
    /// Returns true when this pass made the skill Reliable.
    @discardableResult
    func logPlace(_ id: String) -> Bool {
        let before = level(id)
        updateProg(id) { p in
            p.places[st.place, default: 0] += 1
            if !p.rdays.contains(today) { p.rdays.append(today) }
        }
        if before < 3 && level(id) >= 3 && prog(id).reviewDue == nil {
            updateProg(id) { $0.interval = 2; $0.reviewDue = addDays(today, 2) }
            return true
        }
        return false
    }
    func reviewResult(_ id: String, _ pass: Bool) -> String {
        st.reviews.append(ReviewLog(day: today, pass: pass)); st.reviews = Array(st.reviews.suffix(60))
        var result = pass ? "pass" : "fail"
        updateProg(id) { p in
            if pass {
                p.reviews += 1; p.fails = 0
                let i = Self.reviewLadder.firstIndex(of: p.interval) ?? -1
                p.interval = Self.reviewLadder[min(Self.reviewLadder.count - 1, i + 1)]
            } else {
                p.fails += 1
                p.interval = max(1, Int((Double(max(p.interval, 2)) / 3).rounded()))
                if p.fails >= 2 { p.places = [:]; p.rdays = []; p.reviews = 0; p.interval = 0; p.reviewDue = nil; p.fails = 0; result = "drop"; return }
            }
            p.reviewDue = addDays(today, p.interval)
        }
        return result
    }
    /// A hard week: review pass rate under 60% over the last 7 days (3+ reviews). Lifts as passes come back.
    var hardWeek: Bool {
        let since = addDays(today, -7), r = st.reviews.filter { $0.day >= since }
        return r.count >= 3 && Double(r.filter(\.pass).count) / Double(r.count) < 0.6
    }
    var tired: Bool { st.ratings.count >= 3 && st.ratings.suffix(3).allSatisfy { $0 == "tired" } }
    var trainingDay: Bool { guard let d = dog, !d.days.isEmpty else { return true }; return d.days.contains(weekday) }

    // MARK: Planner

    static let fieldTracks = ["field", "waterfowl", "upland"]
    static let roleNames = ["warm": "Warm-up", "main": "Main", "new": "New", "finish": "Finish", "review": "Review", "only": "Skill", "sound": "Sounds", "break": "Rest"]
    func placeOK(_ s: Skill) -> Bool { s.places.map { $0.contains(st.place) } ?? true }

    func score(_ s: Skill) -> Double {
        let id = s.id, p = st.progress[id], lv = level(id)
        let due = p?.reviewDue.map { $0 <= today } ?? false
        var v: Double = due ? 100 : lv == 0 ? (started(id) ? 80 : 40) : lv == 1 ? 60 : lv == 2 ? 50 + ((p?.places[st.place] ?? 0) > 0 ? 0 : 20) : 10
        v += 15 * (Catalog.track(s.track)?.goals != nil || hasGoal(s.track) ? 1 : 0.3)
        // Field skills come first when you're out in a field or at the water.
        if ["field", "water"].contains(st.place), let pl = s.places, !pl.contains("home") { v += 30 }
        // Milestones for an opening day within 5 months get a push.
        for (g, se) in Catalog.data.seasons {
            if let d = dog?.seasons[g], hasGoal(g), se.milestones.contains(id) {
                let left = daysBetween(today, d); if left >= 0 && left <= 150 { v += 25 }
            }
        }
        v += Double(min(25, 5 * Catalog.skills.filter { $0.needs.contains { $0.split(whereSeparator: { $0 == "@" || $0 == ":" }).first.map(String.init) == id } }.count))
        if due, let d = p?.reviewDue { v += Double(min(50, 10 * daysBetween(d, today))) }
        if p?.last == today { v -= 60 }
        return v
    }
    func kindFor(_ id: String) -> String {
        if let due = st.progress[id]?.reviewDue, due <= today { return "review" }
        switch level(id) { case 0: return "learn"; case 1: return "proof"; default: return "practice" }
    }

    /// The day's sound-ladder block: gunfire for bird-dog goals, household sounds for puppies. Once a day; a day off after a startle.
    func soundPick() -> String? {
        func done(_ id: String) -> Bool { sound(id).log.contains { $0.day == today } }
        func shaken(_ id: String) -> Bool { guard let l = sound(id).log.last else { return false }; return l.r == "startled" && l.day == addDays(today, -1) }
        var id: String? = nil
        if fieldGoal && sound("gun").level < soundCap { id = "gun" }
        else if (ageWeeks.map { $0 < 20 } ?? false) || hasGoal("puppy") {
            id = ["doorbell", "traffic", "thunder", "fireworks"].filter { sound($0).level < soundCap }.min { sound($0).level < sound($1).level }
        }
        guard let pick = id, !done(pick), !shaken(pick) else { return nil }
        return pick
    }
    var isFieldDay: Bool { dog?.fieldDay != nil && dog?.fieldDay == weekday }

    /// A field day out at the field or water: obedience warm-up, then up to 4 field blocks (2 when hot) with breaks between.
    func fieldPlan(_ ranked: [Skill], hot: Bool) -> [PlanBlock] {
        var blocks: [PlanBlock] = [], used = Set<String>(), fresh = 0
        if let w = ranked.first(where: { !Self.fieldTracks.contains($0.track) && level($0.id) >= 1 }) { used.insert(w.id); blocks.append(PlanBlock(id: w.id, kind: "practice", role: "warm")) }
        for s in ranked where Self.fieldTracks.contains(s.track) && !used.contains(s.id) {
            let isNew = !started(s.id) && level(s.id) == 0
            if isNew && fresh >= 1 { continue }
            if blocks.contains(where: { $0.role == "main" || $0.role == "new" }) { blocks.append(PlanBlock(id: "break", kind: "break", role: "break", secs: hot ? 180 : 120)) }
            used.insert(s.id); fresh += isNew ? 1 : 0
            blocks.append(PlanBlock(id: s.id, kind: isNew ? "learn" : kindFor(s.id), role: isNew ? "new" : "main"))
            if blocks.filter({ $0.role == "main" || $0.role == "new" }).count >= (hot ? 2 : 4) { break }
        }
        return blocks
    }

    func buildPlan(short: Bool = false, avoid: [String] = [], field: Bool = false) -> DayPlan {
        if !st.charged { return DayPlan(day: today, place: st.place, blocks: [PlanBlock(id: "charge", kind: "charge", role: "only")]) }
        let short = short || tired, hard = hardWeek, hot = st.hot == today
        // Gun work pauses after any startle until the gunshot ladder has 3 calm sessions again.
        let pool = Catalog.skills.filter { isOpen($0.id) && placeOK($0) && wantsTrack($0) && !($0.id == "gun" && recentStartle("gun")) }
        let ranked = pool.map { ($0, score($0) - (avoid.contains($0.id) ? 200 : 0)) }.sorted { $0.1 > $1.1 }.map(\.0)
        var blocks: [PlanBlock] = [], used = Set<String>()
        // Warm-ups and finishes run at the dog's best level; only main blocks raise the bar.
        func add(_ id: String, _ role: String) {
            used.insert(id)
            let kind = role == "new" ? "learn" : (role == "warm" || role == "finish") ? (level(id) > 0 ? "practice" : "learn") : kindFor(id)
            blocks.append(PlanBlock(id: id, kind: kind, role: role))
        }
        let working = ranked.filter { started($0.id) || level($0.id) > 0 }
        // A rest day keeps one light review; a dog with nothing under way yet just gets an optional normal session.
        let rest = !trainingDay && !working.isEmpty, offDay = !trainingDay
        let learning = working.filter { level($0.id) == 0 }.count
        if !rest && !short && fieldGoal && ["field", "water", "park"].contains(st.place) && (isFieldDay || field) {
            let fb = fieldPlan(ranked, hot: hot)
            if fb.contains(where: { $0.role == "main" || $0.role == "new" }) {
                var p = DayPlan(day: today, place: st.place, blocks: fb); p.field = true; p.hot = hot; p.hard = hard; return p
            }
        }
        if !rest && !short, let snd = soundPick() { blocks.append(PlanBlock(id: "snd:" + snd, kind: "sound", role: "sound")) }
        // A skill due for review is never spent as a warm-up, and a short or rest-day session has none.
        let warm = rest || short ? nil : working.filter { level($0.id) >= 1 && $0.id != "mat" && kindFor($0.id) != "review" }.max { level($0.id) < level($1.id) }
        let mains = Array(working.filter { $0.id != warm?.id }.prefix(rest || short ? 1 : 2))
        if let w = warm, !mains.isEmpty { add(w.id, "warm") }
        for s in mains { add(s.id, kindFor(s.id) == "review" ? "review" : "main") }
        // New: one at most, never more than 3 skills in Learning, none in a hard week or on a rest day.
        if !rest && !hard && learning < 3 && blocks.count < 4, let fresh = ranked.first(where: { !started($0.id) && level($0.id) == 0 && !used.contains($0.id) }) { add(fresh.id, "new") }
        // Finish calm, once Mat and settle is known.
        if !rest && level("mat") >= 1 && !used.contains("mat"), let mat = Catalog.skill("mat"), placeOK(mat) { add("mat", "finish") }
        if blocks.isEmpty, let any = ranked.first(where: { !used.contains($0.id) }) { add(any.id, started(any.id) ? "main" : "new") }
        var p = DayPlan(day: today, place: st.place, blocks: blocks)
        p.rest = rest; p.offDay = offDay; p.hard = hard; p.hot = hot
        return p
    }
    var plan: DayPlan {
        if let p = st.plan, p.day == today, p.place == st.place, !(p.blocks.first?.id == "charge" && st.charged) { return p }
        return buildPlan()
    }
    func refreshPlan(force: Bool = false, short: Bool = false, avoid: [String] = [], field: Bool = false) {
        let cur = st.plan
        if force || cur == nil || cur?.day != today || cur?.place != st.place || (cur?.blocks.first?.id == "charge" && st.charged) {
            st.plan = buildPlan(short: short, avoid: avoid, field: field)
        }
    }
    func blockLine(_ b: PlanBlock) -> String {
        let s = Catalog.any(b.id)
        switch b.kind {
        case "charge": return "20 treats at random moments. Teaches that Yes means food."
        case "sound": return "Step \(min(10, sound(String(b.id.dropFirst(4))).level + 1)) of 10 · 5 plays, a treat right after each"
        case "break": return "\((b.secs ?? 120) / 60) minutes of water and shade"
        case "learn": let step = prog(b.id).step; return "Step \(step + 1) of \(s.steps.count): \(s.steps[step].t)"
        case "proof": if let t = proofTarget(b.id), t.raise != nil { return describe(s, t.lv) }; return "At their best level"
        case "review": return "Quick check: one round"
        default: return s.dims.isEmpty ? "One round" : describe(s, bestLevels(b.id))
        }
    }
    func planMinutes(_ p: DayPlan) -> Int {
        Int(p.blocks.reduce(0.0) { a, b in
            a + (b.kind == "break" ? Double(b.secs ?? 120) / 60 : Self.fieldTracks.contains(Catalog.any(b.id).track) ? 5 : b.kind == "learn" ? 3 : 2)
        }.rounded())
    }
    func planGear(_ p: DayPlan) -> [String] {
        var g: [String] = p.field ? ["water and a bowl"] : []
        for b in p.blocks { for x in Catalog.any(b.id).gear ?? [] where !g.contains(x) { g.append(x) } }
        return g
    }

    // MARK: Seasons

    struct SeasonInfo { let name: String; let pct: Int; let left: [String]; let days: Int; let behind: Bool }
    func seasonInfo(_ g: String) -> SeasonInfo? {
        guard let se = Catalog.data.seasons[g], let date = dog?.seasons[g], hasGoal(g) else { return nil }
        var total = 0.0, left: [String] = []
        for id in se.milestones {
            let s = Catalog.any(id)
            if level(id) >= 1 { total += 1 } else { left.append(id); if started(id), !s.steps.isEmpty { total += 0.6 * Double(prog(id).step) / Double(s.steps.count) } }
        }
        let days = daysBetween(today, date)
        // About two weeks of short sessions per milestone is a realistic pace.
        return SeasonInfo(name: se.name, pct: Int((total / Double(se.milestones.count) * 100).rounded()), left: left, days: days, behind: left.count * 14 > days)
    }

    // MARK: Puppy tools

    var showPassport: Bool { (ageWeeks.map { $0 < 20 } ?? false) || hasGoal("puppy") }
    var passportCount: Int { st.passport.values.filter { $0.r == "happy" }.count }
    var passportTotal: Int { Catalog.data.passport.reduce(0) { $0 + $1.items.count } }
    func cyclePassport(_ key: String) {
        let order = [nil, "happy", "unsure", "scared"]
        let cur = st.passport[key]?.r
        let next = order[((order.firstIndex(of: cur) ?? 0) + 1) % order.count]
        st.passport[key] = next.map { PassportEntry(r: $0, day: today) }
    }
    var pottyOn: Bool { st.potty.on ?? (ageWeeks.map { $0 < 26 } ?? false) }
    var pottyMinutes: Int {
        let months = Double(ageWeeks ?? 26) / 4.35
        return max(60, min(480, Int(((months + 1) * 60).rounded()) + st.potty.offset))
    }
    var pottyText: String {
        guard let last = st.potty.last else { return "Take them out after waking, eating and play, and every \(String(format: "%.1f", Double(pottyMinutes) / 60)) hours." }
        let due = last.addingTimeInterval(Double(pottyMinutes) * 60), mins = Int(due.timeIntervalSinceNow / 60)
        let at = due.formatted(date: .omitted, time: .shortened)
        return mins <= 0 ? "Potty trip due now (was \(at)). Also after waking, eating and play." : "Next trip by \(at) (in \(mins) min). Also after waking, eating and play."
    }
    func potty(_ ok: Bool) {
        st.potty.on = true
        st.potty.log.append(PottyLog(t: Date(), ok: ok)); st.potty.log = Array(st.potty.log.suffix(40)); st.potty.last = Date()
        if ok {
            // Five clean trips in a row stretch the interval a little.
            if st.potty.log.suffix(5).count == 5 && st.potty.log.suffix(5).allSatisfy(\.ok) { st.potty.offset = min(120, st.potty.offset + 10) }
            toast("Logged. Praise and a treat outside, right as they finish.")
        } else {
            st.potty.offset = max(-60, st.potty.offset - 15)
            toast("No scolding. Clean with an enzyme cleaner; trips come a little sooner now.")
        }
    }

    // MARK: Feedback, toast, recall

    func feedback() {
        if root.settings.haptic { haptics.tap() }
        if root.settings.flash { flashTick += 1 }
    }
    func recall() {
        audio.play(.recall)
        feedback()
        toast("Recall played. Jackpot when they arrive!")
    }
    func toast(_ text: String) {
        toastText = text
        toastTask?.cancel()
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_800_000_000)
            if !Task.isCancelled { self?.toastText = nil }
        }
    }
    func becameActive() {
        audio.ensureRunning()
        bluetooth = audio.outputIsBluetooth
        objectWillChange.send()
    }
    var treatsUsedToday: Int { st.treatsDay == today ? st.treatsUsed : 0 }
    func useTreat() {
        if st.treatsDay != today { st.treatsDay = today; st.treatsUsed = 0 }
        st.treatsUsed += 1
    }

    // MARK: Your data

    func backupData() -> Data { (try? JSONEncoder.app.encode(Backup(root: root))) ?? Data() }
    enum RestoreError: Error { case notABackup }
    func restore(_ data: Data) throws {
        guard let b = try? JSONDecoder.app.decode(Backup.self, from: data), b.app == "pocket-trainer", b.root.version >= 2 else { throw RestoreError.notABackup }
        var r = b.root
        for k in r.states.keys { r.states[k]?.sanitize(); r.states[k]?.live = nil }
        run = nil; coach = nil
        root = r
        audio.volume = Float(r.settings.volume)
    }
    func eraseAll() {
        run = nil; coach = nil
        var r = SavedRoot(); r.guideSeen = true
        root = r
        audio.clearCustom(); audio.volume = 0.8
        Recorder.eraseAll()
    }

    #if DEBUG
    /// Sample data for screenshots: launch with -demo.
    static func demoRoot() -> SavedRoot {
        var r = SavedRoot()
        var d = Dog(); d.name = "Duke"; d.breed = "Labrador Retriever"; d.drive = "retrieve"; d.size = "l"
        d.birth = AppModel.day(Date().addingTimeInterval(-86400 * 700)); d.goals = ["foundations", "waterfowl"]
        d.days = [0, 1, 2, 3, 4, 5, 6]; d.seasons = ["waterfowl": AppModel.day(Date().addingTimeInterval(86400 * 52))]
        var st = DogState(); st.charged = true
        func done(_ step: Int, _ best: [String: Int] = [:]) -> SkillProgress { var p = SkillProgress(); p.step = step; p.done = true; p.passDays = ["a", "b"]; p.best = best; return p }
        st.progress["sit"] = done(6); st.progress["name"] = done(4); st.progress["down"] = done(5)
        st.progress["stay"] = done(5, ["dur": 2, "dist": 1, "dis": 0])
        st.progress["come"] = done(4, ["dist": 4, "dis": 4]); st.progress["come"]?.places = ["home": 1, "yard": 1, "park": 1]
        st.progress["come"]?.rdays = ["a", "b", "c"]; st.progress["come"]?.reviews = 2; st.progress["come"]?.interval = 10
        var ret = SkillProgress(); ret.step = 2; ret.last = "2026-01-01"; st.progress["retrieve"] = ret
        st.days = [AppModel.day()]
        r.dogs = [d]; r.active = d.id; r.states[d.id] = st; r.guideSeen = true
        return r
    }
    #endif
}

struct FinishedSession: Identifiable {
    let id = UUID()
    let secs: Int
    let marks: Int
    let rows: [(id: String, name: String, before: Int, after: Int, hits: Int, tries: Int, next: String)]
    let field: Bool
}

extension JSONEncoder {
    static var app: JSONEncoder { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }
}

extension JSONDecoder {
    static var app: JSONDecoder { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }
}

func clock(_ secs: Int) -> String { String(format: "%d:%02d", secs / 60, secs % 60) }
