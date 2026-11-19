import Foundation

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

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        volume = min(1, max(0.1, c.value(.volume, 0.8)))
        haptic = c.value(.haptic, true)
        flash = c.value(.flash, false)
        budget = max(0, c.value(.budget, 60))
    }
}

struct Dog: Codable, Equatable, Identifiable {
    var id = "d" + UUID().uuidString.prefix(8).lowercased()
    var name = ""
    var birth: String? = nil          // yyyy-MM-dd
    var breed: String? = nil
    var drive: String? = nil
    var size: String? = nil           // s m l g
    var flat = false
    var goals: [String] = ["foundations"]
    var reward: String? = "food"
    var days: [Int] = [1, 2, 4, 6]    // 0 = Sunday, as on the web
    var fieldDay: Int? = nil
    var seasons: [String: String] = [:]
    var legacy = false

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.value(.id, "d" + UUID().uuidString.prefix(8).lowercased())
        name = c.value(.name, "")
        birth = c.value(.birth, nil as String?)
        breed = c.value(.breed, nil as String?)
        drive = c.value(.drive, nil as String?)
        size = c.value(.size, nil as String?)
        flat = c.value(.flat, false)
        goals = c.value(.goals, ["foundations"])
        reward = c.value(.reward, "food" as String?)
        days = c.value(.days, [1, 2, 4, 6])
        fieldDay = c.value(.fieldDay, nil as Int?)
        seasons = c.value(.seasons, [:])
        legacy = c.value(.legacy, false)
    }
}

/// Where a dog is on one skill.
struct SkillProgress: Codable, Equatable {
    var step = 0
    var reps: [Bool] = []
    var done = false                  // Fluent: the final step passed on 2 different days
    var passDays: [String] = []
    var last: String? = nil
    var best: [String: Int] = [:]     // proofing: best level reached per dimension
    var places: [String: Int] = [:]   // passes per kind of place, once Proofed
    var rdays: [String] = []          // days with a pass, once Proofed
    var reviews = 0
    var interval = 0
    var reviewDue: String? = nil
    var fails = 0

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        step = c.value(.step, 0); reps = c.value(.reps, []); done = c.value(.done, false)
        passDays = c.value(.passDays, []); last = c.value(.last, nil as String?)
        best = c.value(.best, [:]); places = c.value(.places, [:]); rdays = c.value(.rdays, [])
        reviews = c.value(.reviews, 0); interval = c.value(.interval, 0)
        reviewDue = c.value(.reviewDue, nil as String?); fails = c.value(.fails, 0)
    }
}

struct SoundLog: Codable, Equatable { var day: String; var r: String }
struct SoundState: Codable, Equatable {
    var level = 0
    var calm = 0
    var log: [SoundLog] = []
    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        level = c.value(.level, 0); calm = c.value(.calm, 0); log = c.value(.log, [])
    }
}

struct PlanBlock: Codable, Equatable {
    var id: String
    var kind: String                  // learn proof review practice sound break charge free
    var role: String                  // warm main new finish review sound break only
    var secs: Int? = nil
}

struct DayPlan: Codable, Equatable {
    var day: String
    var place: String
    var blocks: [PlanBlock]
    var done = false
    var rest = false
    var offDay = false
    var hard = false
    var hot = false
    var field = false
    init(day: String, place: String, blocks: [PlanBlock]) { self.day = day; self.place = place; self.blocks = blocks }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        day = c.value(.day, ""); place = c.value(.place, "home"); blocks = c.value(.blocks, [])
        done = c.value(.done, false); rest = c.value(.rest, false); offDay = c.value(.offDay, false)
        hard = c.value(.hard, false); hot = c.value(.hot, false); field = c.value(.field, false)
    }
}

struct HistoryEntry: Codable, Identifiable, Equatable {
    var id = UUID()
    var at: Date
    var secs: Int
    var marks: Int
    var blocks: [String]
    var rating: String? = nil
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

struct LiveSession: Codable, Equatable {
    var start: Date
    var at: Date
    var marks: Int
    var blocks: [String]
}

struct PassportEntry: Codable, Equatable { var r: String; var day: String }
struct PottyLog: Codable, Equatable { var t: Date; var ok: Bool }
struct Potty: Codable, Equatable {
    var on: Bool? = nil
    var last: Date? = nil
    var offset = 0
    var log: [PottyLog] = []
    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        on = c.value(.on, nil as Bool?); last = c.value(.last, nil as Date?); offset = c.value(.offset, 0); log = c.value(.log, [])
    }
}
struct ReviewLog: Codable, Equatable { var day: String; var pass: Bool }

/// One dog's training state.
struct DogState: Codable, Equatable {
    var progress: [String: SkillProgress] = [:]
    var plan: DayPlan? = nil
    var history: [HistoryEntry] = []
    var last: Summary? = nil
    var charged = false
    var seen: [String] = []
    var place = "home"
    var ratings: [String] = []
    var reviews: [ReviewLog] = []
    var days: [String] = []
    var passport: [String: PassportEntry] = [:]
    var potty = Potty()
    var treatsDay = ""
    var treatsUsed = 0
    var live: LiveSession? = nil
    var sound: [String: SoundState] = [:]
    var hot = ""

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        progress = c.value(.progress, [:]); plan = c.value(.plan, nil as DayPlan?); history = c.value(.history, [])
        last = c.value(.last, nil as Summary?); charged = c.value(.charged, false); seen = c.value(.seen, [])
        place = c.value(.place, "home"); ratings = c.value(.ratings, []); reviews = c.value(.reviews, [])
        days = c.value(.days, []); passport = c.value(.passport, [:]); potty = c.value(.potty, Potty())
        treatsDay = c.value(.treatsDay, ""); treatsUsed = c.value(.treatsUsed, 0); live = c.value(.live, nil as LiveSession?)
        sound = c.value(.sound, [:]); hot = c.value(.hot, "")
    }

    /// Clamp saved progress to the current step lists, so data from another version can never point past the end.
    mutating func sanitize() {
        for (id, p) in progress {
            guard let s = Catalog.skill(id) else { progress[id] = nil; continue }
            var q = p
            q.step = min(max(0, q.step), s.steps.count - 1)
            for (d, v) in q.best { if s.proof?.values(d).isEmpty ?? true { q.best[d] = nil } else { q.best[d] = min(v, s.top(d)) } }
            progress[id] = q
        }
        if !Catalog.places.contains(where: { $0.id == place }) { place = "home" }
        if history.count > 100 { history = Array(history.prefix(100)) }
    }
}

/// Everything saved: global settings, the dogs, and each dog's state.
struct SavedRoot: Codable, Equatable {
    var version = 2
    var settings = Settings()
    var dogs: [Dog] = []
    var active: String? = nil
    var states: [String: DogState] = [:]
    var guideSeen = false

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = c.value(.version, 2); settings = c.value(.settings, Settings()); dogs = c.value(.dogs, [])
        active = c.value(.active, nil as String?); states = c.value(.states, [:]); guideSeen = c.value(.guideSeen, false)
    }
}

/// The backup file: everything, plus a tag so a random JSON file is never mistaken for one.
struct Backup: Codable {
    var app = "pocket-trainer"
    var saved = Date()
    var root: SavedRoot
}
