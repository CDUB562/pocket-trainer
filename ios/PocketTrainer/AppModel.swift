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

struct Session {
    var start = Date()
    var marks = 0
    var module: String
}

enum Route: Identifiable, Equatable {
    case training(String), charge
    var id: String {
        switch self {
        case .training(let m): return "training-" + m
        case .charge: return "charge"
        }
    }
}

@MainActor
final class Haptics {
    private let gen = UIImpactFeedbackGenerator(style: .rigid)
    init() { gen.prepare() }
    func tap() { gen.impactOccurred(); gen.prepare() }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var state: SavedState { didSet { if state != oldValue { save() } } }
    @Published var session: Session?
    @Published var coach: Coach?
    @Published var holdEnd: Date?
    @Published var route: Route?
    @Published var showGuide = false
    @Published var toastText: String?
    @Published var flashTick = 0
    @Published var bluetooth = false

    let audio = MarkerAudio.shared
    let recorder = Recorder()
    private let haptics = Haptics()
    private var holdTask: Task<Void, Never>?
    private var toastTask: Task<Void, Never>?
    private let fileURL: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("state.json")
        var s = (try? Data(contentsOf: fileURL)).flatMap { try? JSONDecoder.app.decode(SavedState.self, from: $0) } ?? SavedState()
        s.sanitize()
        state = s
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-demo") {
            state.settings.dog = "Milo"; state.dogAsked = true; state.guideSeen = true; state.charged = true; state.seen = ["sit:2"]
            state.progress["sit"] = { var p = Progress(); p.step = 2; p.reps = [true, true, false]; p.last = "2026-01-01"; return p }()
            state.plan = nil
        }
        #endif
        audio.volume = Float(state.settings.volume)
        showGuide = !state.guideSeen
        recoverLive()
        refreshPlan()
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

    private func save() {
        guard let data = try? JSONEncoder.app.encode(state) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    // MARK: Days and plan

    /// The phone's local calendar day, so an evening session counts for today.
    static func day(_ d: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }
    var today: String { Self.day() }

    func prog(_ id: String) -> Progress { state.progress[id] ?? Progress() }
    func updateProg(_ id: String, _ change: (inout Progress) -> Void) {
        var p = prog(id)
        change(&p)
        state.progress[id] = p
    }
    func started(_ id: String) -> Bool {
        guard let p = state.progress[id] else { return false }
        return p.step > 0 || !p.reps.isEmpty || p.last != nil
    }

    /// Up to 3 short sessions, picked once per day: Charge first, then skills in progress
    /// (longest since practice first), then new skills in order, at most one new one a day once two are under way.
    func refreshPlan() {
        if let p = state.plan, p.day == today { return }
        var items: [String] = []
        if !state.charged { items.append("charge") }
        let going = Catalog.modules.filter { started($0.id) && !prog($0.id).done }
            .sorted { (prog($0.id).last ?? "") < (prog($1.id).last ?? "") }
        for m in going where items.count < 3 { items.append(m.id) }
        var room = going.count >= 2 ? 1 : 3
        for id in Catalog.order {
            if items.count >= 3 || room <= 0 { break }
            let ready = id != "stay" || prog("sit").step >= 4 || prog("sit").done
            if !items.contains(id) && !started(id) && !prog(id).done && ready { items.append(id); room -= 1 }
        }
        state.plan = DayPlan(day: today, items: items, done: [])
    }

    func markPlanDone(_ id: String) {
        refreshPlan()
        guard var p = state.plan, p.items.contains(id), !p.done.contains(id) else { return }
        p.done.append(id)
        state.plan = p
    }

    func describe(_ id: String) -> (name: String, sub: String, mark: String) {
        if id == "charge" { return ("Charge Yes", "20 treats at random moments", "Teaches your dog that Yes means food. Do this before anything else.") }
        let m = Catalog.module(id), p = prog(id)
        guard !m.steps.isEmpty else { return (m.name, m.goal, "") }
        let s = m.steps[p.step]
        return (m.name, "Step \(p.step + 1) of \(m.steps.count): \(s.title)", "Mark when " + s.mark)
    }

    func start(_ id: String) {
        coach = nil
        route = id == "charge" ? .charge : .training(id)
    }

    // MARK: Training

    var currentModule: Module? {
        if case .training(let id) = route { return Catalog.module(id) }
        return nil
    }
    var currentStep: Step? {
        guard let m = currentModule, !m.steps.isEmpty else { return nil }
        return m.steps[prog(m.id).step]
    }

    /// True the first time a step is opened, so its how-to shows before any training starts.
    func firstVisit(_ key: String) -> Bool {
        if state.seen.contains(key) { return false }
        state.seen.append(key)
        return true
    }

    func setStep(_ n: Int) {
        guard let m = currentModule, !m.steps.isEmpty else { return }
        cancelHold()
        updateProg(m.id) { p in p.step = min(max(0, n), m.steps.count - 1); p.reps = [] }
    }

    func resetSkill() {
        guard let m = currentModule else { return }
        cancelHold()
        coach = nil
        state.progress[m.id] = Progress()
    }

    func mark(_ kind: MarkKind, at uptime: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        // Sound first: everything else can wait a few microseconds.
        switch kind {
        case .yes: audio.play(.yes)
        case .toss: audio.play(.toss)
        case .keep: audio.play(.keep)
        case .free: audio.play(.free)
        case .miss: break
        }
        feedback()
        recorder.addMark(kind.rawValue, at: uptime)
        if kind == .miss { cancelHold(); logRep(false); return }
        if kind == .free { cancelHold(); if session == nil { return } }
        if session == nil { startSession() }
        if kind == .yes || kind == .toss {
            cancelHold()
            session?.marks += 1
            useTreat()
            logRep(true)
        }
        saveLive()
    }

    func recall() {
        audio.play(.recall)
        feedback()
        if state.recallDay != today { state.recallDay = today; state.recallCount = 0 }
        state.recallCount += 1
        toast("Recall played. Jackpot when they arrive!")
    }

    func feedback() {
        if state.settings.haptic { haptics.tap() }
        if state.settings.flash { flashTick += 1 }
    }

    private func useTreat() {
        if state.treatsDay != today { state.treatsDay = today; state.treatsUsed = 0 }
        state.treatsUsed += 1
    }
    var treatsUsedToday: Int { state.treatsDay == today ? state.treatsUsed : 0 }

    /// Push / stick / drop: after every 5 tries, 4-5 right = harder, 3 = stay, 0-2 = easier.
    private func logRep(_ ok: Bool) {
        guard let m = currentModule, !m.steps.isEmpty else { return }
        updateProg(m.id) { $0.reps.append(ok) }
        let p = prog(m.id), r = p.reps
        if !ok && r.count >= 2 && !r[r.count - 2] && r.count % 5 != 0 {
            coach = Coach(text: "Two misses in a row. Make it easier for a few reps: closer, shorter, quieter room.", actions: [dismiss("OK")])
        }
        guard r.count >= 5, r.count % 5 == 0 else { return }
        let hits = r.suffix(5).filter { $0 }.count, last = p.step == m.steps.count - 1
        if hits >= 4 && last {
            // One good round can be luck: done means passing the final step on two different days.
            updateProg(m.id) { q in
                if !q.passDays.contains(self.today) { q.passDays.append(self.today) }
                q.done = q.passDays.count >= 2
            }
            let q = prog(m.id)
            let again = CoachAction(label: q.done ? "Keep practicing" : "OK", solid: !q.done) { [weak self] in
                self?.updateProg(m.id) { $0.reps = [] }
            }
            if q.done {
                coach = Coach(text: "\(hits) of 5 on the final step, on \(q.passDays.count) different days. Skill done. Use praise or life rewards some of the time now.",
                              actions: [CoachAction(label: "Finish", solid: true) { [weak self] in self?.closeTraining() }, again])
            } else {
                coach = Coach(text: "\(hits) of 5 on the final step. Pass it again on another day, ideally somewhere new, to finish the skill.", actions: [again])
            }
        } else if hits >= 4 {
            coach = Coach(text: "\(hits) of 5. Your dog has this step. Ready for the next one?", actions: [
                CoachAction(label: "Next step", solid: true) { [weak self] in self?.setStep(p.step + 1) }, dismiss("Stay here", solid: false),
            ])
        } else if hits == 3 {
            coach = Coach(text: "3 of 5. Stay on this step for another round.", actions: [dismiss("OK")])
        } else if p.step > 0 {
            coach = Coach(text: "\(hits) of 5. Too hard right now. Go back a step and build it up again.", actions: [
                CoachAction(label: "Easier step", solid: true) { [weak self] in self?.setStep(p.step - 1) }, dismiss("Try again", solid: false),
            ])
        } else {
            coach = Coach(text: "\(hits) of 5. Make it easier: quieter room, closer, better treats. Is Yes charged?", actions: [dismiss("OK")])
        }
    }
    private func dismiss(_ label: String, solid: Bool = true) -> CoachAction { CoachAction(label: label, solid: solid) {} }

    /// Hold timer: picks a random target inside the step's range so the dog can't predict the end, then marks Yes.
    func toggleHold() {
        if holdEnd != nil { cancelHold(); return }
        guard let range = currentStep?.hold else { return }
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
    func cancelHold() {
        holdTask?.cancel()
        holdTask = nil
        holdEnd = nil
    }

    // MARK: Sessions

    private func startSession() {
        session = Session(module: currentModule?.id ?? "free")
    }

    private func saveLive() {
        guard let s = session else { return }
        state.live = LiveSession(start: s.start, at: Date(), marks: s.marks, module: s.module)
    }

    @discardableResult
    private func fileSession(module: String, start: Date, secs: Int, marks: Int, video: String?) -> Summary {
        state.history.insert(HistoryEntry(at: start.addingTimeInterval(Double(secs)), secs: secs, marks: marks, module: module), at: 0)
        if state.history.count > 100 { state.history.removeLast(state.history.count - 100) }
        let isSkill = Catalog.isSkill(module)
        if isSkill { updateProg(module) { $0.last = self.today } }
        if marks >= 5 { markPlanDone(module) }
        let lastRound = isSkill ? Array(prog(module).reps.suffix(5)) : []
        let summary = Summary(
            title: Catalog.module(module).name, secs: secs, marks: marks,
            rate: secs >= 20 ? Int((Double(marks) / (Double(secs) / 60)).rounded()) : nil,
            round: lastRound.isEmpty ? "" : "\(lastRound.filter { $0 }.count) of \(lastRound.count) right in the last round",
            treats: "\(treatsUsedToday) of \(state.settings.budget) treats used today", video: video)
        state.last = summary
        return summary
    }

    /// A session cut off by iOS closing the app is filed on the next launch.
    private func recoverLive() {
        guard let s = state.live else { return }
        state.live = nil
        if s.marks > 0 { fileSession(module: s.module, start: s.start, secs: max(1, Int(s.at.timeIntervalSince(s.start))), marks: s.marks, video: nil) }
    }

    func endSession() {
        let video = recorder.sessionVideo
        recorder.stop()
        recorder.sessionVideo = nil
        guard let s = session else { return }
        let secs = Int(Date().timeIntervalSince(s.start).rounded())
        if s.marks > 0 { fileSession(module: s.module, start: s.start, secs: secs, marks: s.marks, video: video) }
        state.live = nil
        session = nil
    }

    func closeTraining() {
        cancelHold()
        endSession()
        coach = nil
        route = nil
    }

    func becameActive() {
        refreshPlan()
        audio.ensureRunning()
        bluetooth = audio.outputIsBluetooth
    }

    // MARK: Recording

    @Published var cameraDenied = false
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

    // MARK: Toast

    func toast(_ text: String) {
        toastText = text
        toastTask?.cancel()
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_800_000_000)
            if !Task.isCancelled { self?.toastText = nil }
        }
    }

    // MARK: Your data

    func backupData() -> Data {
        (try? JSONEncoder.app.encode(Backup(state: state))) ?? Data()
    }

    enum RestoreError: Error { case notABackup }
    func restore(_ data: Data) throws {
        guard let b = try? JSONDecoder.app.decode(Backup.self, from: data), b.app == "pocket-trainer" else { throw RestoreError.notABackup }
        var s = b.state
        s.sanitize()
        s.live = nil
        session = nil
        state = s
        audio.volume = Float(s.settings.volume)
        refreshPlan()
    }

    func eraseAll() {
        session = nil
        coach = nil
        state = SavedState()
        state.guideSeen = true
        audio.clearCustom()
        audio.volume = 0.8
        Recorder.eraseAll()
        refreshPlan()
    }
}

extension JSONEncoder {
    static var app: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }
}

extension JSONDecoder {
    static var app: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }
}

func clock(_ secs: Int) -> String { String(format: "%d:%02d", secs / 60, secs % 60) }
