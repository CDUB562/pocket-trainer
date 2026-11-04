import Foundation

struct Step: Hashable {
    let title: String
    let mark: String
    let setup: String
    let reward: String
    var hold: ClosedRange<Int>? = nil
    var keep: Bool = false
}

struct Module: Identifiable, Hashable {
    let id: String
    let name: String
    let goal: String
    let cue: String
    let steps: [Step]
}

enum MarkKind: String {
    case yes, toss = "catch", keep, free, miss
}

// Saved data decodes leniently: a missing or unreadable field falls back to its default,
// so an older save file or a backup from another version always loads.
extension KeyedDecodingContainer {
    func value<T: Decodable>(_ key: Key, _ fallback: T) -> T {
        (try? decodeIfPresent(T.self, forKey: key)) ?? fallback
    }
}

struct Settings: Codable, Equatable {
    var volume: Double = 0.8
    var haptic = true
    var flash = false
    var budget = 60
    var dog = ""

    init() {}
    enum CodingKeys: String, CodingKey { case volume, haptic, flash, budget, dog }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        volume = min(1, max(0.1, c.value(.volume, 0.8)))
        haptic = c.value(.haptic, true)
        flash = c.value(.flash, false)
        budget = max(0, c.value(.budget, 60))
        dog = c.value(.dog, "")
    }
}

/// Where a dog is on one skill. reps holds the tries on the current step; done means the final step was passed on two different days.
struct Progress: Codable, Equatable {
    var step = 0
    var reps: [Bool] = []
    var done = false
    var passDays: [String] = []
    var last: String? = nil

    init() {}
    enum CodingKeys: String, CodingKey { case step, reps, done, passDays, last }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        step = c.value(.step, 0)
        reps = c.value(.reps, [])
        done = c.value(.done, false)
        passDays = c.value(.passDays, [])
        last = c.value(.last, nil as String?)
    }
}

struct DayPlan: Codable, Equatable {
    var day: String
    var items: [String]
    var done: [String]
}

struct HistoryEntry: Codable, Identifiable, Equatable {
    var id = UUID()
    var at: Date
    var secs: Int
    var marks: Int
    var module: String
}

struct Summary: Codable, Equatable {
    var title: String
    var secs: Int
    var marks: Int
    var rate: Int?
    var round: String
    var treats: String
    var video: String?
}

/// The session in progress, saved on every mark: iOS can close a backgrounded app without warning.
struct LiveSession: Codable, Equatable {
    var start: Date
    var at: Date
    var marks: Int
    var module: String
}

struct SavedState: Codable, Equatable {
    var settings = Settings()
    var progress: [String: Progress] = [:]
    var plan: DayPlan? = nil
    var history: [HistoryEntry] = []
    var last: Summary? = nil
    var charged = false
    var seen: [String] = []
    var guideSeen = false
    var dogAsked = false
    var treatsDay = ""
    var treatsUsed = 0
    var recallDay = ""
    var recallCount = 0
    var live: LiveSession? = nil

    init() {}
    enum CodingKeys: String, CodingKey {
        case settings, progress, plan, history, last, charged, seen, guideSeen, dogAsked, treatsDay, treatsUsed, recallDay, recallCount, live
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        settings = c.value(.settings, Settings())
        progress = c.value(.progress, [:])
        plan = c.value(.plan, nil as DayPlan?)
        history = c.value(.history, [])
        last = c.value(.last, nil as Summary?)
        charged = c.value(.charged, false)
        seen = c.value(.seen, [])
        guideSeen = c.value(.guideSeen, false)
        dogAsked = c.value(.dogAsked, false)
        treatsDay = c.value(.treatsDay, "")
        treatsUsed = c.value(.treatsUsed, 0)
        recallDay = c.value(.recallDay, "")
        recallCount = c.value(.recallCount, 0)
        live = c.value(.live, nil as LiveSession?)
    }

    /// Clamp saved progress to the current step lists, so data from another version can never point past the end.
    mutating func sanitize() {
        for (id, p) in progress {
            guard Catalog.isSkill(id) else { progress[id] = nil; continue }
            var q = p
            q.step = min(max(0, q.step), Catalog.module(id).steps.count - 1)
            progress[id] = q
        }
        if history.count > 100 { history = Array(history.prefix(100)) }
    }
}

/// The backup file: the saved state plus a tag so a random JSON file is never mistaken for one.
struct Backup: Codable {
    var app = "pocket-trainer"
    var saved = Date()
    var state: SavedState
}
