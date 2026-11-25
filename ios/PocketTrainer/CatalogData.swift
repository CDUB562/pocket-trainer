import Foundation

// The skill catalog is shared with the web app: tools/gen_catalog.js exports src/catalog.js to Catalog.json.
// Edit the catalog there and rerun the generator; never edit Catalog.json by hand.

struct ProofValue: Codable, Hashable {
    let v: Double
    let t: String
}

struct Proof: Codable, Hashable {
    var dur: [ProofValue]?
    var dist: [ProofValue]?
    var dis: [ProofValue]?

    /// The dimensions this skill is proofed on, always in the order duration, distance, distraction.
    var dims: [String] { [("dur", dur), ("dist", dist), ("dis", dis)].compactMap { $0.1 == nil ? nil : $0.0 } }
    func values(_ d: String) -> [ProofValue] { d == "dur" ? dur ?? [] : d == "dist" ? dist ?? [] : dis ?? [] }
}

struct Step: Codable, Hashable {
    let t: String
    let mark: String
    let setup: String
    let reward: String
    let hold: [Int]?
    let keep: Bool?
}

struct Skill: Codable, Hashable, Identifiable {
    let id: String
    let track: String
    let name: String
    let goal: String
    let cue: String
    let proofMark: String?
    let needs: [String]
    let places: [String]?
    let rep: String?
    let outcomes: [String]?
    let startle: Bool?
    let youngCap: Int?
    let gear: [String]?
    let whistle: Bool?
    let proof: Proof?
    let steps: [Step]

    var dims: [String] { proof?.dims ?? [] }
    var isOutcome: Bool { rep == "outcome" }
    func top(_ d: String) -> Int { (proof?.values(d).count ?? 1) - 1 }
    func label(_ d: String, _ i: Int) -> String { proof?.values(d)[safe: i]?.t ?? "" }
    func value(_ d: String, _ i: Int) -> Double { proof?.values(d)[safe: i]?.v ?? 0 }
}

struct Track: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let blurb: String
    let goals: [String]?
    let field: Bool?
    let gate: Gate?
    let checklist: String?
}

/// Something the owner confirms once per dog before a track opens (usually the law).
struct Gate: Codable, Hashable {
    let title: String
    let text: String
    let confirm: String
}

struct HelperStep: Codable, Hashable {
    let t: String
    let `do`: String
}
struct HelperMeasure: Codable, Hashable {
    let unit: String
    let label: String
}
/// A behavior helper: a plan for a common problem, not a skill to master.
struct Helper: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let uses: [String]
    let goal: String
    let stop: String
    let measure: HelperMeasure?
    let steps: [HelperStep]
}

/// One item of the Canine Good Citizen test and the skills that cover it.
struct CGCItem: Codable, Hashable {
    let t: String
    let needs: [String]
}

struct Place: Codable, Hashable, Identifiable {
    let id: String
    let name: String
}

struct SoundDef: Codable, Hashable, Identifiable {
    let id: String
    let name: String
}

struct Season: Codable, Hashable {
    let name: String
    let milestones: [String]
}

struct PassportGroup: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let items: [String]
}

struct Drive: Codable, Hashable {
    let name: String
    let reward: String
    let watch: String
}

struct Breed: Codable, Hashable {
    let name: String
    let drive: String
    let size: String
    let flat: Bool
}

struct CatalogFile: Codable {
    let tracks: [Track]
    let places: [Place]
    let levels: [String]
    let skills: [Skill]
    let sounds: [SoundDef]
    let seasons: [String: Season]
    let passport: [PassportGroup]
    let helpers: [Helper]
    let cgc: [CGCItem]
    let drives: [String: Drive]
    let breeds: [Breed]
}

enum Catalog {
    static let data: CatalogFile = {
        guard let url = Bundle.main.url(forResource: "Catalog", withExtension: "json"),
              let d = try? Data(contentsOf: url),
              let c = try? JSONDecoder().decode(CatalogFile.self, from: d)
        else { fatalError("Catalog.json is missing or invalid. Run node tools/gen_catalog.js.") }
        return c
    }()
    static var skills: [Skill] { data.skills }
    static var tracks: [Track] { data.tracks }
    static var places: [Place] { data.places }
    static var levels: [String] { data.levels }
    static var sounds: [SoundDef] { data.sounds }

    static let free = Skill(id: "free", track: "", name: "Free clicker", goal: "Just the marker pad, no plan.", cue: "", proofMark: nil, needs: [],
                            places: nil, rep: nil, outcomes: nil, startle: nil, youngCap: nil, gear: nil, whistle: nil, proof: nil, steps: [])
    static func pseudo(_ id: String, _ name: String, _ goal: String) -> Skill {
        Skill(id: id, track: "", name: name, goal: goal, cue: "", proofMark: nil, needs: [], places: nil, rep: nil, outcomes: nil,
              startle: nil, youngCap: nil, gear: nil, whistle: nil, proof: nil, steps: [])
    }
    static func skill(_ id: String) -> Skill? { data.skills.first { $0.id == id } }
    /// Any block id: a real skill, Charge Yes, a break, a sound-ladder entry ("snd:gun") or the free clicker.
    static func any(_ id: String) -> Skill {
        if let s = skill(id) { return s }
        if id == "charge" { return pseudo("charge", "Charge Yes", "Yes means food.") }
        if id == "break" { return pseudo("break", "Break", "Water and shade.") }
        if let snd = sound(id) { return pseudo(id, "Sound ladder: " + snd.name, "Paired with food, step by step.") }
        return free
    }
    static func sound(_ blockId: String) -> SoundDef? { data.sounds.first { "snd:" + $0.id == blockId } }
    static func track(_ id: String) -> Track? { data.tracks.first { $0.id == id } }
    static func breed(_ name: String) -> Breed? { data.breeds.first { $0.name.lowercased() == name.trimmingCharacters(in: .whitespaces).lowercased() } }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
