import SwiftUI

/// The dog profile: seven quick questions, one at a time. Also used to edit a dog.
struct OnboardingView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State var draft: Dog
    @State private var q = 0
    @State private var unsure = false
    @State private var birthDate = Date()
    @State private var hasBirth = false
    @State private var confirmDelete = false

    private let ages: [(String, Int)] = [("Under 4 months", 10), ("4 to 6 months", 21), ("6 to 18 months", 52), ("1.5 to 7 years", 200), ("8 years or older", 450)]
    private let sizes: [(String, String)] = [("s", "Small (under 10 kg)"), ("m", "Medium (10-25 kg)"), ("l", "Large (25-45 kg)"), ("g", "Giant (over 45 kg)")]
    private let goals: [(String, String)] = [("foundations", "Good manners"), ("puppy", "Puppy basics"), ("life", "Vet, grooming, car, guests"),
        ("waterfowl", "Duck and goose hunting"), ("upland", "Quail and upland birds (pointing dogs)"),
        ("flush", "Pheasant, grouse and quail (flushing dogs)"), ("hog", "Hog bay dog"), ("tracking", "Blood tracking"), ("shed", "Shed antlers"),
        ("nosework", "Nose work"), ("sport", "Obedience and Canine Good Citizen"), ("tricks", "Tricks")]
    private let rewards: [(String, String)] = [("food", "Food"), ("toy", "Toys"), ("tug", "Tug"), ("ball", "Ball"), ("praise", "Praise")]
    private let quiz: [(String, String)] = [("retrieve", "Carries things around"), ("herd", "Chases things that move"), ("scent", "Tracks with the nose down"), ("point", "Freezes and stares at birds")]
    private let days: [(Int, String)] = [(1, "Mon"), (2, "Tue"), (3, "Wed"), (4, "Thu"), (5, "Fri"), (6, "Sat"), (0, "Sun")]
    private let count = 7
    private var existing: Bool { model.root.dogs.contains { $0.id == draft.id } }
    private var nm: String { draft.name.isEmpty ? "your dog" : draft.name }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Eyebrow("\(q + 1) of \(count)")
                    Spacer()
                    Button("Close") { dismiss() }.buttonStyle(OutlineButtonStyle())
                }
                switch q {
                case 0:
                    title("What's your dog's name?")
                    TextField("Milo", text: $draft.name).textFieldStyle(.roundedBorder).font(.title3).textInputAutocapitalization(.words).submitLabel(.next).onSubmit(next)
                case 1:
                    title("How old is \(nm)?")
                    Flow { ForEach(ages.indices, id: \.self) { i in Chip(ages[i].0, on: approxAge == ages[i].1) { setAge(weeks: ages[i].1) } } }
                    Toggle("Or set their birthday (a guess is fine)", isOn: $hasBirth).tint(Theme.accent)
                    if hasBirth { DatePicker("Birthday", selection: $birthDate, in: ...Date(), displayedComponents: .date).onChange(of: birthDate) { _, d in draft.birth = AppModel.day(d) } }
                case 2:
                    title("What breed?")
                    Text("For a mix, pick the breed they look most like, or Not sure.").font(.subheadline).foregroundStyle(Theme.muted)
                    TextField("Start typing, e.g. Labrador", text: Binding(get: { draft.breed ?? "" }, set: { setBreed($0) }))
                        .textFieldStyle(.roundedBorder).font(.title3)
                    let typed = (draft.breed ?? "").lowercased()
                    if typed.count >= 2 && Catalog.breed(draft.breed ?? "") == nil {
                        Flow { ForEach(Catalog.data.breeds.filter { $0.name.lowercased().contains(typed) }.prefix(6), id: \.name) { b in Chip(b.name, on: false) { setBreed(b.name) } } }
                    }
                    Button("Not sure") { unsure = true; draft.breed = nil }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss)
                    if unsure {
                        Text("Four quick questions instead. Tap the one that sounds most like your dog:").font(.subheadline).foregroundStyle(Theme.muted)
                        Flow { ForEach(quiz.indices, id: \.self) { i in Chip(quiz[i].1, on: draft.drive == quiz[i].0) { draft.drive = quiz[i].0 } } }
                    }
                    if let d = draft.drive.flatMap({ Catalog.data.drives[$0] }) {
                        Text("\(d.name). Works best: \(d.reward). Watch for: \(d.watch).").font(.subheadline).foregroundStyle(Theme.muted)
                    }
                case 3:
                    title("How big when grown?")
                    Flow { ForEach(sizes.indices, id: \.self) { i in Chip(sizes[i].1, on: draft.size == sizes[i].0) { draft.size = sizes[i].0 } } }
                case 4:
                    title("What do you want to work on?")
                    Text("Pick any. The plan leans toward these.").font(.subheadline).foregroundStyle(Theme.muted)
                    Flow { ForEach(goals.indices, id: \.self) { i in Chip(goals[i].1, on: draft.goals.contains(goals[i].0)) { toggleGoal(goals[i].0) } } }
                    let withSeason = goals.map(\.0).filter { draft.goals.contains($0) && Catalog.data.seasons[$0] != nil }
                    if !withSeason.isEmpty {
                        Text("Opening days (optional). The plan counts down to it and tells you if you're behind.").font(.subheadline).foregroundStyle(Theme.muted)
                        ForEach(withSeason, id: \.self) { g in seasonPicker(g, Catalog.data.seasons[g]?.name ?? "") }
                    }
                case 5:
                    title("What does \(nm) love most?")
                    Flow { ForEach(rewards.indices, id: \.self) { i in Chip(rewards[i].1, on: draft.reward == rewards[i].0) { draft.reward = rewards[i].0 } } }
                default:
                    title("Which days can you train?")
                    Text("A few minutes is enough. Rest days are part of the plan.").font(.subheadline).foregroundStyle(Theme.muted)
                    Flow { ForEach(days.indices, id: \.self) { i in Chip(days[i].1, on: draft.days.contains(days[i].0)) { toggleDay(days[i].0) } } }
                    if AppModel.isField(draft.goals) {
                        Text("FIELD OR WATER DAY").font(.display(19)).foregroundStyle(Theme.muted).padding(.top, 8)
                        Text("One longer session a week out in the field or at the water. Optional.").font(.subheadline).foregroundStyle(Theme.muted)
                        Flow {
                            Chip("None", on: draft.fieldDay == nil) { draft.fieldDay = nil }
                            ForEach(days.indices, id: \.self) { i in Chip(days[i].1, on: draft.fieldDay == days[i].0) { draft.fieldDay = days[i].0 } }
                        }
                    }
                }
                HStack {
                    Button("Back") { q -= 1 }.buttonStyle(OutlineButtonStyle()).disabled(q == 0).frame(maxWidth: .infinity)
                    Button(q == count - 1 ? "Save" : "Next", action: next).buttonStyle(OutlineButtonStyle(solid: true)).frame(maxWidth: .infinity)
                }
                .padding(.top, 8)
                if existing && q == 0 {
                    Button("Remove this dog") { confirmDelete = true }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.miss)
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .interactiveDismissDisabled(model.root.dogs.isEmpty)
        .onAppear {
            if let b = draft.birth, let d = AppModel.date(b) { birthDate = d; hasBirth = true }
        }
        .confirmationDialog("Remove \(nm) and all their progress? This can't be undone.", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Remove", role: .destructive) { model.removeDog(draft.id); dismiss() }
        }
    }

    private func title(_ t: String) -> some View { Text(t.uppercased()).font(.display(30)) }

    private func seasonPicker(_ g: String, _ label: String) -> some View {
        let on = Binding(get: { draft.seasons[g] != nil }, set: { draft.seasons[g] = $0 ? AppModel.day(Date().addingTimeInterval(86400 * 60)) : nil })
        let date = Binding(get: { draft.seasons[g].flatMap(AppModel.date) ?? Date() }, set: { draft.seasons[g] = AppModel.day($0) })
        return VStack(alignment: .leading) {
            Toggle(label, isOn: on).tint(Theme.accent)
            if draft.seasons[g] != nil { DatePicker("Date", selection: date, displayedComponents: .date) }
        }
    }

    private var approxAge: Int? {
        guard let b = draft.birth else { return nil }
        let w = model.daysBetween(b, model.today) / 7
        return ages.map(\.1).first { abs($0 - w) < 1 }
    }
    private func setAge(weeks: Int) {
        let d = Date().addingTimeInterval(-Double(weeks) * 7 * 86400)
        draft.birth = AppModel.day(d); birthDate = d
    }
    private func setBreed(_ name: String) {
        draft.breed = name.isEmpty ? nil : name
        if let b = Catalog.breed(name) {
            draft.drive = b.drive; if draft.size == nil { draft.size = b.size }; draft.flat = b.flat; unsure = false
        }
    }
    private func toggleGoal(_ g: String) {
        if draft.goals.contains(g) { draft.goals.removeAll { $0 == g } } else { draft.goals.append(g) }
    }
    private func toggleDay(_ d: Int) {
        if draft.days.contains(d) { draft.days.removeAll { $0 == d } } else { draft.days.append(d) }
    }
    private func next() {
        if q == 0 && draft.name.trimmingCharacters(in: .whitespaces).isEmpty { model.toast("Add a name first."); return }
        if q < count - 1 { q += 1; return }
        draft.name = draft.name.trimmingCharacters(in: .whitespaces)
        model.saveDog(draft)
        dismiss()
    }
}
